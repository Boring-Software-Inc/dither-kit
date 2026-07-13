import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  RegistryItemSchema,
  RegistrySchema,
  type Registry,
  type RegistryItem,
} from "@dither-kit/registry-core"
import { cacheDir as defaultCacheDir } from "./cache.js"
import type { Context } from "./context.js"
import { registryIndexUrl, registryItemUrl } from "./env.js"
import { CliError, ExitCode } from "./errors.js"
import { fetchText as defaultFetchText } from "./net.js"

/** How long a cached registry index is considered fresh. */
export const DEFAULT_TTL_MS = 60 * 60 * 1000 // 1 hour

/** Injectable seams so the network + disk can be faked in tests. */
export interface RegistryDeps {
  cacheDir?: string
  fetchText?: (url: string) => Promise<{ text: string; note?: string }>
  ttlMs?: number
  now?: () => number
}

export type RegistrySourceKind = "network" | "cache" | "stale"

export interface RegistryResult {
  registry: Registry
  source: RegistrySourceKind
  /** When the cached copy we used (or refreshed) was fetched. */
  fetchedAt?: number
  /** A non-fatal note (e.g. proxy unavailable) worth surfacing under --debug. */
  note?: string
}

interface CacheEnvelope {
  fetchedAt: number
  base: string
  registry: unknown
}

function readCache(path: string): CacheEnvelope | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as CacheEnvelope
  } catch {
    return null
  }
}

function writeCache(path: string, env: CacheEnvelope): void {
  try {
    mkdirSync(join(path, ".."), { recursive: true })
    writeFileSync(path, `${JSON.stringify(env)}\n`)
  } catch {
    // A cache we cannot write is not fatal — we just lose offline support.
  }
}

/**
 * Fetch the registry index, using the XDG cache with a TTL and a
 * stale-while-offline fallback. Adding a component to the registry makes it
 * installable with no CLI release because this list is always fetched, never
 * hardcoded.
 */
export async function getRegistry(
  ctx: Context,
  deps: RegistryDeps = {},
): Promise<RegistryResult> {
  const dir = deps.cacheDir ?? defaultCacheDir()
  const fetchText = deps.fetchText ?? defaultFetchText
  const ttl = deps.ttlMs ?? DEFAULT_TTL_MS
  const now = deps.now ?? Date.now
  const base = ctx.registry
  const cachePath = join(dir, "registry.json")

  const cached = readCache(cachePath)
  const cacheUsable = cached && cached.base === base

  // Fresh cache: skip the network entirely.
  if (cacheUsable && now() - cached.fetchedAt < ttl) {
    const parsed = RegistrySchema.safeParse(cached.registry)
    if (parsed.success) {
      return { registry: parsed.data, source: "cache", fetchedAt: cached.fetchedAt }
    }
  }

  // Otherwise go to the network.
  try {
    const { text, note } = await fetchText(registryIndexUrl(base))
    const registry = parseRegistry(text)
    const fetchedAt = now()
    writeCache(cachePath, { fetchedAt, base, registry })
    return { registry, source: "network", fetchedAt, note }
  } catch (err) {
    // Registry unreachable ⇒ fall back to cache and SAY SO (the caller warns).
    if (cacheUsable) {
      const parsed = RegistrySchema.safeParse(cached.registry)
      if (parsed.success) {
        return { registry: parsed.data, source: "stale", fetchedAt: cached.fetchedAt }
      }
    }
    if (err instanceof CliError) throw err
    throw new CliError(
      `could not reach the registry and no cached copy is available`,
      ExitCode.Network,
    )
  }
}

function parseRegistry(text: string): Registry {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new CliError("registry returned malformed JSON", ExitCode.Network)
  }
  const parsed = RegistrySchema.safeParse(raw)
  if (!parsed.success) {
    throw new CliError("registry JSON did not match the expected shape", ExitCode.Network)
  }
  return parsed.data
}

export interface ItemResult {
  item: RegistryItem
  source: RegistrySourceKind
}

/**
 * Resolve a single item's full registry JSON (files + content inlined). Used to
 * compute lockfile hashes and to describe a dry run. Falls back to a cached
 * copy when offline.
 */
export async function resolveItem(
  ctx: Context,
  name: string,
  deps: RegistryDeps = {},
): Promise<ItemResult> {
  const dir = deps.cacheDir ?? defaultCacheDir()
  const fetchText = deps.fetchText ?? defaultFetchText
  const itemCachePath = join(dir, "items", `${name}.json`)

  try {
    const { text } = await fetchText(registryItemUrl(ctx.registry, name))
    const item = parseItem(text, name)
    writeCache(itemCachePath, { fetchedAt: (deps.now ?? Date.now)(), base: ctx.registry, registry: item })
    return { item, source: "network" }
  } catch (err) {
    const cached = readCache(itemCachePath)
    if (cached && cached.base === ctx.registry) {
      const parsed = RegistryItemSchema.safeParse(cached.registry)
      if (parsed.success) return { item: parsed.data, source: "stale" }
    }
    if (err instanceof CliError) throw err
    throw new CliError(`could not resolve “${name}” from the registry`, ExitCode.Network)
  }
}

function parseItem(text: string, name: string): RegistryItem {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new CliError(`registry returned malformed JSON for “${name}”`, ExitCode.Network)
  }
  const parsed = RegistryItemSchema.safeParse(raw)
  if (!parsed.success) {
    throw new CliError(`registry JSON for “${name}” did not match the expected shape`, ExitCode.Network)
  }
  return parsed.data
}

/** Map a registryDependency reference to an item name. Handles the three forms
 * the registry can carry: an absolute URL (`…/r/core.json`), the namespaced
 * `@dither-kit/core`, or a bare `core`. */
export function depName(dep: string): string {
  if (dep.includes("/")) {
    const last = dep.split("/").pop() ?? dep
    return last.replace(/\.json$/, "").replace(/^@[^/]+\//, "")
  }
  return dep
}

/**
 * The full install closure for `names`: the requested items plus every item
 * reachable through registryDependencies, de-duplicated. `shadcn add` expands
 * these itself, but the lockfile records the whole set so `update`/`diff` cover
 * `core` too. Dependencies come first so a consumer reading the list installs
 * bottom-up.
 */
export function closure(names: string[], registry: Registry): RegistryItem[] {
  const byName = new Map(registry.items.map((it) => [it.name, it]))
  const out: RegistryItem[] = []
  const seen = new Set<string>()
  const visit = (name: string) => {
    if (seen.has(name)) return
    seen.add(name)
    const item = byName.get(name)
    if (!item) return
    for (const dep of item.registryDependencies) visit(depName(dep))
    out.push(item)
  }
  for (const name of names) visit(name)
  return out
}

/** Group items by their first category, in a stable, human order. Items with no
 * category land under "other". */
export function groupByCategory(registry: Registry): Map<string, RegistryItem[]> {
  const order = ["charts", "buttons", "gradients", "avatars", "core", "other"]
  const groups = new Map<string, RegistryItem[]>()
  for (const item of registry.items) {
    const cat = item.categories[0] ?? "other"
    const list = groups.get(cat) ?? []
    list.push(item)
    groups.set(cat, list)
  }
  // Re-key into the preferred order, appending any unknown categories after.
  const ordered = new Map<string, RegistryItem[]>()
  for (const cat of order) if (groups.has(cat)) ordered.set(cat, groups.get(cat)!)
  for (const [cat, list] of groups) if (!ordered.has(cat)) ordered.set(cat, list)
  return ordered
}
