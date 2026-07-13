import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { alphaToDensity, DitherIcon } from "../registry/dither-kit/icon"

// A minimal SVG icon component — no icon-library dependency in the suite.
function Glyph({ strokeWidth = 2 }: { strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
      <path
        d="M3 12h18M12 3v18"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
    </svg>
  )
}

describe("alphaToDensity", () => {
  it("cuts below the floor", () => {
    expect(alphaToDensity(0)).toBe(0)
    expect(alphaToDensity(23)).toBe(0)
  })

  it("never saturates to a solid fill — texture survives full coverage", () => {
    expect(alphaToDensity(255)).toBeCloseTo(0.85)
    expect(alphaToDensity(255)).toBeLessThan(1)
  })

  it("scales monotonically with coverage", () => {
    expect(alphaToDensity(64)).toBeLessThan(alphaToDensity(128))
    expect(alphaToDensity(128)).toBeLessThan(alphaToDensity(255))
  })
})

describe("DitherIcon", () => {
  it("is decorative (aria-hidden) by default", () => {
    const { container } = render(<DitherIcon icon={Glyph} />)
    const el = container.firstElementChild
    expect(el?.getAttribute("aria-hidden")).toBe("true")
    expect(el?.hasAttribute("role")).toBe(false)
  })

  it("exposes role=img when labeled", () => {
    const { container } = render(
      <DitherIcon icon={Glyph} ariaLabel="crosshair" />
    )
    const el = container.querySelector('[role="img"]')
    expect(el?.getAttribute("aria-label")).toBe("crosshair")
  })

  it("renders the hidden source SVG it compiles from", () => {
    const { container } = render(<DitherIcon icon={Glyph} />)
    expect(container.querySelector("svg")).not.toBeNull()
    expect(container.querySelector("canvas")).not.toBeNull()
  })
})
