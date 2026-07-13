"use client"

import { useChartPart } from "./chart-context"
import type { DitherColor } from "./palette"
import { rgb, seedOfColor } from "./palette"

/**
 * A horizontal reference line at a y-value — thresholds, min/max readouts,
 * a committed price — with an optional right-aligned label pill.
 *
 * Hidden automatically when `value` falls outside the y-domain, so hosts
 * can pass raw values without clamping.
 *
 * Variants:
 * - `"quiet"` — muted hairline + a popover-styled pill (readouts).
 * - `"solid"` — line and pill in the series tone (hard limits).
 */
export function ReferenceLine({
  value,
  label,
  tone = "grey",
  variant = "quiet",
  dashed = true,
}: {
  value: number
  label?: string
  tone?: DitherColor
  variant?: "quiet" | "solid"
  dashed?: boolean
}) {
  const ctx = useChartPart("ReferenceLine", ["area", "line", "bar"])
  if (!ctx.ready) return null
  const y = ctx.y(value)
  if (!Number.isFinite(y) || y < 0 || y > ctx.plot.height) return null

  const seed = seedOfColor(tone)
  const w = ctx.plot.width

  const pillW = label ? label.length * 6.2 + 16 : 0
  const pillH = 20

  return (
    <g className="text-muted-foreground">
      <line
        x1={0}
        x2={w}
        y1={y}
        y2={y}
        stroke={variant === "solid" ? rgb(seed.fill) : "currentColor"}
        strokeWidth={variant === "solid" ? 2 : 1}
        strokeDasharray={dashed ? "6 6" : undefined}
        opacity={variant === "solid" ? 0.85 : 0.6}
      />
      {label && (
        <g transform={`translate(${w - pillW - 6}, ${y - pillH / 2})`}>
          <rect
            width={pillW}
            height={pillH}
            rx={6}
            className={
              variant === "solid" ? undefined : "fill-popover stroke-border"
            }
            fill={variant === "solid" ? rgb(seed.fill, 1, 0.92) : undefined}
            strokeWidth={1}
          />
          <text
            x={pillW / 2}
            y={pillH / 2}
            textAnchor="middle"
            dominantBaseline="central"
            className={`font-mono tabular-nums ${
              variant === "solid" ? "fill-background" : "fill-popover-foreground"
            }`}
            fontSize={10}
            fontWeight={600}
          >
            {label}
          </text>
        </g>
      )}
    </g>
  )
}
