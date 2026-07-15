"use client"

import { useEffect, useRef } from "react"
import { useChart } from "./chart-context"
import {
  backingSize,
  bloomLayerStyle,
  clamp01,
  easeOutCubic,
  paintDisc,
  prefersReducedMotion,
} from "./dither-paint"

const STAGGER = 0.45

export function ScatterCanvas() {
  const ctx = useChart()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bloomRef = useRef<HTMLCanvasElement>(null)
  const state = useRef(ctx)
  useEffect(() => {
    state.current = ctx
  })

  const { width, height } = ctx.plot
  const { cols, rows } = backingSize(width, height)

  useEffect(() => {
    const canvas = canvasRef.current
    const c = canvas?.getContext("2d")
    if (!(canvas && c) || cols <= 0 || rows <= 0) return
    canvas.width = cols
    canvas.height = rows
    const bloomCanvas = bloomRef.current
    const bloomCtx = bloomCanvas?.getContext("2d") ?? null
    if (bloomCanvas) {
      bloomCanvas.width = cols
      bloomCanvas.height = rows
    }

    const reduce = prefersReducedMotion()
    const animate = state.current.animate && !reduce
    const fx = cols / Math.max(width, 1)
    const fy = rows / Math.max(height, 1)
    let raf = 0
    let start = 0
    let revision = state.current.revision
    let lastProgress = -1
    let lastEmphasis: string | null = null
    let lastHover: number | null = null
    let lastMouse = false
    let lastPaintSig = ""

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      const s = state.current
      if (!s.ready) return
      if (revision !== s.revision) {
        revision = s.revision
        start = 0
        lastProgress = -1
      }
      if (!start) start = now
      const progress = animate
        ? clamp01((now - start) / s.animationDuration)
        : 1
      const emphasis = s.selectedDataKey ?? s.focusDataKey
      const paintSig = `${s.x.domain()}|${s.y.domain()}|${s.configKeys
        .map((key) => {
          const spec = s.seriesSpecs[key]
          return `${s.config[key]?.color}:${spec?.variant}:${spec?.radius}`
        })
        .join(",")}`
      if (
        progress === lastProgress &&
        emphasis === lastEmphasis &&
        s.hoverIndex === lastHover &&
        s.isMouseInChart === lastMouse &&
        paintSig === lastPaintSig
      ) return
      lastProgress = progress
      lastEmphasis = emphasis
      lastHover = s.hoverIndex
      lastMouse = s.isMouseInChart
      lastPaintSig = paintSig
      c.clearRect(0, 0, cols, rows)
      s.configKeys.forEach((key) => {
        const spec = s.seriesSpecs[key]
        if (spec?.kind !== "scatter") return
        const seed = s.seedOf(key)
        const selectedDim = emphasis !== null && emphasis !== key ? 0.3 : 1
        s.bands[key]?.forEach((point, index) => {
          const pointStart = s.dataLength > 1
            ? (index / (s.dataLength - 1)) * STAGGER
            : 0
          const pointProgress = animate
            ? easeOutCubic(clamp01((progress - pointStart) / (1 - STAGGER)))
            : 1
          const active = s.hoverIndex === index
          const hoverDim =
            s.hoverIndex != null && !active && s.isMouseInChart ? 0.45 : 1
          paintDisc(
            c,
            s.xCenter(index) * fx,
            s.y(point[1]) * fy,
            (spec.radius ?? 5) * Math.min(fx, fy) * pointProgress * (active ? 1.25 : 1),
            seed,
            spec.variant,
            selectedDim * hoverDim,
            active ? 1 : 0
          )
        })
      })
      if (bloomCtx) {
        bloomCtx.clearRect(0, 0, cols, rows)
        bloomCtx.drawImage(canvas, 0, 0)
      }
      if (progress >= 1 && !s.entranceDone) s.markEntranceDone()
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [cols, rows, width, height])

  const bloomActive = ctx.bloomOnHover
    ? ctx.isMouseInChart || ctx.hovered
    : true
  const bloom = bloomLayerStyle(ctx.bloom, bloomActive)
  const pos = {
    left: ctx.margins.left,
    top: ctx.margins.top,
    width,
    height,
  } as const

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute"
        style={{ ...pos, imageRendering: "pixelated" }}
      />
      <canvas
        ref={bloomRef}
        className="pointer-events-none absolute"
        style={{ ...pos, ...(bloom ?? { opacity: 0 }) }}
      />
    </>
  )
}
