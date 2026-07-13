// Where the registry lives. This is a dither-kit installer, not a generic
// shadcn-registry tool: the base URL is hardcoded. There is deliberately no
// --registry flag and no supported way for a stranger to point this CLI at
// their own registry.
//
// DITHER_KIT_REGISTRY exists ONLY as a dev/CI affordance so the CLI can be
// tested against a local registry before the tripwire.sh host move lands. It is
// fail-closed: ignored unless we are explicitly in development. It is not
// documented for users (see CONTRIBUTING).

export const DEFAULT_REGISTRY = "https://tripwire.sh"

/** True when the dev-only registry override is permitted to take effect. */
export function devOverrideAllowed(): boolean {
  return process.env.NODE_ENV === "development" || isTruthy(process.env.DITHER_KIT_DEV)
}

/** True when an override was requested but refused because we are not in dev —
 * surfaced under --debug so a misconfigured CI is diagnosable. */
export function registryOverrideIgnored(): boolean {
  return Boolean(process.env.DITHER_KIT_REGISTRY) && !devOverrideAllowed()
}

/** The registry base URL, with no trailing slash. */
export function registryBase(): string {
  const override = process.env.DITHER_KIT_REGISTRY
  if (override && devOverrideAllowed()) return override.replace(/\/+$/, "")
  return DEFAULT_REGISTRY
}

/** URL of the registry index (the list of installable items). */
export function registryIndexUrl(base: string): string {
  return `${base}/r/registry.json`
}

/** URL of a single item's registry JSON (content inlined). */
export function registryItemUrl(base: string, name: string): string {
  return `${base}/r/${name}.json`
}

function isTruthy(v: string | undefined): boolean {
  return v !== undefined && v !== "" && v !== "0" && v.toLowerCase() !== "false"
}
