import { describe, expect, it } from "vitest"
import {
  PALETTE,
  isDitherColor,
  rgb,
  seedOfColor,
} from "../registry/dither-kit/palette"

describe("palette", () => {
  it("every seed has fill, line and star RGB triplets", () => {
    for (const seed of Object.values(PALETTE)) {
      for (const part of [seed.fill, seed.line, seed.star]) {
        expect(part).toHaveLength(3)
        for (const channel of part) {
          expect(channel).toBeGreaterThanOrEqual(0)
          expect(channel).toBeLessThanOrEqual(255)
        }
      }
    }
  })

  it("rgb() formats with brightness and alpha", () => {
    expect(rgb([100, 200, 50])).toBe("rgba(100,200,50,1)")
    expect(rgb([100, 200, 50], 0.5, 0.25)).toBe("rgba(50,100,25,0.25)")
  })

  it("seedOfColor resolves every declared color", () => {
    expect(seedOfColor("green")).toBe(PALETTE.green)
    expect(seedOfColor("grey")).toBe(PALETTE.grey)
  })

  it("isDitherColor guards unknown values", () => {
    expect(isDitherColor("blue")).toBe(true)
    expect(isDitherColor("magenta")).toBe(false)
    expect(isDitherColor(42)).toBe(false)
  })
})
