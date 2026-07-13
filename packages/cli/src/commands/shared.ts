import type { Registry } from "@dither-kit/registry-core"
import type { Context } from "../context.js"
import { registryOverrideIgnored } from "../env.js"
import type { Logger } from "../output.js"
import { getRegistry, type RegistryDeps } from "../registry.js"

/**
 * Load the registry for a command, emitting the honest status the user needs:
 * a warning when we fell back to a stale cache, and debug notes for proxy /
 * dev-override situations. Returns just the registry — most commands don't care
 * how it was sourced beyond the warning.
 */
export async function loadRegistry(
  ctx: Context,
  log: Logger,
  deps: RegistryDeps = {},
): Promise<Registry> {
  if (registryOverrideIgnored()) {
    log.debug("DITHER_KIT_REGISTRY is set but ignored (not in development)")
  }
  const spin = log.spinner("Fetching the registry")
  try {
    const result = await getRegistry(ctx, deps)
    spin.stop()
    if (result.note) log.debug(result.note)
    if (result.source === "stale") {
      const when = result.fetchedAt ? new Date(result.fetchedAt).toLocaleString() : "an earlier run"
      log.warn(`registry unreachable — using the cached copy from ${when}.`)
    }
    return result.registry
  } catch (err) {
    spin.stop()
    throw err
  }
}
