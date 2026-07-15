"use client"

import { type CartesianChartProps, CartesianRoot } from "./cartesian-root"
import { RangeCanvas } from "./range-canvas"
import type { NumericDomain } from "./scales"

type Row = object

export type RangeChartProps<TData extends Row> = CartesianChartProps<TData> & {
  categoryKey: string
  domain?: NumericDomain
}

/** Horizontal category chart for intervals with a central value marker. */
export function RangeChart<TData extends Row>({
  categoryKey,
  domain,
  ...props
}: RangeChartProps<TData>) {
  return (
    <CartesianRoot
      {...props}
      chartType="range"
      Canvas={RangeCanvas}
      layout="horizontal"
      categoryKey={categoryKey}
      xDomain={domain}
    />
  )
}
