"use client"

import { useChartPart } from "./chart-context"

export function YAxis({
  dataKey,
  tickFormatter,
  categoryFormatter,
  tickCount = 4,
  tickMargin = 8,
  maxTicks = 12,
}: {
  dataKey?: string
  tickFormatter?: (value: number) => string
  categoryFormatter?: (value: unknown, index: number) => string
  tickCount?: number
  tickMargin?: number
  maxTicks?: number
}) {
  const ctx = useChartPart("YAxis")
  if (!ctx.ready) return null

  if (ctx.layout === "horizontal") {
    const key = dataKey ?? ctx.categoryKey
    const step = Math.max(1, Math.ceil(ctx.dataLength / maxTicks))
    return (
      <g className="fill-current font-mono text-[10px] text-muted-foreground">
        {ctx.data.map((row, index) => {
          if (index % step !== 0) return null
          const raw = key ? row[key] : index
          return (
            <text
              key={index}
              x={-tickMargin}
              y={ctx.yCenter(index)}
              textAnchor="end"
              dominantBaseline="central"
              fill="currentColor"
            >
              {categoryFormatter
                ? categoryFormatter(raw, index)
                : String(raw ?? "")}
            </text>
          )
        })}
      </g>
    )
  }

  return (
    <g className="fill-current font-mono text-[10px] text-muted-foreground">
      {ctx.y.ticks(tickCount).map((t) => (
        <text
          key={t}
          x={-tickMargin}
          y={ctx.y(t)}
          textAnchor="end"
          dominantBaseline="central"
          fill="currentColor"
        >
          {tickFormatter ? tickFormatter(t) : t}
        </text>
      ))}
    </g>
  )
}
