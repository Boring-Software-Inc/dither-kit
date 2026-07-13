"use client"

import { useEffect, useRef } from "react"
import { cn } from "./lib"
import { rgb } from "./palette"
import {
  BAYER4,
  clamp01,
  fnv1a,
  hueFill,
  type PixelBloom,
  pixelBloomStyle,
  pixelPrefersReducedMotion,
  xorshift32,
} from "./pixel"

// 8×8 cells, mirrored across one axis → 32 free pattern bits. With the mirror
// axis bit and 180 hues that's 2^33 × 180 ≈ 1.5 trillion distinct avatars.
const GRID = 8
const CELL_PX = 4 // backing px per cell → a 32×32 canvas, scaled up pixelated

export type AvatarMirror = "auto" | "horizontal" | "vertical"

export type DitherAvatarProps = {
  /** The seed — same name, same avatar, every time. */
  name: string
  /** Hue override (0–360). Derived from the name when omitted. */
  hue?: number
  /** Mirror axis. "auto" picks one from the name — half the avatars fold
   * left/right, half fold top/bottom. */
  mirror?: AvatarMirror
  /** Square size in px. Omit to size via className (e.g. `size-12`). */
  size?: number
  /** Glow on the dither fill. */
  bloom?: PixelBloom
  /** Play the Bayer-ordered materialize entrance. */
  animate?: boolean
  animationDuration?: number
  /** Bump to replay the entrance. */
  replayToken?: number
  className?: string
}

type AvatarModel = {
  on: boolean[] // GRID×GRID, row-major
  density: number[] // per-cell dither density for on cells
  fill: [number, number, number]
}

/**
 * Derive the full 8×8 cell grid from the name: 32 pattern bits + the mirror
 * axis + the hue + per-cell densities, all from one deterministic PRNG stream.
 * Every draw happens unconditionally so overriding `hue` or `mirror` never
 * shifts the pattern.
 */
function avatarModel(
  name: string,
  hueProp: number | undefined,
  mirrorProp: AvatarMirror
): AvatarModel {
  const rand = xorshift32(fnv1a(name))
  const bits = Array.from({ length: 32 }, () => rand() < 0.5)
  const drawnVertical = rand() < 0.5
  const drawnHue = Math.floor(rand() * 180) * 2
  const halfDensity = Array.from({ length: 32 }, () => 0.55 + rand() * 0.45)

  const vertical =
    mirrorProp === "auto" ? drawnVertical : mirrorProp === "vertical"
  const hue = hueProp ?? drawnHue

  const on = new Array<boolean>(GRID * GRID)
  const density = new Array<number>(GRID * GRID)
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      // Fold across the chosen axis: left/right symmetric ("horizontal"
      // mirror) or top/bottom symmetric ("vertical").
      const i = vertical
        ? Math.min(r, GRID - 1 - r) * GRID + c
        : r * (GRID / 2) + Math.min(c, GRID - 1 - c)
      on[r * GRID + c] = bits[i]
      density[r * GRID + c] = halfDensity[i]
    }
  }
  return { on, density, fill: hueFill(hue) }
}

/**
 * Paint the avatar, optionally sweeping cells in with the Bayer-ordered
 * materialize entrance. Lives outside the component (same shape as the chart
 * canvases). Returns a cleanup that cancels the entrance loop.
 */
function paintAvatar(
  canvas: HTMLCanvasElement,
  bloomCanvas: HTMLCanvasElement | null,
  model: AvatarModel,
  animate: boolean,
  duration: number
): (() => void) | undefined {
  const ctx = canvas.getContext("2d")
  if (!ctx) return undefined
  const px = GRID * CELL_PX
  canvas.width = px
  canvas.height = px
  const bloomCtx = bloomCanvas?.getContext("2d") ?? null
  if (bloomCanvas) {
    bloomCanvas.width = px
    bloomCanvas.height = px
  }

  const draw = (progress: number) => {
    ctx.clearRect(0, 0, px, px)
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        if (!model.on[r * GRID + c]) continue
        // Cells materialize in Bayer order — the entrance is made of the same
        // matrix as the texture.
        const start = BAYER4[r % 4][c % 4] * 0.7
        const cellAlpha = clamp01((progress - start) / 0.3)
        if (cellAlpha <= 0) continue
        const density = model.density[r * GRID + c]
        const base = 0.35 + 0.65 * density
        for (let py = 0; py < CELL_PX; py++) {
          for (let pxi = 0; pxi < CELL_PX; pxi++) {
            const gx = c * CELL_PX + pxi
            const gy = r * CELL_PX + py
            const lit = density > BAYER4[gy & 3][gx & 3]
            // On/off cells modulate alpha tiers of the one fill colour, so the
            // avatar holds up on light and dark backgrounds alike.
            const alpha = (lit ? base : base * 0.35) * cellAlpha
            ctx.fillStyle = rgb(model.fill, 1, alpha)
            ctx.fillRect(gx, gy, 1, 1)
          }
        }
      }
    }
    if (bloomCtx) {
      bloomCtx.clearRect(0, 0, px, px)
      bloomCtx.drawImage(canvas, 0, 0)
    }
  }

  if (!animate || pixelPrefersReducedMotion()) {
    draw(1)
    return undefined
  }

  let raf = 0
  const startTime = performance.now()
  const tick = (now: number) => {
    const t = clamp01((now - startTime) / duration)
    draw(1 - (1 - t) ** 3)
    if (t < 1) raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}

/**
 * Generative dithered avatar — a mirrored 8×8 pixel glyph derived from a name,
 * rendered with the ordered-dither texture the charts are made of. Same name,
 * same avatar; ~1.5 trillion combinations across pattern, mirror axis, and hue.
 */
export function DitherAvatar({
  name,
  hue,
  mirror = "auto",
  size,
  bloom = "off",
  animate = true,
  animationDuration = 600,
  replayToken = 0,
  className,
}: DitherAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bloomRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    return paintAvatar(
      canvas,
      bloomRef.current,
      avatarModel(name, hue, mirror),
      animate,
      animationDuration
    )
  }, [name, hue, mirror, animate, animationDuration, replayToken, bloom])

  const bloomStyle = pixelBloomStyle(bloom)

  return (
    <div
      role="img"
      aria-label={`${name} avatar`}
      className={cn("relative", className)}
      style={size != null ? { width: size, height: size } : undefined}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ imageRendering: "pixelated" }}
      />
      {bloomStyle && (
        <canvas
          ref={bloomRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={bloomStyle}
        />
      )}
    </div>
  )
}
