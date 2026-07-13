import type { Registry, RegistryItem } from "@dither-kit/registry-core"
import type { Context } from "../context.js"
import { registryItemUrl } from "../env.js"
import { CliError, ExitCode } from "../errors.js"
import {
  emptyLockfile,
  lockComponentFor,
  readLockfile,
  writeLockfile,
} from "../lockfile.js"
import { Logger, json } from "../output.js"
import { requireProject } from "../project.js"
import { closure, groupByCategory, resolveItem, type RegistryDeps } from "../registry.js"
import { resolveNames } from "../resolve.js"
import { runShadcnAdd } from "../shadcn.js"
import { track } from "../telemetry.js"
import { confirmYes, pickComponents, type Choice } from "../ui.js"
import { loadRegistry } from "./shared.js"

export async function add(
  names: string[],
  ctx: Context,
  deps: RegistryDeps = {},
): Promise<number> {
  const log = new Logger(ctx)
  const project = requireProject(ctx)
  const registry = await loadRegistry(ctx, log, deps)

  // 1. Decide what to install.
  let requested = names.slice()
  if (requested.length === 0) {
    if (!ctx.interactive) {
      throw new CliError(
        "no components specified.",
        ExitCode.MissingInput,
        "Pass one or more names (e.g. `dither-kit add area-chart`), or run in an interactive terminal. `dither-kit list` shows what's available.",
      )
    }
    requested = await promptForComponents(registry)
    if (requested.length === 0) {
      log.info("Nothing selected.")
      return 0
    }
  }

  // 2. Resolve names → items, correcting typos only with consent.
  const resolved = await resolveWithSuggestions(requested, registry, ctx, log)

  // 3. Build the lockfile-relevant closure (requested + deps like core).
  const closureItems = closure(
    resolved.map((it) => it.name),
    registry,
  )
  const detailed = await Promise.all(closureItems.map((it) => resolveItem(ctx, it.name, deps)))
  const items = detailed.map((d) => d.item)

  // 4. Dry run: describe exactly what would happen, write nothing.
  if (ctx.dryRun) {
    track("cli_add", {
      components: resolved.map((it) => it.name),
      count: resolved.length,
      dry_run: true,
    })
    return reportDryRun(ctx, log, resolved, items)
  }

  // 5. Delegate the write to shadcn (it expands registryDependencies itself,
  //    so we hand it only the requested items' URLs).
  const urls = resolved.map((it) => registryItemUrl(ctx.registry, it.name))
  log.info(`Installing ${resolved.map((it) => ctx.c.cyan(it.name)).join(", ")} into ${ctx.c.dim(project.root)}…`)
  await runShadcnAdd(ctx, project.root, urls, log)

  // 6. Record the whole closure in the lockfile.
  let lock = readLockfile(project.root) ?? emptyLockfile(ctx.registry)
  for (const item of items) {
    lock = { ...lock, components: { ...lock.components, [item.name]: lockComponentFor(item) } }
  }
  writeLockfile(project.root, lock)

  track("cli_add", {
    components: resolved.map((it) => it.name),
    count: resolved.length,
    closure: items.map((it) => it.name),
    dry_run: false,
  })

  // 7. Tell the user what changed + what's next.
  return report(ctx, log, resolved, items)
}

/** Prompt for a grouped selection; `core` is omitted because it installs
 * automatically as a dependency. */
async function promptForComponents(registry: Registry): Promise<string[]> {
  const groups = groupByCategory(registry)
  const picker: Record<string, Choice[]> = {}
  for (const [cat, catItems] of groups) {
    if (cat === "core") continue
    picker[cat] = catItems.map((it) => ({
      value: it.name,
      label: it.name,
      hint: it.title,
    }))
  }
  return pickComponents(picker)
}

/** Resolve names, asking before applying a suggested correction, never silently
 * running the corrected command. */
async function resolveWithSuggestions(
  requested: string[],
  registry: Registry,
  ctx: Context,
  log: Logger,
): Promise<RegistryItem[]> {
  const { found, missing } = resolveNames(requested, registry)
  const byName = new Map(registry.items.map((it) => [it.name, it]))
  const acc = [...found]
  const unresolved: string[] = []

  for (const miss of missing) {
    if (miss.suggestion && ctx.interactive) {
      const yes = await confirmYes(
        `"${miss.name}" isn't a component. Did you mean "${miss.suggestion}"?`,
      )
      if (yes) {
        acc.push(byName.get(miss.suggestion)!)
        continue
      }
    }
    unresolved.push(miss.name)
  }

  if (unresolved.length > 0) {
    const lines = missing
      .filter((m) => unresolved.includes(m.name))
      .map((m) => (m.suggestion ? `${m.name} (did you mean ${m.suggestion}?)` : m.name))
    throw new CliError(
      `unknown component${unresolved.length > 1 ? "s" : ""}: ${lines.join(", ")}`,
      ExitCode.NotFound,
      "Run `dither-kit list` to see what's available.",
    )
  }

  // De-dupe while preserving request order.
  const seen = new Set<string>()
  return acc.filter((it) => (seen.has(it.name) ? false : (seen.add(it.name), true)))
}

/** Aggregate the npm deps an item set pulls in (for the summary). */
function collectDeps(items: RegistryItem[]): string[] {
  const set = new Set<string>()
  for (const it of items) for (const d of it.dependencies) set.add(d)
  return [...set].sort()
}

function fileTargets(items: RegistryItem[]): string[] {
  return items.flatMap((it) => it.files.map((f) => f.target))
}

function reportDryRun(
  ctx: Context,
  log: Logger,
  requested: RegistryItem[],
  closureItems: RegistryItem[],
): number {
  const files = fileTargets(closureItems)
  const npmDeps = collectDeps(closureItems)

  if (ctx.json) {
    json({
      dryRun: true,
      requested: requested.map((it) => it.name),
      wouldInstall: closureItems.map((it) => ({ name: it.name, version: it.version })),
      wouldWrite: files,
      wouldInstallDeps: npmDeps,
    })
    return 0
  }

  const { c } = ctx
  log.info(c.bold("Dry run — nothing will be written.\n"))
  log.info(`Would install: ${closureItems.map((it) => c.cyan(it.name)).join(", ")}`)
  log.info("Would write:")
  for (const f of files) log.info(`  ${c.dim("+")} ${f}`)
  if (npmDeps.length) log.info(`Would install deps: ${npmDeps.map((d) => c.cyan(d)).join(", ")}`)
  log.next("dither-kit add " + requested.map((it) => it.name).join(" "))
  return 0
}

function report(
  ctx: Context,
  log: Logger,
  requested: RegistryItem[],
  closureItems: RegistryItem[],
): number {
  const files = fileTargets(closureItems)
  const npmDeps = collectDeps(closureItems)

  if (ctx.json) {
    json({
      installed: closureItems.map((it) => ({ name: it.name, version: it.version })),
      requested: requested.map((it) => it.name),
      files,
      deps: npmDeps,
    })
    return 0
  }

  const { c } = ctx
  log.step(`Installed ${requested.map((it) => c.cyan(it.name)).join(", ")}.`)
  if (closureItems.length > requested.length) {
    const extra = closureItems.filter((it) => !requested.some((r) => r.name === it.name))
    log.detail(`  pulled in ${extra.map((it) => it.name).join(", ")}`)
  }
  log.detail(`  ${files.length} file${files.length === 1 ? "" : "s"} under components/dither-kit/`)
  log.next("import from @/components/dither-kit and start composing — https://tripwire.sh/dither-kit")
  return 0
}
