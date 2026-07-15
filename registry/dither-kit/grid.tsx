"use client"

import { useChartPart } from "./chart-context"

export function Grid({
  horizontal = true,
  vertical = false,
  strokeDasharray = "3 3",
}: {
  horizontal?: boolean
  vertical?: boolean
  strokeDasharray?: string
}) {
  const ctx = useChartPart("Grid")
  if (!ctx.ready) return null
  const { width } = ctx.plot

  if (ctx.layout === "horizontal") {
    return (
      <g className="stroke-border" strokeDasharray={strokeDasharray}>
        {horizontal &&
          ctx.data.map((_, index) => (
            <line
              key={`h-${index}`}
              x1={0}
              x2={width}
              y1={ctx.yCenter(index)}
              y2={ctx.yCenter(index)}
            />
          ))}
        {vertical &&
          ctx.x.ticks(4).map((tick) => (
            <line
              key={`v-${tick}`}
              x1={ctx.x(tick)}
              x2={ctx.x(tick)}
              y1={0}
              y2={ctx.plot.height}
            />
          ))}
      </g>
    )
  }

  return (
    <g className="stroke-border" strokeDasharray={strokeDasharray}>
      {horizontal &&
        ctx.y
          .ticks(4)
          .map((t) => (
            <line
              key={`h-${t}`}
              x1={0}
              x2={width}
              y1={ctx.y(t)}
              y2={ctx.y(t)}
            />
          ))}
      {vertical &&
        (ctx.chartType === "scatter"
          ? ctx.x.ticks(4).map((tick) => (
              <line
                key={`v-${tick}`}
                x1={ctx.x(tick)}
                x2={ctx.x(tick)}
                y1={0}
                y2={ctx.plot.height}
              />
            ))
          : ctx.data.map((_, i) => (
              <line
                // biome-ignore lint/suspicious/noArrayIndexKey: index is the stable x position
                key={`v-${i}`}
                x1={ctx.xCenter(i) ?? 0}
                x2={ctx.xCenter(i) ?? 0}
                y1={0}
                y2={ctx.plot.height}
              />
            )))}
    </g>
  )
}

// Render beneath the dither canvas so grid lines sit behind the fill.
Grid.chartLayer = "back" as const
