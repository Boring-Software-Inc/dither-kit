# Dither Kit

Composable **dithered** charts — area, line, bar, pie, radar — on a tiny canvas
engine with a recharts-style children-as-config API. No recharts. The ordered
(Bayer) dither fill, winking sparkles, hover lift, gliding scrub tooltip,
selection, colour bloom, and prop-driven entrance animations are all built in.

The pack is **self-contained** (only `react`, `motion`, `d3-scale`, `d3-shape`,
`clsx`, `tailwind-merge`) and ships as a shadcn registry.

> **Huge thanks to [Evil Charts](https://evilcharts.com)** by
> [legions-developer](https://github.com/legions-developer/evilcharts) — the
> original dithered, composable chart aesthetic that inspired all of this. Go
> star it. ⭐

## Install

Each chart is its own registry item and pulls a shared `core` engine
automatically. Register the namespace once in `components.json`:

```json
{
  "registries": {
    "@dither-kit": "https://<your-host>/r/{name}.json"
  }
}
```

…then add only the charts you want:

```bash
npx shadcn@latest add @dither-kit/area-chart    # area + line (+ Sparkline)
npx shadcn@latest add @dither-kit/bar-chart
npx shadcn@latest add @dither-kit/pie-chart
npx shadcn@latest add @dither-kit/radar-chart
npx shadcn@latest add @dither-kit/avatar        # standalone, no core
npx shadcn@latest add @dither-kit/button        # standalone, no core
npx shadcn@latest add @dither-kit/gradient      # standalone, no core
npx shadcn@latest add @dither-kit/icon          # standalone, no core
npx shadcn@latest add @dither-kit/dither-kit    # everything at once
```

No namespace config? Use the raw URL instead:
`npx shadcn@latest add https://<your-host>/r/radar-chart.json`.

Files land in `components/dither-kit/`; import from each file:

```tsx
import { AreaChart, Area } from "@/components/dither-kit/area-chart"
import { XAxis } from "@/components/dither-kit/x-axis"
import { Legend } from "@/components/dither-kit/legend"
import { Tooltip } from "@/components/dither-kit/tooltip"
```

It relies on the standard shadcn theme tokens (`--popover`, `--border`,
`--muted-foreground`, …) for the axes/legend/tooltip chrome.

## Usage

### Area / line / bar (cartesian)

```tsx
const config = {
  desktop: { label: "Desktop", color: "blue" },
  mobile: { label: "Mobile", color: "purple" },
}

;<AreaChart data={data} config={config} stackType="stacked">
  <XAxis dataKey="month" />
  <YAxis />
  <Legend isClickable />
  <Tooltip labelKey="month" />
  <Area dataKey="desktop" variant="gradient" isClickable>
    <ActiveDot variant="colored-border" />
  </Area>
  <Area dataKey="mobile" variant="hatched" isClickable />
</AreaChart>
```

Swap `AreaChart` → `LineChart` / `BarChart` (and `Area` → `Line` /
`Bar`) for the other cartesian types — same API.

### Pie / radar (polar)

```tsx
<PieChart data={data} config={config} dataKey="visitors" nameKey="browser" innerRadius={0.5}>
  <Legend isClickable align="center" />
  <Tooltip />
  <Pie variant="gradient" />
</PieChart>

<RadarChart data={data} config={config} nameKey="skill">
  <Legend isClickable align="center" />
  <Tooltip />
  <Radar dataKey="desktop" variant="gradient" />
  <Radar dataKey="mobile" variant="hatched" />
</RadarChart>
```

### Sparkline (no axes)

```tsx
<div className="h-11 w-32">
  <Sparkline data={[3, 7, 5, 9, 8, 12]} color="green" hovered={cardHovered} />
</div>
```

### Avatar, button & gradient (standalone)

None of these pull in the chart engine — they share only the pixel primitives
(`pixel.ts`) and the palette.

```tsx
// Deterministic from the name: 32 mirrored pattern bits × 2 mirror axes ×
// 180 hues ≈ 1.5 trillion avatars. Half fold left/right, half top/bottom.
<DitherAvatar name="dan" size={64} />
<DitherAvatar name="dan" hue={210} size={64} />  // hue override (0–360)

// A real <button> in the chart textures — eases denser on hover and press.
<DitherButton color="blue" variant="gradient" onClick={save}>
  save changes
</DitherButton>

// A dithered wash filling its nearest relative ancestor — footers, fades.
<footer className="relative">
  <DitherGradient from="purple" direction="up" />
</footer>
<DitherGradient from={280} to="blue" direction="right" />  // two-tone blend
```

### Icon (SVG-to-dither compiler, standalone)

```tsx
import { Wallet } from "lucide-react"

// Takes any SVG icon component, rasterizes it at cell resolution, reads the
// alpha channel, and re-emits it through the ordered-dither texture with the
// Bayer materialize entrance.
<DitherIcon icon={Wallet} color="blue" size={40} />
<DitherIcon icon={Wallet} size={40} cell={2} strokeWidth={2.5} />  // chunky pixel-art

// Controlled reveal for scroll-linked entrances - overrides `animate`.
<DitherIcon icon={Wallet} progress={scrollProgress} />
```

Decorative by default (`ariaLabel={null}` renders aria-hidden); pass a
string `ariaLabel` for `role="img"` semantics.

## Props worth knowing

- `variant`: `gradient` | `dotted` | `hatched` | `solid` (per series)
- `animate` / `animationDuration` / `replayToken` — entrance + replay-on-demand
- `interactive={false}` — decorative spark: hover lift, no crosshair/tooltip
- `markerIndex` — controlled crosshair (e.g. a committed point)
- `hovered` — parent-driven hover lift (whole card/row)
- `onHoverChange` / `onSelectionChange`

Colors are one of: `green` `blue` `purple` `pink` `orange` `red` `grey`.

## Rebuilding the registry

```bash
bun run registry:build   # → public/r/{core,area-chart,bar-chart,pie-chart,radar-chart,dither-kit}.json + registry.json
```

The split is driven by `scripts/build-registry.mjs`: `core` holds the shared
engine (contexts, scales, dither painter, the canvas-agnostic shells, and the
legend/tooltip/grid/axes/dot chrome); each chart item ships only its own
wrapper + canvas + parts and depends on `@dither-kit/core`.
