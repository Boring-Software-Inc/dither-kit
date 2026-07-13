/**
 * Regression tests for #2 — "Infinite 'Maximum update depth exceeded' loop
 * in all charts without React Compiler".
 *
 * Without the compiler, the controllers recreate registerSeries/
 * unregisterSeries (and registerVariant/unregisterVariant) every render;
 * both sit in the series parts' effect deps, so the unregister/register
 * effect re-runs — and sets state — on every render, forever. Sparkline
 * has the companion issue: its derived rows/config are rebuilt per render
 * and feed useRevision's adjust-state-during-render.
 *
 * ⚠️ The three mount tests are `it.skip` on current main: the loop does not
 * throw in this harness — it HANGS the worker (the effect loop keeps the
 * scheduler busy forever), which would hang CI rather than fail it. Unskip
 * them in the same PR that merges #3 (+ #4 for Sparkline); they then pass
 * and become the permanent regression guard for #2.
 */
import { describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"

// happy-dom has no layout engine, so the measuring hook reports 0×0 and the
// chart never reaches ready=true. Mock it to a fixed size so the full render
// path (canvas targets, series registration, revision) runs — the loop only
// reproduces with a measured chart.
vi.mock("../registry/dither-kit/use-chart-dimensions", () => ({
  useChartDimensions: () => ({
    ref: { current: null },
    size: { width: 600, height: 240 },
  }),
}))

import { AreaChart } from "../registry/dither-kit/area-chart"
import { Area } from "../registry/dither-kit/area"
import { PieChart } from "../registry/dither-kit/pie-chart"
import { Pie } from "../registry/dither-kit/pie"
import { Sparkline } from "../registry/dither-kit/sparkline"

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
  it.skip("AreaChart mounts without an update-depth loop", () => {
    mountsCleanly(
      <AreaChart data={data} config={config}>
        <Area dataKey="desktop" />
      </AreaChart>
    )
  })

  it.skip("PieChart mounts without an update-depth loop", () => {
    mountsCleanly(
      <PieChart data={data} config={pieConfig} dataKey="desktop" nameKey="month">
        <Pie />
      </PieChart>
    )
  })

  it.skip("Sparkline mounts without an update-depth loop", () => {
    mountsCleanly(<Sparkline data={[3, 7, 5, 9, 8, 12]} color="blue" />)
  })
})
