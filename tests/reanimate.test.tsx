import { render } from "@testing-library/react"
import { act, useState } from "react"
import { describe, expect, it, vi } from "vitest"

vi.mock("../registry/dither-kit/use-chart-dimensions", () => ({
  useChartDimensions: () => ({
    ref: { current: null },
    size: { width: 600, height: 240 },
  }),
}))

import { Area } from "../registry/dither-kit/area"
import { AreaChart } from "../registry/dither-kit/area-chart"
import { useChart } from "../registry/dither-kit/chart-context"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

const config = { v: { label: "V", color: "blue" as const } }
const dataA = [
  { m: "Jan", v: 1 },
  { m: "Feb", v: 2 },
]
const dataB = [
  { m: "Jan", v: 3 },
  { m: "Feb", v: 4 },
]

function RevisionProbe({ sink }: { sink: { value: number } }) {
  sink.value = useChart().revision
  return null
}

function mountWith(reanimate: boolean | undefined) {
  const sink = { value: -1 }
  const setData = { current: (_: typeof dataA) => {} }
  function Harness() {
    const [data, set] = useState(dataA)
    setData.current = set
    return (
      <AreaChart data={data} config={config} reanimate={reanimate}>
        <Area dataKey="v" />
        <RevisionProbe sink={sink} />
      </AreaChart>
    )
  }
  act(() => {
    render(<Harness />)
  })
  return { sink, swap: () => act(() => setData.current(dataB)) }
}

describe("reanimate", () => {
  it("false: a fresh data array does not bump the entrance revision", () => {
    const { sink, swap } = mountWith(false)
    const before = sink.value
    swap()
    expect(sink.value).toBe(before)
  })

  it("default: a fresh data array bumps the entrance revision", () => {
    const { sink, swap } = mountWith(undefined)
    const before = sink.value
    swap()
    expect(sink.value).toBe(before + 1)
  })
})
