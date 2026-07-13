"use client"

import { type ComponentType, useEffect, useRef } from "react"
import { cn } from "./lib"
import { rgb, type Rgb } from "./palette"
import {
  BAYER4,
  clamp01,
  fillOf,
  type PixelBloom,
  type PixelColor,
  pixelBloomStyle,
  pixelPrefersReducedMotion,
} from "./pixel"

export type DitherIconProps = {
  /** The SVG icon component to compile (e.g. any lucide-react icon). */
  icon: ComponentType<{ strokeWidth?: number }>
  color?: PixelColor
  /** Square size in px. */
  size?: number
  /** CSS px per dither cell — 1 is crisp, 2+ reads chunkier/pixel-art. */
  cell?: number
  /** Stroke width passed to the source icon — thicken for coarse cells. */
  strokeWidth?: number
  /** Glow on the dither fill. */
  bloom?: PixelBloom
  /** Play the Bayer-ordered materialize entrance. */
  animate?: boolean
  animationDuration?: number
  /** Controlled reveal (0–1), e.g. scroll-linked. Overrides `animate`. */
  progress?: number
  /** Bump to replay the entrance. */
  replayToken?: number
  /** Descriptive label, or null for decorative (aria-hidden). */
  ariaLabel?: string | null
  className?: string
}

/** Sampled alpha (0–255) → cell dither density. Below the floor the cell is
 * off; above it density spans ~0.37–0.85, so even solid fills keep the
 * texture (a density of 1 would paint every cell and lose the dither). */
export function alphaToDensity(alpha: number): number {
  if (alpha < 24) return 0
  return 0.35 + 0.5 * (alpha / 255)
}

type IconModel = {
  density: number[] // cols×rows, row-major
  cols: number
  rows: number
}

/**
 * Rasterize the icon's `<svg>` at cell resolution and read the alpha channel
 * — the "compile" step. Colours don't matter (only coverage does), so
 * currentColor is pinned to an opaque ink before serializing.
 */
function sampleSvg(
  svg: SVGElement,
  cols: number,
  rows: number,
  onModel: (model: IconModel) => void
): () => void {
  const clone = svg.cloneNode(true) as SVGElement
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  const markup = new XMLSerializer()
    .serializeToString(clone)
    .replaceAll("currentColor", "#fff")

  let cancelled = false
  const img = new Image()
  img.onload = () => {
    if (cancelled) return
    const sampler = document.createElement("canvas")
    sampler.width = cols
    sampler.height = rows
    const sctx = sampler.getContext("2d", { willReadFrequently: true })
    if (!sctx) return
    sctx.drawImage(img, 0, 0, cols, rows)
    const data = sctx.getImageData(0, 0, cols, rows).data
    const density = new Array<number>(cols * rows)
    for (let i = 0; i < cols * rows; i++) {
      density[i] = alphaToDensity(data[i * 4 + 3])
    }
    onModel({ density, cols, rows })
  }
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  return () => {
    cancelled = true
  }
}

/** Size the backing stores once per compiled model — resizing resets the
 * canvas, so the per-frame painter must never touch width/height. */
function sizeIconCanvases(
  canvas: HTMLCanvasElement,
  bloomCanvas: HTMLCanvasElement | null,
  model: IconModel
): void {
  canvas.width = model.cols
  canvas.height = model.rows
  if (bloomCanvas) {
    bloomCanvas.width = model.cols
    bloomCanvas.height = model.rows
  }
}

/** Paint one frame at reveal `progress`, cells materializing in Bayer order
 * (same entrance as the avatar/charts). */
function paintIcon(
  canvas: HTMLCanvasElement,
  bloomCanvas: HTMLCanvasElement | null,
  model: IconModel,
  fill: Rgb,
  progress: number
): void {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const { density, cols, rows } = model
  ctx.clearRect(0, 0, cols, rows)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const d = density[r * cols + c]
      if (d <= 0) continue
      const start = BAYER4[r % 4][c % 4] * 0.7
      const cellAlpha = clamp01((progress - start) / 0.3)
      if (cellAlpha <= 0) continue
      const lit = d > BAYER4[r & 3][c & 3]
      const alpha = (lit ? 0.35 + 0.65 * d : 0.12 * d) * cellAlpha
      ctx.fillStyle = rgb(fill, 1, alpha)
      ctx.fillRect(c, r, 1, 1)
    }
  }
  const bloomCtx = bloomCanvas?.getContext("2d") ?? null
  if (bloomCanvas && bloomCtx) {
    bloomCtx.clearRect(0, 0, cols, rows)
    bloomCtx.drawImage(canvas, 0, 0)
  }
}

/**
 * SVG→dither compiler — takes any SVG icon component, rasterizes it at cell
 * resolution, and re-emits it through the ordered-dither texture the rest of
 * the kit is made of. Reveals with the Bayer materialize entrance, or under
 * a controlled `progress` for scroll-linked reveals.
 */
export function DitherIcon({
  icon: Icon,
  color = "grey",
  size = 24,
  cell = 1,
  strokeWidth = 2,
  bloom = "off",
  animate = true,
  animationDuration = 500,
  progress,
  replayToken = 0,
  ariaLabel = null,
  className,
}: DitherIconProps) {
  const holderRef = useRef<HTMLSpanElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bloomRef = useRef<HTMLCanvasElement>(null)
  const modelRef = useRef<IconModel | null>(null)
  // The sampling effect must not re-run when only `progress` scrubs — read it
  // through a ref there instead of listing it as a dep.
  const progressRef = useRef(progress)
  progressRef.current = progress

  // Compile: sample the hidden SVG, then reveal (entrance loop, controlled
  // progress, or a single full paint).
  useEffect(() => {
    const holder = holderRef.current
    const canvas = canvasRef.current
    const svg = holder?.querySelector("svg")
    if (!holder || !canvas || !svg) return

    const fill = fillOf(color)
    const cells = Math.max(4, Math.round(size / cell))
    let raf = 0
    const cancelSample = sampleSvg(svg, cells, cells, (model) => {
      modelRef.current = model
      sizeIconCanvases(canvas, bloomRef.current, model)
      const controlled = progressRef.current
      if (controlled != null) {
        paintIcon(canvas, bloomRef.current, model, fill, clamp01(controlled))
        return
      }
      if (!animate || pixelPrefersReducedMotion()) {
        paintIcon(canvas, bloomRef.current, model, fill, 1)
        return
      }
      const start = performance.now()
      const tick = (now: number) => {
        // A controlled `progress` arriving mid-entrance takes over — stop the
        // loop instead of overpainting the host's frame.
        if (progressRef.current != null) return
        const t = clamp01((now - start) / animationDuration)
        paintIcon(canvas, bloomRef.current, model, fill, 1 - (1 - t) ** 3)
        if (t < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })

    return () => {
      cancelSample()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [Icon, color, size, cell, strokeWidth, bloom, animate, animationDuration, replayToken])

  // Controlled scrub: repaint on progress once the model is compiled.
  useEffect(() => {
    const canvas = canvasRef.current
    const model = modelRef.current
    if (progress == null || !canvas || !model) return
    paintIcon(canvas, bloomRef.current, model, fillOf(color), clamp01(progress))
  }, [progress, color])

  const bloomStyle = pixelBloomStyle(bloom)

  return (
    <span
      role={ariaLabel == null ? undefined : "img"}
      aria-label={ariaLabel ?? undefined}
      aria-hidden={ariaLabel == null || undefined}
      className={cn("relative inline-block align-middle", className)}
      style={{ width: size, height: size }}
    >
      {/* Hidden source SVG — the thing we compile. */}
      <span
        ref={holderRef}
        aria-hidden
        className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
      >
        <Icon strokeWidth={strokeWidth} />
      </span>
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
    </span>
  )
}
