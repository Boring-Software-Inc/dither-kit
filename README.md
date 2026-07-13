# Dither Kit

Composable, **dithered** charts for [shadcn/ui](https://ui.shadcn.com) — area, line, bar, pie & radar rendered on a tiny ordered-dither canvas engine. Recharts-style children-as-config API, entrance animations, a gliding scrub tooltip, selection, winking sparkles, and colour bloom.

Live demos & docs → **[tripwire.sh/dither-kit](https://tripwire.sh/dither-kit)**

> **Requires Tailwind CSS.** The components are styled with Tailwind — without it, they render unstyled. Set up [Tailwind](https://tailwindcss.com/docs/installation) and a shadcn project (`components.json`) first.

## Install

The recommended way is the **Dither Kit CLI**, which adds a lockfile so you can `update` and `diff` your components later:

```bash
npx @dither-kit/cli add area-chart     # add a component
npx @dither-kit/cli list               # see what's available
npx @dither-kit/cli update             # pull upstream changes into your copy
```

See [`packages/cli`](./packages/cli/README.md) for the full command reference.

Or install straight from this repo with the shadcn CLI (zero config, no lockfile). Each chart pulls the shared `core` engine (and its deps like `motion` + `d3`) automatically:

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

## Repo layout

- `registry/dither-kit/` — the component sources (source of truth).
- `registry.json` — repo-root registry the shadcn CLI reads for the GitHub shorthand.
- `r/` — the registry served at `https://tripwire.sh/r/*` (content inlined); what the CLI fetches and hands to shadcn.
- `packages/registry-core/` — `@dither-kit/registry-core`: the single shared schema for the registry item shape and the CLI lockfile.
- `packages/cli/` — `@dither-kit/cli`: the installer (`dither-kit`).
- `scripts/build-registry.mts` — regenerates `r/` and `registry.json` from the sources (`npm run build:registry`).

See [`AGENTS.md`](./AGENTS.md) for the three rules the repo lives by, [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the dev loop, and [`HOSTING.md`](./HOSTING.md) for how the registry is served.

## Credit

Heavily inspired by [Evil Charts](https://evilcharts.com) by [legions-developer](https://github.com/legions-developer) — the composable, dithered chart aesthetic that started this.
