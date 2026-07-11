import { describe, expect, it } from "vitest"
import {
  buildBandScale,
  buildValueScale,
  buildXScale,
  buildYScale,
  computeBands,
  horizontalBarRect,
  indexAtBand,
  nearestIndex,
  nearestPointIndex,
  normalizeDomain,
  normalizeRange,
} from "../registry/dither-kit/scales"

const rows = [
  { a: 10, b: 5 },
  { a: 20, b: 15 },
  { a: 30, b: 10 },
]

describe("computeBands", () => {
  it("default: every series sits on the zero floor", () => {
    const { bands, max, min } = computeBands(rows, ["a", "b"], "default")
    expect(bands.a).toEqual([
      [0, 10],
      [0, 20],
      [0, 30],
    ])
    expect(bands.b[1]).toEqual([0, 15])
    expect(max).toBe(30)
    expect(min).toBe(0)
  })

  it("default: tracks a negative minimum for diverging data", () => {
    const diverging = [{ net: 180 }, { net: -60 }, { net: 240 }]
    const { bands, max, min } = computeBands(diverging, ["net"], "default")
    expect(bands.net).toEqual([
      [0, 180],
      [0, -60],
      [0, 240],
    ])
    expect(max).toBe(240)
    expect(min).toBe(-60)
  })

  it("default: an all-negative series keeps max at the baseline", () => {
    const { max, min } = computeBands([{ v: -10 }, { v: -30 }], ["v"], "default")
    expect(max).toBe(0)
    expect(min).toBe(-30)
  })

  it("default: non-numeric and missing values coerce to 0", () => {
    const dirty = [{ a: 1 }, { a: "x" as unknown as number }, { a: Number.NaN }]
    const { bands } = computeBands(dirty, ["a"], "default")
    expect(bands.a).toEqual([
      [0, 1],
      [0, 0],
      [0, 0],
    ])
  })

  it("default: empty data still yields a usable max", () => {
    const { max, min } = computeBands([], ["a"], "default")
    expect(max).toBe(1)
    expect(min).toBe(0)
  })

  it("stacked: series pile on top of each other", () => {
    const { bands, max } = computeBands(rows, ["a", "b"], "stacked")
    // b stacks on a: row 1 → a [0,20], b [20,35]
    expect(bands.a[1]).toEqual([0, 20])
    expect(bands.b[1]).toEqual([20, 35])
    expect(max).toBe(40) // row 2: 30 + 10
  })

  it("percent: stacks normalize to 0–1", () => {
    const { bands, max } = computeBands(rows, ["a", "b"], "percent")
    expect(max).toBeLessThanOrEqual(1)
    const [b0, b1] = bands.b[0]
    expect(b1).toBeCloseTo(1)
    expect(b0).toBeCloseTo(10 / 15)
  })
})

describe("buildYScale", () => {
  it("maps the domain floor to the plot bottom and max to the top", () => {
    const y = buildYScale(0, 100, 200)
    expect(y(0)).toBe(200)
    expect(y(100)).toBe(0)
  })

  it("nice()s the zero-anchored domain", () => {
    const y = buildYScale(0, 97, 100)
    // .nice() rounds 97 up to a friendly bound, so 97 maps inside the plot
    expect(y(97)).toBeGreaterThan(0)
    expect(y.domain()[0]).toBe(0)
  })

  it("spans a diverging domain so negatives sit below a zero baseline", () => {
    const y = buildYScale(-60, 240, 300)
    // zero is inside the plot, positives above it, negatives below.
    expect(y(0)).toBeGreaterThan(0)
    expect(y(0)).toBeLessThan(300)
    expect(y(240)).toBeLessThan(y(0))
    expect(y(-60)).toBeGreaterThan(y(0))
    expect(y.domain()[0]).toBeLessThanOrEqual(-60)
  })

  it("keeps zero on the domain even when all values are positive", () => {
    const y = buildYScale(20, 100, 200)
    expect(y.domain()[0]).toBe(0)
  })
})

describe("x scales & hit-testing", () => {
  it("buildXScale spreads indices across the plot width", () => {
    const x = buildXScale(3, 100)
    expect(x(0)).toBe(0)
    expect(x(2)).toBe(100)
  })

  it("nearestIndex snaps a pixel to the closest row", () => {
    expect(nearestIndex(0, 5, 100)).toBe(0)
    expect(nearestIndex(100, 5, 100)).toBe(4)
    expect(nearestIndex(30, 5, 100)).toBe(1)
  })

  it("nearestIndex is safe on degenerate inputs", () => {
    expect(nearestIndex(50, 1, 100)).toBe(0)
    expect(nearestIndex(50, 5, 0)).toBe(0)
  })

  it("indexAtBand maps a pixel into its category slot", () => {
    expect(indexAtBand(5, 4, 100)).toBe(0)
    expect(indexAtBand(99, 4, 100)).toBe(3)
    expect(indexAtBand(120, 4, 100)).toBe(3) // clamped
  })

  it("buildBandScale gives every category a positive bandwidth", () => {
    const band = buildBandScale(4, 100)
    expect(band.bandwidth()).toBeGreaterThan(0)
    expect(band(0)).not.toBeUndefined()
  })
})

describe("numeric scales", () => {
  it("maps an explicit numeric domain without adding padding", () => {
    const x = buildValueScale([20, 40], 200, [0, 100])
    expect(x(0)).toBe(0)
    expect(x(50)).toBe(100)
    expect(x(100)).toBe(200)
  })

  it("normalizes empty and equal-value domains", () => {
    expect(normalizeDomain([])).toEqual([0, 1])
    expect(normalizeDomain([5, 5])).toEqual([4.75, 5.25])
  })
})

describe("scatter hit-testing", () => {
  it("returns the closest two-dimensional point", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 90, y: 10 },
      { x: 50, y: 80 },
    ]
    expect(nearestPointIndex(points, 48, 76)).toBe(2)
  })
})

describe("range normalization", () => {
  it("orders reversed endpoints and falls back to the value", () => {
    expect(normalizeRange(0.8, 0.5, 0.2)).toEqual({
      low: 0.2,
      value: 0.5,
      high: 0.8,
    })
    expect(normalizeRange(undefined, 0.5, Number.NaN)).toEqual({
      low: 0.5,
      value: 0.5,
      high: 0.5,
    })
  })
})

describe("horizontal bar geometry", () => {
  const valueToPx = (value: number) => value * 10

  it("builds grouped rectangles in separate category slots", () => {
    expect(
      horizontalBarRect({
        center: 50,
        bandwidth: 40,
        start: 0,
        end: 8,
        seriesIndex: 1,
        seriesCount: 2,
        stacked: false,
        valueToPx,
      })
    ).toEqual({ x: 0, y: 51.6, width: 80, height: 16.8 })
  })

  it("keeps reversed stacked values positive", () => {
    expect(
      horizontalBarRect({
        center: 50,
        bandwidth: 40,
        start: 8,
        end: 3,
        seriesIndex: 0,
        seriesCount: 1,
        stacked: true,
        valueToPx,
      })
    ).toEqual({ x: 30, y: 32, width: 50, height: 36 })
  })
})
