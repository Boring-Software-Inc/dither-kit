import type { RegistryItem } from "@dither-kit/registry-core"
import type { Context } from "../context.js"
import { registryItemUrl } from "../env.js"
import { CliError, ExitCode } from "../errors.js"
import { lockComponentFor, readLockfile, writeLockfile } from "../lockfile.js"
import { Logger, json } from "../output.js"
import { requireProject } from "../project.js"
import { resolveItem, type RegistryDeps } from "../registry.js"
import { runShadcnAdd } from "../shadcn.js"
import { confirmYes } from "../ui.js"
import { loadRegistry } from "./shared.js"

interface Upgrade {
  name: string
  from: string
  to: string
  item: RegistryItem
}

export async function update(ctx: Context, deps: RegistryDeps = {}): Promise<number> {
  const log = new Logger(ctx)
  const project = requireProject(ctx)
  const lock = readLockfile(project.root)
  if (!lock || Object.keys(lock.components).length === 0) {
    throw new CliError(
      "no installed components to update.",
      ExitCode.NotFound,
      "Run `dither-kit add <name>` to install something first.",
    )
  }

  const registry = await loadRegistry(ctx, log, deps)
  const byName = new Map(registry.items.map((it) => [it.name, it]))

  // Compare each locked component against the current registry by content hash;
  // the version transition is what we show the user.
  const upgrades: Upgrade[] = []
  for (const [name, locked] of Object.entries(lock.components)) {
    const indexItem = byName.get(name)
    if (!indexItem) {
      log.debug(`"${name}" is installed but no longer in the registry — skipping.`)
      continue
    }
    const { item } = await resolveItem(ctx, name, deps)
    const current = lockComponentFor(item)
    if (current.hash !== locked.hash) {
      upgrades.push({ name, from: locked.version, to: item.version, item })
    }
  }

  if (upgrades.length === 0) {
    if (ctx.json) json({ upToDate: true, updates: [] })
    else log.step("Everything is up to date.")
    return 0
  }

  if (ctx.json) {
    json({
      upToDate: false,
      updates: upgrades.map((u) => ({ name: u.name, from: u.from, to: u.to })),
    })
    if (!ctx.yes) return 0 // JSON callers apply explicitly with --yes
  } else {
    log.info(ctx.c.bold("Updates available:"))
    for (const u of upgrades) {
      const arrow = u.from === u.to ? "content changed" : `${u.from} → ${u.to}`
      log.info(`  ${ctx.c.cyan(u.name)}  ${ctx.c.dim(arrow)}`)
    }
  }

  if (ctx.dryRun) {
    log.info(ctx.c.dim("\nDry run — nothing will be written."))
    return 0
  }

  // Confirm before overwriting files. Scriptable via --yes.
  if (!ctx.yes) {
    if (!ctx.interactive) {
      throw new CliError(
        "updates are available but need confirmation.",
        ExitCode.MissingInput,
        "Re-run with --yes to apply them non-interactively.",
      )
    }
    const ok = await confirmYes(`Apply ${upgrades.length} update${upgrades.length === 1 ? "" : "s"}?`)
    if (!ok) {
      log.info("No changes made.")
      return 0
    }
  }

  // Re-add the changed items (with overwrite) and refresh their lock entries.
  const urls = upgrades.map((u) => registryItemUrl(ctx.registry, u.name))
  await runShadcnAdd({ ...ctx, overwrite: true }, project.root, urls, log)

  let next = lock
  for (const u of upgrades) {
    next = { ...next, components: { ...next.components, [u.name]: lockComponentFor(u.item) } }
  }
  writeLockfile(project.root, next)

  log.step(`Updated ${upgrades.map((u) => ctx.c.cyan(u.name)).join(", ")}.`)
  return 0
}
