import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import {
  DitherSkeleton,
  shimmerLift,
  skeletonHeights,
} from "../registry/dither-kit/skeleton"

describe("skeletonHeights", () => {
  it("is deterministic per seed and bounded to [0.18, 0.92]", () => {
    const a = skeletonHeights(40, "x")
    expect(a).toEqual(skeletonHeights(40, "x"))
    expect(a).toHaveLength(40)
    for (const h of a) {
      expect(h).toBeGreaterThanOrEqual(0.18)
      expect(h).toBeLessThanOrEqual(0.92)
    }
  })

  it("different seeds give different silhouettes", () => {
    expect(skeletonHeights(40, "x")).not.toEqual(skeletonHeights(40, "y"))
  })

  it("handles the degenerate single-column case", () => {
    expect(skeletonHeights(1)).toHaveLength(1)
  })
})

describe("shimmerLift", () => {
  it("peaks at the wave head and dies past the span", () => {
    expect(shimmerLift(10, 10, 8)).toBe(1)
    expect(shimmerLift(18, 10, 8)).toBe(0)
    const mid = shimmerLift(14, 10, 8)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
  })

  it("is symmetric around the head", () => {
    expect(shimmerLift(6, 10, 8)).toBeCloseTo(shimmerLift(14, 10, 8))
  })
})

describe("DitherSkeleton", () => {
  it("mounts aria-hidden and no-ops without a 2D canvas (happy-dom)", () => {
    const { container } = render(
      <DitherSkeleton variant="chart" className="h-10 w-20" />
    )
    const el = container.firstElementChild
    expect(el?.getAttribute("aria-hidden")).toBe("true")
    expect(el?.querySelector("canvas")).not.toBeNull()
  })
})
