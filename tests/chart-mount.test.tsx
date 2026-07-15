/**
 * Regression tests for the "works without React Compiler" contract (#2).
 *
 * These components are authored for a plain React runtime — no compiler
 * auto-memoization. Two failure modes are pinned here:
 *
 *  1. Infinite "Maximum update depth exceeded" loop (#2). Without stable
 *     register/unregister callbacks the series' effect re-fires every render and
 *     its setState pair loops. Fixed in #3/#4; these mounts are the guard.
 *
 *  2. Silent degradation: an *unmemoized* context provider value is a fresh
 *     object every render, so every consumer (axes, legend, tooltip, dots)
 *     re-renders on every parent render — including renders that change nothing
 *     about the chart. The controllers now memoize the provider value, so an
 *     idle parent re-render must NOT propagate to a context consumer. That's
 *     the precise pin in the second describe block.
 *
 * All tests run under happy-dom with no compiler transform — exactly the
 * environment a published-to-npm consumer without React Compiler runs in.
 */
import { render } from "@testing-library/react"
import { act, memo, useState } from "react"
import { describe, expect, it, vi } from "vitest"

// happy-dom has no layout engine, so the measuring hook reports 0×0 and the
// chart never reaches ready=true. Mock it to a fixed size so the full render
// path (canvas targets, series registration, revision) runs — both failure
// modes only reproduce with a measured chart.
vi.mock("../registry/dither-kit/use-chart-dimensions", () => ({
  useChartDimensions: () => ({
    ref: { current: null },
    size: { width: 600, height: 240 },
  }),
}))

import { Area, Line } from "../registry/dither-kit/area"
import { AreaChart, LineChart } from "../registry/dither-kit/area-chart"
import { Bar } from "../registry/dither-kit/bar"
import { BarChart } from "../registry/dither-kit/bar-chart"
import { useChart } from "../registry/dither-kit/chart-context"
import { Pie } from "../registry/dither-kit/pie"
import { PieChart } from "../registry/dither-kit/pie-chart"
import { usePolarChart } from "../registry/dither-kit/polar-context"
import { Radar } from "../registry/dither-kit/radar"
import { RadarChart } from "../registry/dither-kit/radar-chart"
import { Range } from "../registry/dither-kit/range"
import { RangeChart } from "../registry/dither-kit/range-chart"
import { Scatter } from "../registry/dither-kit/scatter"
import { ScatterChart } from "../registry/dither-kit/scatter-chart"
import { Sparkline } from "../registry/dither-kit/sparkline"

// Tell React this is an act() environment so manual act(...) calls below flush
// state updates and passive effects synchronously — required for the render
// counts to be measured after the mount has fully settled.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true

// happy-dom may not ship ResizeObserver; the charts only need it to exist.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

const data = [
  { month: "Jan", desktop: 186 },
  { month: "Feb", desktop: 240 },
  { month: "Mar", desktop: 210 },
]
const config = { desktop: { label: "Desktop", color: "blue" as const } }
// Pie config keys are slice NAMES (looked up via nameKey).
const pieConfig = {
  Jan: { color: "blue" as const },
  Feb: { color: "purple" as const },
  Mar: { color: "pink" as const },
}

/** Render and surface React's max-update-depth error if the loop fires —
 * whether React throws it or routes it through console.error. */
function mountsCleanly(ui: React.ReactElement) {
  const logged: string[] = []
  const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
    logged.push(args.map(String).join(" "))
  })
  let thrown: unknown = null
  try {
    render(ui)
  } catch (e) {
    thrown = e
  } finally {
    spy.mockRestore()
  }
  const all = [...logged, thrown ? String(thrown) : ""].join("\n")
  expect(all).not.toMatch(/Maximum update depth/)
}

describe("charts mount without React Compiler (#2)", () => {
  it("AreaChart mounts without an update-depth loop", () => {
    mountsCleanly(
      <AreaChart data={data} config={config}>
        <Area dataKey="desktop" />
      </AreaChart>
    )
  })

  it("LineChart mounts without an update-depth loop", () => {
    mountsCleanly(
      <LineChart data={data} config={config}>
        <Line dataKey="desktop" />
      </LineChart>
    )
  })

  it("BarChart mounts without an update-depth loop", () => {
    mountsCleanly(
      <BarChart data={data} config={config}>
        <Bar dataKey="desktop" />
      </BarChart>
    )
  })

  it("horizontal BarChart mounts without an update-depth loop", () => {
    mountsCleanly(
      <BarChart data={data} config={config} layout="horizontal">
        <Bar dataKey="desktop" />
      </BarChart>
    )
  })

  it("ScatterChart mounts without an update-depth loop", () => {
    mountsCleanly(
      <ScatterChart data={data} config={config} xKey="desktop">
        <Scatter dataKey="desktop" labelKey="month" />
      </ScatterChart>
    )
  })

  it("RangeChart mounts without an update-depth loop", () => {
    const ranges = data.map((row) => ({
      ...row,
      low: row.desktop - 10,
      high: row.desktop + 10,
    }))
    mountsCleanly(
      <RangeChart data={ranges} config={config} categoryKey="month">
        <Range dataKey="desktop" lowKey="low" highKey="high" />
      </RangeChart>
    )
  })

  it("PieChart mounts without an update-depth loop", () => {
    mountsCleanly(
      <PieChart data={data} config={pieConfig} dataKey="desktop" nameKey="month">
        <Pie />
      </PieChart>
    )
  })

  it("RadarChart mounts without an update-depth loop", () => {
    mountsCleanly(
      <RadarChart data={data} config={config} nameKey="month">
        <Radar dataKey="desktop" />
      </RadarChart>
    )
  })

  it("Sparkline mounts without an update-depth loop", () => {
    mountsCleanly(<Sparkline data={[3, 7, 5, 9, 8, 12]} color="blue" />)
  })
})

describe("cartesian extensions", () => {
  it("range auto-domain ignores unrelated numeric fields", () => {
    const captured = { current: [0, 1] }

    function DomainProbe() {
      captured.current = useChart().x.domain()
      return null
    }

    act(() => {
      render(
        <RangeChart
          data={[
            { model: "A", mean: 0.5, low: 0.4, high: 0.6, count: 10_000 },
          ]}
          config={{ mean: { label: "Mean", color: "blue" } }}
          categoryKey="model"
          animate={false}
        >
          <Range dataKey="mean" lowKey="low" highKey="high" />
          <DomainProbe />
        </RangeChart>
      )
    })

    expect(captured.current[1]).toBeLessThan(1)
  })

  it("scatter hit-testing considers every configured series", () => {
    const hit = { current: -1 }

    function HitProbe() {
      hit.current = useChart().indexAtPoint(0, 0)
      return null
    }

    act(() => {
      render(
        <ScatterChart
          data={[
            { x: 0, a: 0, b: 1 },
            { x: 0, a: 1, b: 0 },
          ]}
          config={{
            a: { color: "blue" },
            b: { color: "pink" },
          }}
          xKey="x"
          xDomain={[0, 1]}
          yDomain={[0, 1]}
          animate={false}
        >
          <Scatter dataKey="a" />
          <Scatter dataKey="b" />
          <HitProbe />
        </ScatterChart>
      )
    })

    expect(hit.current).toBe(0)
  })
})

/**
 * A context consumer wrapped in React.memo with a stable prop. React.memo skips
 * re-renders when props are unchanged, so it re-renders ONLY when the context
 * value it subscribes to changes identity. That isolates the context
 * propagation path from the ordinary parent→child element flow.
 */
const CartesianProbe = memo(function CartesianProbe({
  counter,
}: {
  counter: { n: number }
}) {
  useChart()
  counter.n += 1
  return null
})

const PolarProbe = memo(function PolarProbe({
  counter,
}: {
  counter: { n: number }
}) {
  usePolarChart()
  counter.n += 1
  return null
})

describe("idle parent re-renders don't re-render consumers (silent degradation)", () => {
  it("cartesian: a no-op parent re-render doesn't re-render a chart consumer", () => {
    const counter = { n: 0 }
    const rerender = { current: () => {} }

    function Harness() {
      const [, setTick] = useState(0)
      rerender.current = () => setTick((t) => t + 1)
      return (
        <AreaChart data={data} config={config} animate={false}>
          <Area dataKey="desktop" />
          <CartesianProbe counter={counter} />
        </AreaChart>
      )
    }

    act(() => {
      render(<Harness />)
    })
    const afterMount = counter.n
    // The consumer rendered while the chart settled…
    expect(afterMount).toBeGreaterThan(0)
    // …but a bounded number of times — a loop would blow past this.
    expect(afterMount).toBeLessThan(20)

    act(() => {
      rerender.current()
    })
    // Provider value memoized against unchanged inputs → same context value →
    // no consumer re-render. Without the memo this would be afterMount + 1.
    expect(counter.n).toBe(afterMount)
  })

  it("polar: a no-op parent re-render doesn't re-render a chart consumer", () => {
    const counter = { n: 0 }
    const rerender = { current: () => {} }

    function Harness() {
      const [, setTick] = useState(0)
      rerender.current = () => setTick((t) => t + 1)
      return (
        <PieChart
          data={data}
          config={pieConfig}
          dataKey="desktop"
          nameKey="month"
          animate={false}
        >
          <Pie />
          <PolarProbe counter={counter} />
        </PieChart>
      )
    }

    act(() => {
      render(<Harness />)
    })
    const afterMount = counter.n
    expect(afterMount).toBeGreaterThan(0)
    expect(afterMount).toBeLessThan(20)

    act(() => {
      rerender.current()
    })
    expect(counter.n).toBe(afterMount)
  })
})
