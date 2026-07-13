# Contributing

This is a small monorepo (npm workspaces):

- `registry/dither-kit/` — the component sources (the source of truth).
- `packages/registry-core/` — `@dither-kit/registry-core`: the one shared zod
  schema for the registry item shape and the CLI lockfile. Everything else
  imports it; do not hand-write a parallel copy of these shapes.
- `packages/cli/` — `@dither-kit/cli`: the installer (`dither-kit`).
- `scripts/build-registry.mts` — regenerates `r/` and `registry.json` from the
  sources. See rule #1 in [`AGENTS.md`](./AGENTS.md).

## Setup

```bash
npm install
npm run build          # builds registry-core, regenerates the registry, builds the CLI
```

Individual steps:

```bash
npm run build:core       # build @dither-kit/registry-core (do this before the others)
npm run build:registry   # regenerate r/*.json + registry.json
npm run build:cli        # build the CLI
npm test                 # component tests (vitest) + CLI tests (node:test)
```

CLI-only loop:

```bash
npm run test -w @dither-kit/cli
npm run typecheck -w @dither-kit/cli
```

## Testing the CLI against a local registry

The CLI's registry host is **hardcoded** to `https://tripwire.sh` — there is no
`--registry` flag and no supported way to point it at a third-party registry.
This is a dither-kit installer, not a generic shadcn-registry tool.

For local development only, the CLI reads a `DITHER_KIT_REGISTRY` environment
variable so you can test against a registry you're serving yourself before the
tripwire.sh host is live. It is **fail-closed**: it is ignored unless
`NODE_ENV=development` (or `DITHER_KIT_DEV=1`) is set. Do not document it for
users, and do not rely on it in production.

```bash
# serve the generated registry locally
python3 -m http.server 8791 &

# point the CLI at it (dev-gated)
NODE_ENV=development DITHER_KIT_REGISTRY=http://127.0.0.1:8791 \
  node packages/cli/dist/index.js list
```

## Other environment variables

- `DITHER_KIT_TIMEOUT` — network timeout in ms (default 10000).
- `DITHER_KIT_SHADCN` — the shadcn spec to invoke (default `shadcn@latest`),
  handy for pinning during development.
- Standard ones are honoured: `NO_COLOR`, `FORCE_COLOR`, `TERM=dumb`, `DEBUG`,
  `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`, and the XDG base dirs.

## Ground rules

Read [`AGENTS.md`](./AGENTS.md). In short: the registry is generated (never
hand-edit `r/`), components depend only on react + motion/d3-scale/d3-shape/clsx/
tailwind-merge, and the CLI delegates every file write to shadcn.
