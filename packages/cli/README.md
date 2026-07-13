# @dither-kit/cli

The installer for [Dither Kit](https://tripwire.sh/dither-kit) — composable,
dithered charts for shadcn/ui. It adds components to your project, and keeps a
lockfile so you can **update** and **diff** them later (something copy-in
components otherwise can't do).

## Requires Tailwind CSS

**Dither Kit components are styled with Tailwind. Without Tailwind set up in your
project, they render unstyled.** Install and configure
[Tailwind](https://tailwindcss.com/docs/installation) first. You also need a
shadcn project — a `components.json` at your project root
(`npx shadcn@latest init` creates one). The CLI checks for both and tells you
what's missing.

## Install

No install needed — run it with your package runner:

```bash
npx @dither-kit/cli add area-chart
# or: pnpm dlx @dither-kit/cli …  ·  yarn dlx @dither-kit/cli …  ·  bunx @dither-kit/cli …
```

Or add it as a dev dependency to get the `dither-kit` binary:

```bash
npm i -D @dither-kit/cli
dither-kit add area-chart
```

## Commands

### `dither-kit` — help

Bare invocation prints concise help with examples. `-h` / `--help` (and
`dither-kit help <command>`) show full help for any command.

### `dither-kit add [names...]` — install components

```bash
dither-kit add area-chart              # one component (pulls in `core` automatically)
dither-kit add bar-chart pie-chart     # several at once
dither-kit add                         # no names → pick from a grouped menu
dither-kit add pie-chart --dry-run     # show exactly what would be written, write nothing
```

Resolution and the lockfile are ours; the actual file write is delegated to
`shadcn add`, which handles your `components.json` aliases, Tailwind paths, and
dependency install. After installing, the CLI records each component (with its
version and a content hash) in `dither-kit.json`. Mistype a name and it suggests
the nearest match and asks — it never silently runs the corrected command.

### `dither-kit list` — what's available

```bash
dither-kit list                        # grouped by category, ● installed / ○ available
dither-kit list --json | jq '.items'   # machine-readable
dither-kit list --plain                # one tab-separated record per line
```

The component list is fetched from the registry at runtime, so new components
become installable without a CLI release.

### `dither-kit init` — set up the project

```bash
dither-kit init                        # asks the one question that matters
dither-kit init --mode source          # …or answer it up front (scriptable)
```

Verifies Tailwind + `components.json`, asks whether you want the source copied in
(the shadcn way) or — later — installed as a package, and writes a
`dither-kit.json` lockfile.

### `dither-kit update` — pull upstream changes

```bash
dither-kit update                      # "area-chart 1.2.0 → 1.4.0, apply?"
dither-kit update --yes                # apply without prompting (CI)
dither-kit update --dry-run            # list what's available, change nothing
```

Lockfile-driven: compares your installed components against the current registry
by content hash and re-adds the changed ones (with `--overwrite`), refreshing the
lockfile.

### `dither-kit diff` — see what changed

```bash
dither-kit diff                        # local edits vs. lockfile, and upstream vs. lockfile
dither-kit diff --json
```

Shows which files you've modified locally and, where the registry has moved on, a
compact patch of what changed upstream.

## Global flags

| flag | effect |
| --- | --- |
| `--dir <path>` | operate on this project instead of the current directory |
| `-y, --yes` | skip confirmation prompts |
| `--overwrite` | overwrite existing files |
| `-n, --dry-run` | describe what would happen; write nothing |
| `--no-input` | never prompt; fail (naming the flag to pass) if a value is required |
| `--json` | machine-readable JSON on stdout |
| `--plain` | plain, tab-separated output for grep/awk |
| `--no-color` | disable colour |
| `-q, --quiet` | suppress non-essential output |
| `--debug` | show internal detail (or set `DEBUG`) |
| `--version`, `-h`/`--help` | version / help |

Every interactive path has a flag equivalent, so the whole CLI is scriptable.
Primary output goes to stdout; status, progress, prompts, and errors go to
stderr — so `dither-kit list --json | jq` is always clean. Colour and spinners
are used only when stdout is a TTY (and are disabled by `NO_COLOR`, `TERM=dumb`,
or `--no-color`). Ctrl-C exits immediately and cleanly.

## Exit codes

`0` success · `1` generic error · `2` usage · `3` registry unreachable (no
cache) · `4` no `components.json` · `5` missing input under `--no-input` · `6`
`shadcn add` failed · `7` unknown component · `130` cancelled.

## Analytics

The CLI reports **anonymous, non-PII product events** so we can see which
commands and components people actually use:

| event | when |
| --- | --- |
| `cli_run` | every invocation (command, exit code, duration) |
| `cli_add` | after a resolved add (component names, dry-run flag) |
| `cli_list` / `cli_init` / `cli_update` / `cli_diff` | on successful command |

Events POST to `https://tripwire.sh/r/cli-event` (no secrets in the package);
Tripwire forwards them to Databuddy. A random id is stored under
`~/.cache/dither-kit/anon-id` so runs on the same machine correlate without
identifying you. Failures are swallowed — analytics never changes exit codes.

**Opt out:**

```bash
export DO_NOT_TRACK=1
# or
export DITHER_KIT_TELEMETRY=0
```

Per-item install volume is also measured server-side when the registry is
fetched (`registry_install` on `tripwire.sh/r/<item>.json`).

## Configuration

Network timeout is configurable with `DITHER_KIT_TIMEOUT` (ms). `HTTP_PROXY` /
`HTTPS_PROXY` / `NO_PROXY` are honoured. The registry index is cached in your XDG
cache dir (`~/.cache/dither-kit`) with a 1-hour TTL and a stale-while-offline
fallback — if the registry is unreachable, the CLI uses the cached copy and says
so.

---

Docs & live demos → **[tripwire.sh/dither-kit](https://tripwire.sh/dither-kit)**
