# AGENTS.md

Three rules this repo lives by. Break them and something downstream breaks.

### 1. The registry JSON is generated, never hand-edited

`registry.json` and everything under `r/` are build artifacts of
`scripts/build-registry.mts` (run `npm run build:registry`). The source of truth
is `registry/dither-kit/` (the component code) plus the item definitions in the
build script. If you need to change what's in the registry, change those — then
regenerate. Editing `r/*.json` by hand will be silently overwritten.

The shape of every item is enforced by `@dither-kit/registry-core` (a zod schema
that is the *single* definition — the build script, the CLI, and any consumer
import it). The build validates its output against that schema, so a malformed
item fails the build rather than shipping.

### 2. Components depend only on react + a short, fixed dependency list

A Dither Kit component may import from `react` and from exactly these runtime
packages: `motion`, `d3-scale`, `d3-shape`, `clsx`, `tailwind-merge`. That's it.
No shadcn coupling (the kit ships its own `cn()`), no other runtime deps. Tailwind
is a hard requirement for styling but is the consumer's, not a bundled dep. Adding
a new import outside this set is a breaking change to the whole kit's promise.

### 3. The CLI delegates all file writes to shadcn

`@dither-kit/cli` owns UX, name resolution, and the lockfile. It does **not**
write component files itself: it resolves a component to its registry URL and
spawns `shadcn add <url>`. shadcn already handles `components.json` aliases,
Tailwind paths, dependency installation, and path resolution — reimplementing any
of that in the CLI is a bug, not a feature.
