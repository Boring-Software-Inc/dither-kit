"use client"

import { useEffect, useRef } from "react"
import { cn } from "./lib"
import { rgb } from "./palette"
import {
  BAYER4,
  fillOf,
  type PixelBloom,
  type PixelColor,
  pixelBloomStyle,
} from "./pixel"

// Backing-resolution caps — a background wash never needs more cells than this.
const MAX_COLS = 960
const MAX_ROWS = 600

export type GradientDirection = "up" | "down" | "left" | "right"

export type DitherGradientProps = {
  /** The colour the gradient starts solid as — a palette name or a hue. */
  from: PixelColor
  /** What it dissolves into: another colour for a two-tone dither blend, or
   * "transparent" (default) so the background shows through. */
  to?: PixelColor | "transparent"
  /** Where `to` ends up — "up" reads as a glow rising from the bottom edge. */
  direction?: GradientDirection
  /** CSS px per dither cell — bigger is chunkier. */
  cell?: number
  /** Overall opacity multiplier. */
  opacity?: number
  /** Glow on the dither fill. */
  bloom?: PixelBloom
  className?: string
}

type PaintSpec = {
  from: PixelColor
  to: PixelColor | "transparent"
  direction: GradientDirection
  cell: number
  opacity: number
}

/**
 * Paint the ordered-dither ramp onto a low-res backing canvas sized from the
 * wrapper's box. Static — one paint per prop/size change, no animation loop,
 * so it's free to use as a page-wide background.
 */
function paintGradient(
  canvas: HTMLCanvasElement,
  bloomCanvas: HTMLCanvasElement | null,
  width: number,
  height: number,
  spec: PaintSpec
): void {
  const ctx = canvas.getContext("2d")
  if (!ctx || width <= 0 || height <= 0) return
  const cols = Math.min(MAX_COLS, Math.max(4, Math.round(width / spec.cell)))
  const rows = Math.min(MAX_ROWS, Math.max(4, Math.round(height / spec.cell)))
  canvas.width = cols
  canvas.height = rows

  const fromFill = fillOf(spec.from)
  const toFill = spec.to === "transparent" ? null : fillOf(spec.to)
  const o = spec.opacity

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // t runs 0 at the `from` edge → 1 at the `to` edge.
      const t =
        spec.direction === "up"
          ? 1 - (y + 0.5) / rows
          : spec.direction === "down"
            ? (y + 0.5) / rows
            : spec.direction === "left"
              ? 1 - (x + 0.5) / cols
              : (x + 0.5) / cols
      const density = 1 - t
      const lit = density > BAYER4[y & 3][x & 3]
      if (toFill) {
        // Two-tone: every cell is painted, the dither decides which colour.
        ctx.fillStyle = rgb(lit ? fromFill : toFill, 1, o)
        ctx.fillRect(x, y, 1, 1)
      } else {
        // Dissolve to transparent: lit cells carry the ramp, off cells keep a
        // faint tint that also fades out, so the falloff reads smooth.
        const alpha = (lit ? 0.35 + 0.65 * density : 0.12 * density) * o
        if (alpha <= 0.004) continue
        ctx.fillStyle = rgb(fromFill, 1, alpha)
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }

  const bloomCtx = bloomCanvas?.getContext("2d") ?? null
  if (bloomCanvas && bloomCtx) {
    bloomCanvas.width = cols
    bloomCanvas.height = rows
    bloomCtx.drawImage(canvas, 0, 0)
  }
}

/**
 * Dithered gradient wash — the charts' ordered-dither texture as a background.
 * Fills its nearest positioned ancestor (footer glows, section fades, card
 * backdrops). Dissolves to transparent by default, or dither-blends between
 * two colours when `to` is set.
 */
export function DitherGradient({
  from,
  to = "transparent",
  direction = "up",
  cell = 3,
  opacity = 1,
  bloom = "off",
  className,
}: DitherGradientProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bloomRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const paint = () => {
      const box = wrap.getBoundingClientRect()
      paintGradient(canvas, bloomRef.current, box.width, box.height, {
        from,
        to,
        direction,
        cell,
        opacity,
      })
    }
    paint()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(paint)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [from, to, direction, cell, opacity, bloom])

  const bloomStyle = pixelBloomStyle(bloom)

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ imageRendering: "pixelated" }}
      />
      {bloomStyle && (
        <canvas
          ref={bloomRef}
          className="absolute inset-0 h-full w-full"
          style={bloomStyle}
        />
      )}
    </div>
  )
}
