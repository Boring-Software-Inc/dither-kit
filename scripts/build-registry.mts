// Builds the Dither Kit shadcn registry — one item per chart, plus a shared
// `core` engine they all depend on.
//
//   npm run build:registry   (or: tsx scripts/build-registry.mts)
//
// Emits three things from the sources in registry/dither-kit/:
//   • registry.json at the repo root — powers shadcn's zero-config GitHub
//     shorthand: `npx shadcn@latest add Boring-Software-Inc/dither-kit/<item>`.
//     File paths are repo-relative sources; no inline content (shadcn reads
//     each file straight from the repo), and deps use the owner/repo/<item>
//     address so `core` resolves without any components.json.
//   • r/<item>.json — per-item registry with content inlined, served at
//     https://tripwire.sh/r/<item>.json. This is what `dither-kit add` resolves
//     to and hands to `shadcn add`.
//   • r/registry.json — the index served at https://tripwire.sh/r/registry.json.
//     This is what the CLI fetches to discover what is installable, grouped by
//     `categories`.
//
// Every emitted item is validated against @dither-kit/registry-core — the one
// shared definition the CLI also uses — so the registry can never drift from
// the shape the CLI expects.
//
// Dither Kit is heavily inspired by Evil Charts (https://evilcharts.com,
// https://github.com/legions-developer/evilcharts).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  RegistryItemSchema,
  RegistrySchema,
  type RegistryItem,
} from "../packages/registry-core/src/index.js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SRC = join(ROOT, "registry/dither-kit")
const OUT = join(ROOT, "r")

// Where files land in a consumer's project (relative to its root).
const TARGET_DIR = "components/dither-kit"
const NS = "@dither-kit"
const HOMEPAGE = "https://tripwire.sh/dither-kit"
const AUTHOR = "ripgrim"

// Where the CLI-served registry lives. The per-item files (r/<name>.json) use
// ABSOLUTE dependency URLs so `shadcn add https://tripwire.sh/r/area-chart.json`
// resolves `core` transitively with zero components.json registry config — the
// CLI hands shadcn a URL and shadcn does the rest.
//
// The base is overridable via DITHER_KIT_REGISTRY_BASE for local end-to-end
// testing only: point it at your local server (e.g. http://127.0.0.1:8791) to
// regenerate a registry whose dependency URLs are reachable without the
// tripwire.sh host. Committed output must always use the default — restore with
// `git checkout -- r/ registry.json` after a local build.
const REGISTRY_BASE = (process.env.DITHER_KIT_REGISTRY_BASE ?? "https://tripwire.sh").replace(/\/+$/, "")
const depUrl = (dep: string) => `${REGISTRY_BASE}/r/${dep.replace(`${NS}/`, "")}.json`
if (REGISTRY_BASE !== "https://tripwire.sh") {
  console.warn(`⚠ building registry with base ${REGISTRY_BASE} — local testing only; restore with \`git checkout -- r/ registry.json\` before committing.`)
}

// GitHub repo backing the zero-config shorthand. shadcn reads registry.json at
// the repo root and pulls each file straight from the repo.
const REPO = "Boring-Software-Inc/dither-kit"
const SRC_REL = "registry/dither-kit"

// Every item ships at the kit's version for now. When a component starts
// evolving independently, give it its own version here — the CLI lockfile,
// `update`, and `diff` are already per-component.
const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version as string

// Shared npm deps live on `core`; chart items inherit them via registryDependencies.
const CORE_DEPS = ["motion", "d3-scale", "d3-shape", "clsx", "tailwind-merge"]
const CORE_DEV_DEPS = ["@types/d3-scale", "@types/d3-shape"]

// The engine every chart shares: contexts, scales, dither painter, the two
// canvas-agnostic shells, and the cross-family chrome (legend/tooltip/grid/axes/dot).
const CORE_FILES = [
  "lib.ts",
  "palette.ts",
  "scales.ts",
  "polar.ts",
  "dither-paint.ts",
  "use-chart-dimensions.ts",
  "chart-context.tsx",
  "common-context.tsx",
  "series-context.tsx",
  "polar-context.tsx",
  "cartesian-root.tsx",
  "polar-root.tsx",
  "grid.tsx",
  "x-axis.tsx",
  "y-axis.tsx",
  "dot.tsx",
  "legend.tsx",
  "tooltip.tsx",
]

// Source definition of each item. `categories` drives how the CLI groups
// `list` and the `add` multiselect as the kit grows past charts.
type ItemDef = {
  name: string
  title: string
  description: string
  categories: string[]
  files: string[]
  registryDependencies: string[]
  dependencies: string[]
  devDependencies: string[]
}

const ITEMS: ItemDef[] = [
  {
    name: "core",
    title: "Dither Kit — Core",
    description:
      "Shared engine for Dither Kit: contexts, d3 scales, the ordered-dither canvas painter, the canvas-agnostic chart shells, and the legend/tooltip/grid/axes/dot chrome. Installed automatically by every chart.",
    categories: ["core"],
    files: CORE_FILES,
    registryDependencies: [],
    dependencies: CORE_DEPS,
    devDependencies: CORE_DEV_DEPS,
  },
  {
    name: "area-chart",
    title: "Dither Area & Line Chart",
    description:
      "Composable dithered area + line charts — children-as-config API with the ordered-dither fill, winking sparkles, a gliding scrub tooltip, selection, and colour bloom. Includes Sparkline. Inspired by Evil Charts (evilcharts.com).",
    categories: ["charts"],
    files: ["area-chart.tsx", "cartesian-canvas.tsx", "area.tsx", "sparkline.tsx"],
    registryDependencies: [`${NS}/core`],
    dependencies: [],
    devDependencies: [],
  },
  {
    name: "bar-chart",
    title: "Dither Bar Chart",
    description:
      "Composable dithered bar chart — grouped or stacked, with a staggered grow-in wave, the ordered-dither fill, scrub tooltip, selection, and colour bloom. Inspired by Evil Charts (evilcharts.com).",
    categories: ["charts"],
    files: ["bar-chart.tsx", "bar-canvas.tsx", "bar.tsx"],
    registryDependencies: [`${NS}/core`],
    dependencies: [],
    devDependencies: [],
  },
  {
    name: "pie-chart",
    title: "Dither Pie / Donut Chart",
    description:
      "Composable dithered pie / donut chart — per-pixel radial dither, clockwise sweep-in, slice hover-pop, and colour bloom. Inspired by Evil Charts (evilcharts.com).",
    categories: ["charts"],
    files: ["pie-chart.tsx", "pie-canvas.tsx", "pie.tsx"],
    registryDependencies: [`${NS}/core`],
    dependencies: [],
    devDependencies: [],
  },
  {
    name: "radar-chart",
    title: "Dither Radar Chart",
    description:
      "Composable dithered radar chart — polygon-membership dither, scale-in entrance, vertex markers, the dither frame, and colour bloom. Inspired by Evil Charts (evilcharts.com).",
    categories: ["charts"],
    files: ["radar-chart.tsx", "radar-canvas.tsx", "radar.tsx", "radar-frame.tsx"],
    registryDependencies: [`${NS}/core`],
    dependencies: [],
    devDependencies: [],
  },
  {
    name: "dither-kit",
    title: "Dither Kit — Everything",
    description:
      "All of Dither Kit: area, line, bar, pie, and radar dithered charts on one tiny canvas engine. Inspired by Evil Charts (evilcharts.com).",
    categories: ["charts"],
    // The barrel only ships here — it re-exports every chart, so it is only
    // valid when everything is installed.
    files: ["index.ts"],
    registryDependencies: [
      `${NS}/area-chart`,
      `${NS}/bar-chart`,
      `${NS}/pie-chart`,
      `${NS}/radar-chart`,
    ],
    dependencies: [],
    devDependencies: [],
  },
]

mkdirSync(OUT, { recursive: true })

function fileEntry(name: string) {
  return {
    path: `${TARGET_DIR}/${name}`,
    type: "registry:component",
    target: `${TARGET_DIR}/${name}`,
    content: readFileSync(join(SRC, name), "utf8"),
  }
}

// Per-item registry files, content inlined — served at r/<item>.json. Validated
// against the shared schema so the CLI can trust every field it reads.
for (const it of ITEMS) {
  const json: RegistryItem = RegistryItemSchema.parse({
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: it.name,
    type: "registry:component",
    title: it.title,
    description: it.description,
    author: AUTHOR,
    categories: it.categories,
    version: VERSION,
    dependencies: it.dependencies,
    devDependencies: it.devDependencies,
    registryDependencies: it.registryDependencies.map(depUrl),
    files: it.files.map(fileEntry),
  })
  writeFileSync(join(OUT, `${it.name}.json`), `${JSON.stringify(json, null, 2)}\n`)
}

// Registry index — the list the CLI fetches. No inline content (it resolves
// each item's own r/<name>.json), but carries categories + version for grouping
// and update/diff.
const nsRegistry = RegistrySchema.parse({
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: "dither-kit",
  homepage: HOMEPAGE,
  items: ITEMS.map((it) => ({
    name: it.name,
    type: "registry:component",
    title: it.title,
    description: it.description,
    categories: it.categories,
    version: VERSION,
    dependencies: it.dependencies,
    registryDependencies: it.registryDependencies.map(depUrl),
    files: it.files.map((name) => ({
      path: `${TARGET_DIR}/${name}`,
      type: "registry:component",
      target: `${TARGET_DIR}/${name}`,
    })),
  })),
})
writeFileSync(join(OUT, "registry.json"), `${JSON.stringify(nsRegistry, null, 2)}\n`)

// Repo-root registry — powers the zero-config GitHub shorthand. No inline
// content (shadcn reads sources from the repo); deps use owner/repo/<item>.
const githubRegistry = RegistrySchema.parse({
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: "dither-kit",
  homepage: HOMEPAGE,
  items: ITEMS.map((it) => ({
    name: it.name,
    type: "registry:component",
    title: it.title,
    description: it.description,
    categories: it.categories,
    version: VERSION,
    dependencies: it.dependencies,
    registryDependencies: it.registryDependencies.map((d) => d.replace(`${NS}/`, `${REPO}/`)),
    files: it.files.map((name) => ({
      path: `${SRC_REL}/${name}`,
      type: "registry:component",
      target: `${TARGET_DIR}/${name}`,
    })),
  })),
})
writeFileSync(join(ROOT, "registry.json"), `${JSON.stringify(githubRegistry, null, 2)}\n`)

const total = ITEMS.reduce((n, it) => n + it.files.length, 0)
console.log(
  `registry: wrote ${ITEMS.length} items (${total} file refs) → r/{${ITEMS.map((i) => i.name).join(",")}}.json + r/registry.json + registry.json`,
)
