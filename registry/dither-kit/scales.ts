// Pure geometry helpers for the dither chart engine. Kept framework-free so the
// context (and, later, bar/line/pie/radar roots) can share the same math.

import { scaleBand, scaleLinear, scalePoint } from "d3-scale"
import { stack as d3Stack, stackOffsetExpand } from "d3-shape"

export type StackType = "default" | "stacked" | "percent"
export type NumericDomain = [number, number]

type Row = Record<string, unknown>

const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : 0

export function normalizeDomain(
  values: number[],
  domain?: NumericDomain,
  includeZero = false
): NumericDomain {
  const finite = values.filter(Number.isFinite)
  let lo = domain?.[0] ?? Math.min(...finite)
  let hi = domain?.[1] ?? Math.max(...finite)

  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1]
  if (lo > hi) [lo, hi] = [hi, lo]
  if (includeZero) {
    lo = Math.min(0, lo)
    hi = Math.max(0, hi)
  }
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.05 || 1
    lo -= pad
    hi += pad
  }
  return [lo, hi]
}

export function buildValueScale(
  values: number[],
  size: number,
  domain?: NumericDomain,
  reverse = false,
  includeZero = false
) {
  const scale = scaleLinear()
    .domain(normalizeDomain(values, domain, includeZero))
    .range(reverse ? [size, 0] : [0, size])
  return domain ? scale : scale.nice()
}

export function normalizeRange(low: unknown, value: unknown, high: unknown) {
  const mean = num(value)
  let lo = typeof low === "number" && Number.isFinite(low) ? low : mean
  let hi = typeof high === "number" && Number.isFinite(high) ? high : mean
  if (lo > hi) [lo, hi] = [hi, lo]
  return { low: lo, value: mean, high: hi }
}

export function nearestPointIndex(
  points: Array<{ x: number; y: number }>,
  px: number,
  py: number
) {
  // ponytail: O(n) hit testing is right for UI-sized datasets; add a spatial
  // index only if charts with thousands of points become a real use case.
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  points.forEach((point, index) => {
    const distance = (point.x - px) ** 2 + (point.y - py) ** 2
    if (distance < bestDistance) {
      best = index
      bestDistance = distance
    }
  })
  return best
}

export function horizontalBarRect({
  center,
  bandwidth,
  start,
  end,
  seriesIndex,
  seriesCount,
  stacked,
  valueToPx,
}: {
  center: number
  bandwidth: number
  start: number
  end: number
  seriesIndex: number
  seriesCount: number
  stacked: boolean
  valueToPx: (value: number) => number
}) {
  const slot = stacked ? bandwidth : bandwidth / Math.max(seriesCount, 1)
  const y = stacked
    ? center - bandwidth * 0.45
    : center - bandwidth / 2 + seriesIndex * slot + slot * 0.08
  const x0 = valueToPx(start)
  const x1 = valueToPx(end)
  return {
    x: Math.min(x0, x1),
    y,
    width: Math.abs(x1 - x0),
    height: stacked ? bandwidth * 0.9 : slot * 0.84,
  }
}

/**
 * Per-series [y0, y1] bands for every row. For `default` every series sits on
 * the zero baseline (y0 = 0), so a negative value yields `[0, v]` with `v < 0`
 * and draws below the baseline; for `stacked`/`percent` they pile on top of
 * each other via d3's stack layout (which splits negatives below zero). The
 * shape `bands[key][i] = [y0, y1]` is what both the SVG area paths and the
 * canvas overlay read from. `max`/`min` bound the value range so the y-scale
 * can span a diverging (below-zero) domain.
 */
export function computeBands(
  data: Row[],
  keys: string[],
  stackType: StackType
): { bands: Record<string, [number, number][]>; max: number; min: number } {
  if (stackType === "default") {
    const bands: Record<string, [number, number][]> = {}
    let max = 0
    let min = 0
    for (const key of keys) {
      bands[key] = data.map((row) => {
        const v = num(row[key])
        if (v > max) max = v
        if (v < min) min = v
        return [0, v]
      })
    }
    // Only fall back to a unit span when there's no range at all (empty /
    // all-zero) — a purely negative series keeps max = 0 so the baseline
    // stays pinned to the top of the plot.
    const flat = max === 0 && min === 0
    return { bands, max: flat ? 1 : max, min }
  }

  const series = d3Stack<Row>()
    .keys(keys)
    .value((row, key) => num(row[key]))
    .offset(stackType === "percent" ? stackOffsetExpand : (undefined as never))(
    data
  )

  const bands: Record<string, [number, number][]> = {}
  let max = 0
  let min = 0
  series.forEach((layer) => {
    bands[layer.key] = layer.map((point) => {
      if (point[1] > max) max = point[1]
      if (point[0] < min) min = point[0]
      return [point[0], point[1]]
    })
  })
  const flat = max === 0 && min === 0
  return { bands, max: flat ? 1 : max, min }
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

/**
 * value → vertical pixel. The domain always includes zero, so charts with only
 * positive values keep a floor at the plot bottom, while diverging data (values
 * below zero) draws below a zero baseline that sits somewhere inside the plot.
 */
export function buildYScale(min: number, max: number, plotHeight: number) {
  const lo = Math.min(0, min)
  const hi = Math.max(0, max)
  // Guard a degenerate (zero-width) domain so `nice()` and the range map stay
  // finite even when every value is exactly zero.
  return scaleLinear()
    .domain([lo, hi === lo ? lo + 1 : hi])
    .nice()
    .range([plotHeight, 0])
}

/** Index of the row nearest a horizontal pixel offset within the plot. */
export function nearestIndex(px: number, length: number, plotWidth: number) {
  if (length <= 1 || plotWidth <= 0) return 0
  const t = Math.max(0, Math.min(1, px / plotWidth))
  return Math.round(t * (length - 1))
}
