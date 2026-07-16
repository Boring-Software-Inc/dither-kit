import { describe, expect, it } from "vitest"
import { resample, resampleMonotone } from "../registry/dither-kit/dither-paint"

describe("resampleMonotone", () => {
  it("passes through the original points at their columns", () => {
    const out = resampleMonotone([0, 10, 5, 20], 7)
    expect(out[0]).toBeCloseTo(0)
    expect(out[2]).toBeCloseTo(10)
    expect(out[4]).toBeCloseTo(5)
    expect(out[6]).toBeCloseTo(20)
  })

  it("returns exactly `cols` samples", () => {
    expect(resampleMonotone([1, 2, 3], 32)).toHaveLength(32)
  })

  it("holds a single value flat", () => {
    expect(resampleMonotone([7], 4)).toEqual([7, 7, 7, 7])
  })

  it("never overshoots a monotonic series", () => {
    const out = resampleMonotone([0, 1, 10, 11], 64)
    for (let i = 0; i < out.length; i++) {
      expect(out[i]).toBeGreaterThanOrEqual(0)
      expect(out[i]).toBeLessThanOrEqual(11)
      if (i > 0) expect(out[i]).toBeGreaterThanOrEqual(out[i - 1] - 1e-9)
    }
  })

  it("shares the endpoints with linear resampling", () => {
    const lin = resample([3, 8, 2, 9], 40)
    const mon = resampleMonotone([3, 8, 2, 9], 40)
    expect(mon[0]).toBeCloseTo(lin[0])
    expect(mon[mon.length - 1]).toBeCloseTo(lin[lin.length - 1])
  })
})
