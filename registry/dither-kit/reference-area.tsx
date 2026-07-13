"use client"

import { useChartPart } from "./chart-context"
import { rgb, seedOfColor } from "./palette"
import type { DitherColor } from "./palette"

/**
 * A reference band over part of the plot, with an optional centered label.
 *
 * - `x1`/`x2` are ROW INDICES (the cartesian x-axis is categorical) — a
 *   vertical band, e.g. an outage/maintenance window.
 * - `y1`/`y2` are domain VALUES — a horizontal band, e.g. a safe/danger
 *   threshold zone.
 * - Omitted edges default to the plot bounds, so an x-only or y-only band
 *   spans the full other axis.
 *
 * Bands clamp to the plot; a band entirely outside renders nothing. With a
 * `tone` the fill uses that seed at low alpha; otherwise a muted neutral.
 */
export function ReferenceArea({
  x1,
  x2,
  y1,
  y2,
  tone,
  label,
}: {
  x1?: number
  x2?: number
  y1?: number
  y2?: number
  tone?: DitherColor
  label?: string
}) {
  const ctx = useChartPart("ReferenceArea", ["area", "line", "bar"])
  if (!ctx.ready) return null

  const { width, height } = ctx.plot

  const left =
    x1 != null ? Math.max(0, Math.min(width, ctx.xCenter(x1))) : 0
  const right =
    x2 != null ? Math.max(0, Math.min(width, ctx.xCenter(x2))) : width
  const top =
    y2 != null ? Math.max(0, Math.min(height, ctx.y(y2))) : 0
  const bottom =
    y1 != null ? Math.max(0, Math.min(height, ctx.y(y1))) : height

  if (right - left < 1 || bottom - top < 1) return null

  const fill = tone ? rgb(seedOfColor(tone).fill, 1, 0.08) : undefined

  return (
    <g className="text-muted-foreground">
      <rect
        x={left}
        y={top}
        width={right - left}
        height={bottom - top}
        fill={fill ?? "currentColor"}
        opacity={fill ? 1 : 0.1}
      />
      {label && (
        <text
          x={(left + right) / 2}
          y={(top + bottom) / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          className="font-mono"
          fontSize={9}
        >
          {label}
        </text>
      )}
    </g>
  )
}
