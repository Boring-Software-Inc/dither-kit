"use client"

import { type CartesianChartProps, CartesianRoot } from "./cartesian-root"
import { ScatterCanvas } from "./scatter-canvas"
import type { NumericDomain } from "./scales"

type Row = object

export type ScatterChartProps<TData extends Row> = CartesianChartProps<TData> & {
  xKey: string
  xDomain?: NumericDomain
  yDomain?: NumericDomain
}

/** Composable dither scatter chart with numeric x/y axes. */
export function ScatterChart<TData extends Row>({
  xKey,
  ...props
}: ScatterChartProps<TData>) {
  return (
    <CartesianRoot
      {...props}
      chartType="scatter"
      Canvas={ScatterCanvas}
      layout="vertical"
      xKey={xKey}
    />
  )
}
