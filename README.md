# Dither Kit

Composable, **dithered** charts for [shadcn/ui](https://ui.shadcn.com) — area, line, bar, pie & radar rendered on a tiny ordered-dither canvas engine. Recharts-style children-as-config API, entrance animations, a gliding scrub tooltip, selection, winking sparkles, and colour bloom.

Live demos & docs → **[tripwire.sh/dither-kit](https://tripwire.sh/dither-kit)**

## Install

Zero config — install straight from this repo with the shadcn CLI. Each chart pulls the shared `core` engine (and its deps like `motion` + `d3`) automatically:

```bash
npx shadcn@latest add Boring-Software-Inc/dither-kit/area-chart
```

Available items:

| item | what you get |
| --- | --- |
| `area-chart` | area + line charts, includes `Sparkline` |
| `bar-chart` | grouped / stacked bars |
| `pie-chart` | pie / donut |
| `radar-chart` | radar |
| `avatar` | generative mirrored pixel avatars (standalone, no chart engine) |
| `button` | dithered native buttons with hover/press lift (standalone) |
| `gradient` | dithered gradient washes for backgrounds (standalone) |
| `core` | shared engine (installed automatically) |
| `dither-kit` | everything at once |

```bash
npx shadcn@latest add Boring-Software-Inc/dither-kit/dither-kit   # all of it
```

Pin a ref if you want: `…/dither-kit/area-chart#main`.

Files land in `components/dither-kit/`. Then:

```tsx
import { AreaChart, Area, XAxis, YAxis, Legend, Tooltip } from "@/components/dither-kit/area-chart"

const data = [{ month: "Jan", desktop: 186 }, { month: "Feb", desktop: 240 }]
const config = { desktop: { label: "Desktop", color: "blue" } }

<AreaChart data={data} config={config} bloom="aura">
  <XAxis dataKey="month" />
  <YAxis />
  <Legend isClickable />
  <Tooltip labelKey="month" />
  <Area dataKey="desktop" variant="gradient" />
</AreaChart>
```

- `variant`: `gradient` | `dotted` | `hatched` | `solid`
- `bloom`: `off` | `low` | `high` | `aura`

### Avatars, buttons & gradients

All three are standalone — they install without the chart engine:

```tsx
import { DitherAvatar } from "@/components/dither-kit/avatar"
import { DitherButton } from "@/components/dither-kit/button"
import { DitherGradient } from "@/components/dither-kit/gradient"

// deterministic from the name — ~1.5 trillion combinations across the
// mirrored pattern, mirror axis (left/right or top/bottom), and hue
<DitherAvatar name="dan" size={64} />
<DitherAvatar name="dan" hue={210} size={64} />   // hue override, 0–360

// a real <button> — the dither eases denser on hover, denser still pressed
<DitherButton color="blue" variant="gradient" onClick={save}>
  save changes
</DitherButton>

// dithered wash that fills its nearest relative ancestor
<footer className="relative">
  <DitherGradient from="purple" direction="up" />
  <p className="relative">…</p>
</footer>
```

- avatar `mirror`: `auto` | `horizontal` | `vertical` (auto picks per name)
- button `variant`: the chart textures — `gradient` | `dotted` | `hatched` | `solid`
- gradient `to`: a colour for a two-tone dither blend, or `"transparent"` (default)
- gradient `direction`: `up` | `down` | `left` | `right`; `cell` sets chunkiness

## Repo layout

- `registry/dither-kit/` — the component sources (source of truth).
- `registry.json` — repo-root registry the shadcn CLI reads for the GitHub shorthand.
- `r/` — host-agnostic namespace registry (content inlined) for anyone serving `@dither-kit`.
- `scripts/build-registry.mjs` — regenerates both from the sources (`npm run build`).

## Credit

Heavily inspired by [Evil Charts](https://evilcharts.com) by [legions-developer](https://github.com/legions-developer) — the composable, dithered chart aesthetic that started this.
