"use client"

import { useEffect, useRef } from "react"
import { cn } from "./lib"
import { rgb, type Rgb } from "./palette"
import {
  BAYER4,
  fillOf,
  fnv1a,
  type PixelColor,
  pixelPrefersReducedMotion,
  xorshift32,
} from "./pixel"

// Backing-resolution caps — a placeholder never needs more cells than this.
const MAX_COLS = 960
const MAX_ROWS = 600

export type SkeletonVariant = "block" | "chart"

export type DitherSkeletonProps = {
  /** Fill colour — neutral by default so it reads as chrome, not data. */
  color?: PixelColor
  /** "chart" draws a seeded area silhouette — the placeholder for charts. */
  variant?: SkeletonVariant
  /** CSS px per dither cell — bigger is chunkier. */
  cell?: number
  /** One shimmer sweep (plus dwell), in ms. */
  duration?: number
  /** Overall opacity multiplier. */
  opacity?: number
  /** Seed for the "chart" silhouette — same seed, same shape, so a reloading
   * chart doesn't "pop" between two different placeholder shapes. */
  seed?: string
  className?: string
}

/**
 * Deterministic area silhouette for the "chart" variant: per-column heights in
 * [0.18, 0.92] from two seeded sine waves. Pure and exported for tests.
 */
export function skeletonHeights(
  cols: number,
  seed = "dither-skeleton"
): number[] {
  const rand = xorshift32(fnv1a(seed))
  const f1 = 1.5 + rand() * 1.5
  const f2 = 3 + rand() * 3
  const p1 = rand() * Math.PI * 2
  const p2 = rand() * Math.PI * 2
  return Array.from({ length: cols }, (_, x) => {
    const t = x / Math.max(cols - 1, 1)
    const h =
      0.55 +
      0.28 * Math.sin(p1 + t * f1 * Math.PI) +
      0.12 * Math.sin(p2 + t * f2 * Math.PI)
    return Math.min(0.92, Math.max(0.18, h))
  })
}

/** Shimmer lift for a column: a soft (squared-triangle) band around the wave
 * head — 1 at the head, 0 beyond `span` columns. Pure and exported for tests. */
export function shimmerLift(x: number, waveCol: number, span: number): number {
  const d = Math.abs(x - waveCol) / span
  if (d >= 1) return 0
  const t = 1 - d
  return t * t
}

type SkeletonSpec = {
  fill: Rgb
  heights: number[] | null // null = block variant
  opacity: number
}

/** Paint one shimmer frame. `waveCol` may sit outside [0, cols) — that's the
 * dwell between sweeps (and the whole story under reduced motion). */
function paintSkeleton(
  ctx: CanvasRenderingContext2D,
  cols: number,
  rows: number,
  { fill, heights, opacity }: SkeletonSpec,
  waveCol: number
): void {
  ctx.clearRect(0, 0, cols, rows)
  const span = Math.max(6, cols * 0.25)
  for (let x = 0; x < cols; x++) {
    const lift = shimmerLift(x, waveCol, span)
    // The silhouette column starts lower for taller heights (area chart look).
    const yStart = heights ? Math.round(rows * (1 - heights[x])) : 0
    for (let y = yStart; y < rows; y++) {
      const density = 0.16 + 0.3 * lift
      const lit = density > BAYER4[y & 3][x & 3]
      const alpha = (lit ? 0.3 + 0.7 * density : 0.1 * density) * opacity
      if (alpha <= 0.004) continue
      ctx.fillStyle = rgb(fill, 1, alpha)
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

/**
 * Dithered loading placeholder — the ordered-dither texture with a slow
 * shimmer band sweeping through it. Size it like any skeleton (className);
 * `variant="chart"` shapes it as a seeded area silhouette so chart slots
 * load "in character". Decorative: always aria-hidden — keep a text
 * alternative (or aria-busy) on the host region.
 */
export function DitherSkeleton({
  color = "grey",
  variant = "block",
  cell = 3,
  duration = 1800,
  opacity = 0.75,
  seed = "dither-skeleton",
  className,
}: DitherSkeletonProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!wrap || !canvas || !ctx) return

    const reduce = pixelPrefersReducedMotion()
    const spec: SkeletonSpec = { fill: fillOf(color), heights: null, opacity }
    let cols = 0
    let rows = 0
    let raf = 0
    const start = performance.now()

    const frame = (now: number) => {
      // 0–1 sweeps, then a dwell (the extra 0.4) with the band off-canvas.
      const cycle = (((now - start) % duration) / duration) * 1.4
      const span = Math.max(6, cols * 0.25)
      const waveCol = cycle * (cols + span * 2) - span
      paintSkeleton(ctx, cols, rows, spec, waveCol)
      raf = requestAnimationFrame(frame)
    }

    const resize = () => {
      const box = wrap.getBoundingClientRect()
      cols = Math.min(MAX_COLS, Math.max(4, Math.round(box.width / cell)))
      rows = Math.min(MAX_ROWS, Math.max(4, Math.round(box.height / cell)))
      canvas.width = cols
      canvas.height = rows
      spec.heights = variant === "chart" ? skeletonHeights(cols, seed) : null
      if (reduce) paintSkeleton(ctx, cols, rows, spec, Number.NEGATIVE_INFINITY)
    }
    resize()

    if (!reduce) raf = requestAnimationFrame(frame)
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null
    ro?.observe(wrap)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      ro?.disconnect()
    }
  }, [color, variant, cell, duration, opacity, seed])

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className={cn("relative overflow-hidden", className)}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  )
}
