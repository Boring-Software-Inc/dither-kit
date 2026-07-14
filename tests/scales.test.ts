import { describe, expect, it } from "vitest"
import {
  buildBandScale,
  buildXScale,
  buildYScale,
  computeBands,
  indexAtBand,
  nearestIndex,
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
