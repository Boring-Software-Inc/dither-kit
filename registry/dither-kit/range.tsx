"use client"

import { useEffect } from "react"
import { type AreaVariant, useChartPart } from "./chart-context"
import { normalizeRange } from "./scales"

export type RangeProps = {
  dataKey: string
  lowKey: string
  highKey: string
  radius?: number
  variant?: AreaVariant
  isClickable?: boolean
}

/** One low/value/high interval series inside a {@link RangeChart}. */
export function Range({
  dataKey,
  lowKey,
  highKey,
  radius = 5,
  variant = "dotted",
  isClickable = false,
}: RangeProps) {
  const ctx = useChartPart("Range", "range")
  const { registerSeries, unregisterSeries } = ctx

  if (process.env.NODE_ENV !== "production" && !ctx.config[dataKey]) {
    console.warn(
      `<Range dataKey="${dataKey}" />: "${dataKey}" is not in the chart \`config\`.`
    )
  }

  useEffect(() => {
    registerSeries({
      dataKey,
      kind: "range",
      variant,
      strokeVariant: "solid",
      lowKey,
      highKey,
      radius,
    })
    return () => unregisterSeries(dataKey)
  }, [dataKey, lowKey, highKey, radius, variant, registerSeries, unregisterSeries])

  if (!ctx.ready) return null
  const onClick = () =>
    ctx.selectDataKey(ctx.selectedDataKey === dataKey ? null : dataKey)

  return (
    <g>
      {ctx.data.map((row, index) => {
        const range = normalizeRange(row[lowKey], row[dataKey], row[highKey])
        const left = ctx.x(range.low)
        const right = ctx.x(range.high)
        const y = ctx.yCenter(index)
        const category = ctx.categoryKey
          ? String(row[ctx.categoryKey] ?? index)
          : String(index)
        return (
          <rect
            key={index}
            x={Math.min(left, right)}
            y={y - Math.max(ctx.bandwidth * 0.4, 8)}
            width={Math.max(1, Math.abs(right - left))}
            height={Math.max(ctx.bandwidth * 0.8, 16)}
            fill="transparent"
            style={{ cursor: isClickable ? "pointer" : "default" }}
            tabIndex={isClickable ? 0 : undefined}
            onClick={isClickable ? onClick : undefined}
            onKeyDown={
              isClickable
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") onClick()
                  }
                : undefined
            }
          >
            <title>
              {`${category}: ${range.value} (${range.low}–${range.high})`}
            </title>
          </rect>
        )
      })}
    </g>
  )
}
