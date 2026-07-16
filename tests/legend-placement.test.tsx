import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("../registry/dither-kit/use-chart-dimensions", () => ({
  useChartDimensions: () => ({
    ref: { current: null },
    size: { width: 600, height: 240 },
  }),
}))

import { Area } from "../registry/dither-kit/area"
import { AreaChart } from "../registry/dither-kit/area-chart"
import { Legend } from "../registry/dither-kit/legend"

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
]
const config = { desktop: { label: "Desktop", color: "blue" as const } }

function legendAndPlot(container: HTMLElement) {
  const legend = container.querySelector("button")?.parentElement as HTMLElement
  const plot = container
    .querySelector('svg[aria-label="Chart"]')
    ?.closest("div") as HTMLElement
  return { legend, plot }
}

describe("Legend placement", () => {
  it("overlays the plot by default", () => {
    const { container } = render(
      <AreaChart data={data} config={config}>
        <Legend />
        <Area dataKey="desktop" />
      </AreaChart>
    )
    const { legend, plot } = legendAndPlot(container)
    expect(legend.className).toContain("absolute")
    expect(plot.contains(legend)).toBe(true)
  })

  it("reserves space outside the plot when placement is block", () => {
    const { container } = render(
      <AreaChart data={data} config={config}>
        <Legend placement="block" />
        <Area dataKey="desktop" />
      </AreaChart>
    )
    const { legend, plot } = legendAndPlot(container)
    expect(legend.className).not.toContain("absolute")
    expect(plot.contains(legend)).toBe(false)
  })
})
