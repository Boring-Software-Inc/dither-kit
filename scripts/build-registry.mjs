// Builds the Dither Kit shadcn registry — one item per chart, plus a shared
// `core` engine they all depend on.
//
//   npm run build   (or: node scripts/build-registry.mjs)
//
// Emits two things from the sources in registry/dither-kit/:
//   • registry.json at the repo root — powers shadcn's zero-config GitHub
//     shorthand: `npx shadcn@latest add Boring-Software-Inc/dither-kit/<item>`.
//     File paths are repo-relative sources; no inline content (the CLI reads
//     each file straight from the repo), and deps use the owner/repo/<item>
//     address so `core` resolves without any components.json.
//   • r/<item>.json + r/registry.json — a host-agnostic namespace registry
//     (content inlined) for anyone serving it under a "@dither-kit" namespace.
//
// Dither Kit is heavily inspired by Evil Charts (https://evilcharts.com,
// https://github.com/legions-developer/evilcharts).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SRC = join(ROOT, "registry/dither-kit")
const OUT = join(ROOT, "r")

// Where files land in a consumer's project (relative to its root).
const TARGET_DIR = "components/dither-kit"
const NS = "@dither-kit"
const HOMEPAGE = "https://tripwire.sh/dither-kit"
const AUTHOR = "ripgrim"

// GitHub repo backing the zero-config shorthand. The CLI reads registry.json at
// the repo root and pulls each file straight from the repo.
const REPO = "Boring-Software-Inc/dither-kit"
const SRC_REL = "registry/dither-kit"

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

const ITEMS = [
  {
    name: "core",
    title: "Dither Kit — Core",
    description:
      "Shared engine for Dither Kit: contexts, d3 scales, the ordered-dither canvas painter, the canvas-agnostic chart shells, and the legend/tooltip/grid/axes/dot chrome. Installed automatically by every chart.",
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
    files: ["radar-chart.tsx", "radar-canvas.tsx", "radar.tsx", "radar-frame.tsx"],
    registryDependencies: [`${NS}/core`],
    dependencies: [],
    devDependencies: [],
  },
  {
    name: "avatar",
    title: "Dither Avatar",
    description:
      "Generative mirrored pixel avatars in the ordered-dither texture — ~1.5 trillion combinations from a name, deterministic, with a hue override and a Bayer-ordered materialize entrance. Standalone: installs without the chart engine.",
    // Standalone on purpose — shares only the pixel primitives + palette, so a
    // footer avatar row doesn't pull in d3/motion.
    files: ["avatar.tsx", "pixel.ts", "palette.ts", "lib.ts"],
    registryDependencies: [],
    dependencies: ["clsx", "tailwind-merge"],
    devDependencies: [],
  },
  {
    name: "gradient",
    title: "Dither Gradient",
    description:
      "Dithered gradient washes for backgrounds — footer glows, section fades, card backdrops. Dissolves to transparent or dither-blends two colours, any direction, with optional bloom. Standalone: installs without the chart engine.",
    files: ["gradient.tsx", "pixel.ts", "palette.ts", "lib.ts"],
    registryDependencies: [],
    dependencies: ["clsx", "tailwind-merge"],
    devDependencies: [],
  },
  {
    name: "dither-kit",
    title: "Dither Kit — Everything",
    description:
      "All of Dither Kit: area, line, bar, pie, and radar dithered charts on one tiny canvas engine, plus generative dithered avatars and gradient washes. Inspired by Evil Charts (evilcharts.com).",
    // The barrel only ships here — it re-exports every piece, so it is only
    // valid when everything is installed.
    files: ["index.ts"],
    registryDependencies: [
      `${NS}/area-chart`,
      `${NS}/bar-chart`,
      `${NS}/pie-chart`,
      `${NS}/radar-chart`,
      `${NS}/avatar`,
      `${NS}/gradient`,
    ],
    dependencies: [],
    devDependencies: [],
  },
]

mkdirSync(OUT, { recursive: true })

function fileEntry(name) {
  return {
    path: `${TARGET_DIR}/${name}`,
    type: "registry:component",
    target: `${TARGET_DIR}/${name}`,
    content: readFileSync(join(SRC, name), "utf8"),
  }
}

// Namespace registry — per-item files with content inlined (host-agnostic).
for (const it of ITEMS) {
  const json = {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: it.name,
    type: "registry:component",
    title: it.title,
    description: it.description,
    author: AUTHOR,
    dependencies: it.dependencies,
    devDependencies: it.devDependencies,
    registryDependencies: it.registryDependencies,
    files: it.files.map(fileEntry),
  }
  writeFileSync(join(OUT, `${it.name}.json`), `${JSON.stringify(json, null, 2)}\n`)
}

const nsRegistry = {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: "dither-kit",
  homepage: HOMEPAGE,
  items: ITEMS.map((it) => ({
    name: it.name,
    type: "registry:component",
    title: it.title,
    description: it.description,
    dependencies: it.dependencies,
    registryDependencies: it.registryDependencies,
    files: it.files.map((name) => ({
      path: `${TARGET_DIR}/${name}`,
      type: "registry:component",
      target: `${TARGET_DIR}/${name}`,
    })),
  })),
}
writeFileSync(join(OUT, "registry.json"), `${JSON.stringify(nsRegistry, null, 2)}\n`)

// Repo-root registry — powers the zero-config GitHub shorthand. No inline
// content (the CLI reads sources from the repo); deps use owner/repo/<item>.
const githubRegistry = {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: "dither-kit",
  homepage: HOMEPAGE,
  items: ITEMS.map((it) => ({
    name: it.name,
    type: "registry:component",
    title: it.title,
    description: it.description,
    dependencies: it.dependencies,
    registryDependencies: it.registryDependencies.map((d) =>
      d.replace(`${NS}/`, `${REPO}/`)
    ),
    files: it.files.map((name) => ({
      path: `${SRC_REL}/${name}`,
      type: "registry:component",
      target: `${TARGET_DIR}/${name}`,
    })),
  })),
}
writeFileSync(join(ROOT, "registry.json"), `${JSON.stringify(githubRegistry, null, 2)}\n`)

const total = ITEMS.reduce((n, it) => n + it.files.length, 0)
console.log(
  `registry: wrote ${ITEMS.length} items (${total} file refs) → r/{${ITEMS.map((i) => i.name).join(",")}}.json + r/registry.json + registry.json`
)
