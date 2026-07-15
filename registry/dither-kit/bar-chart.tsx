"use client"

import { BarCanvas } from "./bar-canvas"
import { type CartesianChartProps, CartesianRoot } from "./cartesian-root"
import type { CartesianLayout } from "./chart-context"

// `object` rather than `Record<string, unknown>`: interfaces don't get an
// implicit index signature, so interface-typed rows failed to satisfy the
// generic. Internal layers still index rows through their own Row type.
type Row = object

export type BarChartProps<TData extends Row> = CartesianChartProps<TData> & {
  layout?: CartesianLayout
}

/** Composable dither **bar** chart — `<Bar>` series, grouped or stacked. */
export function BarChart<TData extends Row>(props: BarChartProps<TData>) {
  return <CartesianRoot chartType="bar" Canvas={BarCanvas} {...props} />
}
