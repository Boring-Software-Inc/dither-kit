import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../registry/dither-kit/use-chart-dimensions", () => ({
  useChartDimensions: () => ({
    ref: { current: null },
    size: { width: 600, height: 240 },
  }),
}))

import { Area } from "../registry/dither-kit/area"
import { AreaChart } from "../registry/dither-kit/area-chart"

const data = [
  { m: "Jan", v: 1 },
  { m: "Feb", v: 2 },
]
const config = { v: { label: "V", color: "blue" as const } }

type IOInstance = {
  cb: (entries: Array<{ isIntersecting: boolean }>) => void
  targets: Element[]
}
let observers: IOInstance[] = []

describe("offscreen render pause", () => {
  const orig: Record<string, unknown> = {}
  let rafSpy: ReturnType<typeof vi.spyOn>
  let cafSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    observers = []
    orig.IO = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver
    orig.RO = (globalThis as { ResizeObserver?: unknown }).ResizeObserver
    orig.getContext = HTMLCanvasElement.prototype.getContext
    ;(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver =
      class {
        cb: IOInstance["cb"]
        targets: Element[] = []
        constructor(cb: IOInstance["cb"]) {
          this.cb = cb
          observers.push(this)
        }
        observe(el: Element) {
          this.targets.push(el)
        }
        unobserve() {}
        disconnect() {}
      }
    ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    HTMLCanvasElement.prototype.getContext = (() => ({})) as unknown as typeof HTMLCanvasElement.prototype.getContext
    if (typeof globalThis.requestAnimationFrame === "undefined") {
      globalThis.requestAnimationFrame = (() => 1) as typeof requestAnimationFrame
    }
    if (typeof globalThis.cancelAnimationFrame === "undefined") {
      globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame
    }
    rafSpy = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockReturnValue(1 as unknown as number)
    cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {})
  })

  afterEach(() => {
    rafSpy.mockRestore()
    cafSpy.mockRestore()
    ;(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = orig.IO
    ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = orig.RO
    HTMLCanvasElement.prototype.getContext =
      orig.getContext as typeof HTMLCanvasElement.prototype.getContext
  })

  it("watches the canvas but doesn't start the loop until it is visible", () => {
    render(
      <AreaChart data={data} config={config}>
        <Area dataKey="v" />
      </AreaChart>
    )
    expect(observers.length).toBeGreaterThan(0)
    expect(observers[0].targets.length).toBeGreaterThan(0)
    expect(rafSpy).not.toHaveBeenCalled()
  })

  it("starts on intersect and stops when it leaves the viewport", () => {
    render(
      <AreaChart data={data} config={config}>
        <Area dataKey="v" />
      </AreaChart>
    )
    const io = observers[0]
    io.cb([{ isIntersecting: true }])
    expect(rafSpy).toHaveBeenCalledTimes(1)
    io.cb([{ isIntersecting: false }])
    expect(cafSpy).toHaveBeenCalled()
  })
})
