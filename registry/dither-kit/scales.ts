// Pure geometry helpers for the dither chart engine. Kept framework-free so the
// context (and, later, bar/line/pie/radar roots) can share the same math.

import { scaleBand, scaleLinear, scalePoint } from "d3-scale"
import { stack as d3Stack, stackOffsetExpand } from "d3-shape"

export type StackType = "default" | "stacked" | "percent"

/**
 * Y-domain strategy:
 * - `"zero"` — current behavior, domain anchored at 0 (default).
 * - `"auto"` — domain `[min − pad, max + pad]` fitted to the data, so a
 *   high-magnitude series with small relative variance (a $4M portfolio
 *   moving ±$50k) keeps its shape, and negative values render instead of
 *   clamping to the floor.
 * - `[lo, hi]` — explicit domain, used verbatim (no padding, no nice()) so
 *   a host can share the exact value↔pixel mapping (e.g. slider overlays).
 * Only meaningful for `stackType="default"`; stacks stay zero-anchored.
 */
export type YDomain = "zero" | "auto" | readonly [number, number]

type Row = Record<string, unknown>

const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : 0

/**
 * Per-series [y0, y1] bands for every row. For `default` every series sits on
 * the floor (y0 = 0); for `stacked`/`percent` they pile on top of each other
 * via d3's stack layout. The shape `bands[key][i] = [y0, y1]` is what both the
 * SVG area paths and the canvas overlay read from.
 */
export function computeBands(
  data: Row[],
  keys: string[],
  stackType: StackType,
  yDomain: YDomain = "zero"
): { bands: Record<string, [number, number][]>; max: number; min: number } {
  if (stackType === "default") {
    if (Array.isArray(yDomain)) {
      const [lo, hi] = yDomain as readonly [number, number]
      const domainMin = Number.isFinite(lo) ? lo : 0
      const domainMax = hi > domainMin ? hi : domainMin + 1
      const bands: Record<string, [number, number][]> = {}
      for (const key of keys) {
        bands[key] = data.map((row) => [domainMin, num(row[key])])
      }
      return { bands, max: domainMax, min: domainMin }
    }
    if (yDomain === "auto") {
      let lo = Number.POSITIVE_INFINITY
      let hi = Number.NEGATIVE_INFINITY
      for (const key of keys) {
        for (const row of data) {
          const v = num(row[key])
          if (v < lo) lo = v
          if (v > hi) hi = v
        }
      }
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        lo = 0
        hi = 1
      }
      const spread = hi - lo
      const pad = spread > 0 ? spread * 0.08 : Math.max(Math.abs(hi) * 0.001, 1)
      const domainMin = lo - pad
      const domainMax = hi + pad
      const bands: Record<string, [number, number][]> = {}
      for (const key of keys) {
        bands[key] = data.map((row) => [domainMin, num(row[key])])
      }
      return { bands, max: domainMax, min: domainMin }
    }
    const bands: Record<string, [number, number][]> = {}
    let max = 0
    for (const key of keys) {
      bands[key] = data.map((row) => {
        const v = num(row[key])
        if (v > max) max = v
        return [0, v]
      })
    }
    return { bands: bands, max: max || 1, min: 0 }
  }

  const series = d3Stack<Row>()
    .keys(keys)
    .value((row, key) => num(row[key]))
    .offset(stackType === "percent" ? stackOffsetExpand : (undefined as never))(
    data
  )

  const bands: Record<string, [number, number][]> = {}
  let max = 0
  series.forEach((layer) => {
    bands[layer.key] = layer.map((point) => {
      if (point[1] > max) max = point[1]
      return [point[0], point[1]]
    })
  })
  return { bands, max: max || 1, min: 0 }
}

/** x positions for each row index, evenly spread across the plot width. */
export function buildXScale(length: number, plotWidth: number) {
  return scalePoint<number>()
    .domain(Array.from({ length }, (_, i) => i))
    .range([0, plotWidth])
}

/** Banded x for bar categories — each index owns a slot of `bandwidth` width. */
export function buildBandScale(length: number, plotWidth: number) {
  return scaleBand<number>()
    .domain(Array.from({ length }, (_, i) => i))
    .range([0, plotWidth])
    .paddingInner(0.28)
    .paddingOuter(0.18)
}

/** Index of the category whose band a horizontal pixel offset falls in. */
export function indexAtBand(px: number, length: number, plotWidth: number) {
  if (length <= 0 || plotWidth <= 0) return 0
  const t = Math.max(0, Math.min(0.999, px / plotWidth))
  return Math.min(length - 1, Math.floor(t * length))
}

/** value → vertical pixel, with the domain floor at the bottom of the plot.
 * `nice` rounds the domain to friendly ticks — kept for the zero-anchored
 * domain only; "auto"/explicit domains pass min/max verbatim so the
 * padding/mapping intent survives. */
export function buildYScale(
  max: number,
  plotHeight: number,
  min = 0,
  nice = min === 0
) {
  const scale = scaleLinear().domain([min, max]).range([plotHeight, 0])
  return nice ? scale.nice() : scale
}

/** Index of the row nearest a horizontal pixel offset within the plot. */
export function nearestIndex(px: number, length: number, plotWidth: number) {
  if (length <= 1 || plotWidth <= 0) return 0
  const t = Math.max(0, Math.min(1, px / plotWidth))
  return Math.round(t * (length - 1))
}
