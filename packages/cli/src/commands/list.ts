import type { Context } from "../context.js"
import { Logger, data, json } from "../output.js"
import { findComponentsJson } from "../project.js"
import { groupByCategory } from "../registry.js"
import { readLockfile } from "../lockfile.js"
import { loadRegistry } from "./shared.js"
import type { RegistryDeps } from "../registry.js"

/** Human-readable label for a category heading. */
function categoryLabel(cat: string): string {
  if (cat === "core") return "Core (installed automatically)"
  return cat.charAt(0).toUpperCase() + cat.slice(1)
}

export async function list(ctx: Context, deps: RegistryDeps = {}): Promise<number> {
  const log = new Logger(ctx)
  const registry = await loadRegistry(ctx, log, deps)

  // Installed status is best-effort: only if this is a project with a lockfile.
  const root = findComponentsJson(ctx.dir)
  const lock = root ? readLockfile(root) : null
  const installed = new Map<string, string>()
  if (lock) for (const [name, c] of Object.entries(lock.components)) installed.set(name, c.version)

  if (ctx.json) {
    json({
      registry: ctx.registry,
      items: registry.items.map((it) => ({
        name: it.name,
        title: it.title,
        description: it.description,
        categories: it.categories,
        version: it.version,
        installed: installed.has(it.name),
        installedVersion: installed.get(it.name) ?? null,
      })),
    })
    return 0
  }

  if (ctx.plain) {
    // One record per line, tab-separated: name, category, version, installed.
    for (const it of registry.items) {
      const cat = it.categories[0] ?? "other"
      data(`${it.name}\t${cat}\t${it.version}\t${installed.has(it.name) ? "installed" : "available"}`)
    }
    return 0
  }

  const { c } = ctx
  const groups = groupByCategory(registry)
  for (const [cat, items] of groups) {
    data(c.bold(categoryLabel(cat)))
    for (const it of items) {
      const mark = installed.has(it.name) ? c.green("●") : c.dim("○")
      const ver = installed.has(it.name) ? c.dim(`v${installed.get(it.name)}`) : c.dim(`v${it.version}`)
      data(`  ${mark} ${it.name.padEnd(14)} ${ver}`)
      data(`    ${c.dim(it.description)}`)
    }
    data("")
  }

  log.info(`${c.green("●")} installed   ${c.dim("○")} available`)
  log.next("dither-kit add <name>")
  return 0
}
