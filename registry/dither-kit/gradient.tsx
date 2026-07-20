"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { cn } from "./lib"
import { fillOf, type PixelBloom, type PixelColor, pixelBloomStyle } from "./pixel"

export type GradientDirection = "up" | "down" | "left" | "right" | number

export type DitherGradientProps = {
  /** The colour the gradient starts solid as — a palette name or a hue. */
  from: PixelColor
  /** What it dissolves into: another colour for a two-tone dither blend, or
   * "transparent" (default) so the background shows through. */
  to?: PixelColor | "transparent"
  /** Where `to` ends up — "up" reads as a glow rising from the bottom edge, or a number for a custom angle in degrees. */
  direction?: GradientDirection
  /** CSS px per dither cell — bigger is chunkier. */
  cell?: number
  /** Overall opacity multiplier. */
  opacity?: number
  /** Glow on the dither fill. */
  bloom?: PixelBloom
  /** Number of quantization steps (color levels). Defaults to 6. */
  levels?: number
  className?: string
}

/**
 * normalizes the direction prop into a standard angle in degrees
 */
function getAngle(direction: GradientDirection): number {
  if (typeof direction === "number") return direction
  switch (direction) {
    case "right":
      return 0
    case "down":
      return 90
    case "left":
      return 180
    case "up":
      return 270
    default:
      return 270
  }
}

/**
 * generates a Base64 png data URL of the Bayer threshold matrix
 * draw the 4x4 matrix onto an canvas (that's in-memory) scaled by the cell size
 * this png is then feeded into the SVG filter chain to act as the threshold map
 */
function generateBayerData(n: number, cell: number): string {
  if (typeof window === "undefined") return ""
  
  const rawMatrix = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ]
  const n2 = n * n
  
  const canvas = document.createElement("canvas")
  canvas.width = n * cell
  canvas.height = n * cell
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""
  
  const imgData = ctx.createImageData(canvas.width, canvas.height)
  const data = imgData.data
  
  // paint each cell as a greyscale block based on its matrix threshold value
  for (let y = 0; y < canvas.height; y++) {
    const by = Math.floor(y / cell) % n
    for (let x = 0; x < canvas.width; x++) {
      const bx = Math.floor(x / cell) % n
      const val = Math.round((rawMatrix[by][bx] / n2) * 255)
      const idx = (y * canvas.width + x) * 4
      data[idx] = val     // R
      data[idx + 1] = val // G
      data[idx + 2] = val // B
      data[idx + 3] = 255 // A (opaque)
    }
  }
  ctx.putImageData(imgData, 0, 0)
  return canvas.toDataURL("image/png")
}

/**
 * dithered-gradient wash the charts' ordered-dither texture as a background.
 * use a procedural SVG filter chain to dither between colors (should be gpu accelerated)
 */
export function DitherGradient({
  from,
  to = "transparent",
  direction = "up",
  cell = 3,
  opacity = 1,
  bloom = "off",
  levels = 6,
  className,
}: DitherGradientProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 0, height: 0 })
  
  // unique IDs for SVG defs to prevent collisions when multiple gradients are mounted
  const baseId = useId()
  const cleanId = baseId.replace(/:/g, "")
  const gradientId = `g-${cleanId}`
  const filterId = `d-${cleanId}`

  // need the exact pixel width/height to correctly project the SVG linear gradient coordinates
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const update = () => {
      const box = wrap.getBoundingClientRect()
      setDims({ width: box.width, height: box.height })
    }
    update()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(update)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  const bayerDataUrl = useMemo(() => {
    return generateBayerData(4, cell)
  }, [cell])

  // calculate the coordinates for the SVG linearGradient.
  // projects all corners of the container onto the angle vector,
  // the gradient perfectly stretches corner-to-corner without distortion.
  const { x1, y1, x2, y2 } = useMemo(() => {
    const angle = getAngle(direction)
    const rad = (angle * Math.PI) / 180
    const dx = Math.cos(rad)
    const dy = Math.sin(rad)
    const w = dims.width
    const h = dims.height

    if (w === 0 || h === 0) {
      return { x1: 0, y1: 0, x2: 0, y2: 0 }
    }

    const corners = [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
    ]
    let minP = Infinity
    let maxP = -Infinity
    for (const [cx, cy] of corners) {
      // ot product to project the corner onto the angle vector
      const p = cx * dx + cy * dy
      if (p < minP) minP = p
      if (p > maxP) maxP = p
    }

    return {
      x1: minP * dx,
      y1: minP * dy,
      x2: maxP * dx,
      y2: maxP * dy,
    }
  }, [direction, dims.width, dims.height])

  // Maps the dithered grayscale values (quantized) into the final output colors:
  const matrixValues = useMemo(() => {
    const r1 = fillOf(from)
    if (to === "transparent") {
      // dissolve to transparent:
      // Keep R, G, B channels locked to the *from* color.
      // Pipe the dithered grayscale pattern (from the Red channel) into the Alpha channel
      return [
        0, 0, 0, 0, r1[0] / 255,
        0, 0, 0, 0, r1[1] / 255,
        0, 0, 0, 0, r1[2] / 255,
        opacity, 0, 0, 0, 0, // scales by overall opacity
      ].join(" ")
    } else {

      // Two-tone blend:
      // Interpolate R, G, B channels between the `from` and `to` colors based on the dithered grayscale value.
      // Set the Alpha channel to the constant overall opacity.
      const r2 = fillOf(to)
      return [
        (r1[0] - r2[0]) / 255, 0, 0, 0, r2[0] / 255,
        0, (r1[1] - r2[1]) / 255, 0, 0, r2[1] / 255,
        0, 0, (r1[2] - r2[2]) / 255, 0, r2[2] / 255,
        0, 0, 0, 0, opacity,
      ].join(" ")
    }
  }, [from, to, opacity])

  // Calculate threshold step arrays for the discrete component transfer
  const stepsString = useMemo(() => {
    const l = Math.max(2, levels)
    const arr = []
    for (let i = 0; i < l; i++) {
      arr.push((i / (l - 1)).toFixed(4))
    }
    return arr.join(" ")
  }, [levels])

  // Calculate weights for the arithmetic composite step
  // k2 scales the underlying gradient, k3 adds the Bayer matrix noise
  const { k2, k3 } = useMemo(() => {
    const l = Math.max(2, levels)
    return {
      k2: ((l - 1) / l).toFixed(4),
      k3: (1 / l).toFixed(4),
    }
  }, [levels])

  const bloomStyle = pixelBloomStyle(bloom)

  // Avoid rendering filter elements before width/height are measured to prevent SSR layout shifts
  if (dims.width === 0 || dims.height === 0) {
    return <div ref={wrapRef} className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} />
  }

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "100%" }}
      >
        <defs>
          {/* Base uniform grayscale gradient */}
          <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
          >
            <stop offset="0" stopColor="white" />
            <stop offset="1" stopColor="black" />
          </linearGradient>

          {/* Core Procedural Filter Chain */}
          <filter
            id={filterId}
            x="0"
            y="0"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            {/* 1. Import the Base64 Bayer matrix */}
            {bayerDataUrl && (
              <feImage
                href={bayerDataUrl}
                result="b"
                width={4 * cell}
                height={4 * cell}
                preserveAspectRatio="none"
              />
            )}
            {/* 2. Tile the matrix across the entire container */}
            <feTile in="b" result="t" />
            
            {/* 3. Mathematically add the tiled matrix noise to the smooth grayscale gradient */}
            <feComposite
              in="SourceGraphic"
              in2="t"
              operator="arithmetic"
              k1="0"
              k2={k2}
              k3={k3}
              k4="0"
              result="c"
            />
            
            {/* 4. Quantize the result into discrete steps (thresholding) */}
            <feComponentTransfer in="c" result="q">
              <feFuncR type="discrete" tableValues={stepsString} />
              <feFuncG type="discrete" tableValues={stepsString} />
              <feFuncB type="discrete" tableValues={stepsString} />
              <feFuncA type="discrete" tableValues={stepsString} />
            </feComponentTransfer>
            
            {/* 5. Remap the dithered grayscale pattern into the final colors and alpha */}
            <feColorMatrix type="matrix" values={matrixValues} />
          </filter>
        </defs>
        
        {/* Render the actual element using the gradient and filter */}
        <rect
          width="100%"
          height="100%"
          fill={`url(#${gradientId})`}
          filter={`url(#${filterId})`}
        />
        
        {/* Render a duplicated layer for bloom/glow effects if requested */}
        {bloomStyle && (
          <rect
            width="100%"
            height="100%"
            fill={`url(#${gradientId})`}
            filter={`url(#${filterId})`}
            style={{
              ...bloomStyle,
              opacity: bloomStyle.opacity,
            }}
          />
        )}
      </svg>
    </div>
  )
}
