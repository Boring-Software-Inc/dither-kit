# Hosting the registry

The registry is served from **`https://tripwire.sh/r/{name}.json`**. This is the
CLI's only home: `@dither-kit/cli` hardcodes `https://tripwire.sh` as the base and
fetches `https://tripwire.sh/r/registry.json` to discover what's installable.
Serving from our own domain (rather than `raw.githubusercontent.com`) is what
makes usage measurable at all — request logs for `tripwire.sh/r/*` are the passive
analytics signal (see the CLI README's note on analytics; the CLI itself sends
nothing).

## What gets served

The generated files under `r/` map 1:1 to URLs:

| File | URL | Purpose |
| --- | --- | --- |
| `r/registry.json` | `https://tripwire.sh/r/registry.json` | The index the CLI fetches to list/resolve components. |
| `r/<name>.json` | `https://tripwire.sh/r/<name>.json` | One item, content inlined + `registryDependencies` as absolute URLs, handed to `shadcn add`. |

Because each item's `registryDependencies` are **absolute** `…/r/<dep>.json`
URLs, `shadcn add https://tripwire.sh/r/area-chart.json` resolves `core`
transitively with zero `components.json` registry configuration.

## Deployment

1. Publish the contents of `r/` at the site root under `/r/`. Any static host or
   CDN works; the files are immutable per release and safe to cache. Suggested
   headers:
   - `Content-Type: application/json`
   - `Cache-Control: public, max-age=300` (the CLI also caches locally with a
     1-hour TTL and a stale-while-offline fallback, so a short edge TTL is fine).
   - `Access-Control-Allow-Origin: *` (so browser-based tooling can read it too).
2. Regenerate on every change: `npm run build:registry` writes `r/` and the
   repo-root `registry.json`. CI should run this and fail if `r/` is dirty
   afterward (guarantees rule #1 in `AGENTS.md`).

## 302s from the old raw URLs (planned)

Existing installs point at the GitHub raw registry shorthand
(`Boring-Software-Inc/dither-kit/<item>`, backed by the repo-root
`registry.json`). To move traffic without breaking them:

- Keep the repo-root `registry.json` working for the shadcn GitHub shorthand
  (it uses `owner/repo/<item>` dependency refs, not tripwire URLs — unchanged).
- For any direct links to the previous
  `https://raw.githubusercontent.com/Boring-Software-Inc/dither-kit/main/r/<name>.json`
  style URLs, add **302 (temporary) redirects** to the matching
  `https://tripwire.sh/r/<name>.json`. 302 (not 301) so the canonical host can
  still change later, and so intermediaries don't cache the redirect forever.
- Once request logs show the raw URLs are cold, the redirects can retire.

Until the redirects are live, nothing regresses: the GitHub shorthand keeps
working off the repo, and the CLI already targets `tripwire.sh`.
