"use client"

import { useEffect } from "react"
import { type AreaVariant, useChartPart } from "./chart-context"

export type ScatterProps = {
  dataKey: string
  labelKey?: string
  radius?: number
  variant?: AreaVariant
  isClickable?: boolean
}

/** One numeric y series inside a {@link ScatterChart}. */
export function Scatter({
  dataKey,
  labelKey,
  radius = 5,
  variant = "dotted",
  isClickable = false,
}: ScatterProps) {
  const ctx = useChartPart("Scatter", "scatter")
  const { registerSeries, unregisterSeries } = ctx

  if (process.env.NODE_ENV !== "production" && !ctx.config[dataKey]) {
    console.warn(
      `<Scatter dataKey="${dataKey}" />: "${dataKey}" is not in the chart \`config\`.`
    )
  }

  useEffect(() => {
    registerSeries({
      dataKey,
      kind: "scatter",
      variant,
      strokeVariant: "solid",
      labelKey,
      radius,
    })
    return () => unregisterSeries(dataKey)
  }, [dataKey, labelKey, radius, variant, registerSeries, unregisterSeries])

  const band = ctx.bands[dataKey]
  if (!ctx.ready || !band) return null
  const onClick = () =>
    ctx.selectDataKey(ctx.selectedDataKey === dataKey ? null : dataKey)

  return (
    <g>
      {band.map((point, index) => {
        const x = ctx.xCenter(index)
        const y = ctx.y(point[1])
        const rawLabel = labelKey ? ctx.data[index]?.[labelKey] : null
        const label = rawLabel == null ? "" : String(rawLabel)
        const anchor = x > ctx.plot.width - 96 ? "end" : "start"
        const labelX = anchor === "end" ? x - radius - 4 : x + radius + 4
        return (
          <g key={index}>
            <circle
              cx={x}
              cy={y}
              r={Math.max(radius + 4, 9)}
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
                {`${label || index}: ${ctx.xKey ?? "x"} ${ctx.data[index]?.[ctx.xKey ?? ""] ?? 0}, ${dataKey} ${point[1]}`}
              </title>
            </circle>
            {label && (
              <text
                x={labelX}
                y={y + 3}
                textAnchor={anchor}
                className="fill-current font-mono text-[10px] text-foreground"
              >
                {label}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}
