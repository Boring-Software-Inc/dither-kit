import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { hashContent } from "@dither-kit/registry-core"
import type { Context } from "../context.js"
import { CliError, ExitCode } from "../errors.js"
import { diffLines, renderDiff } from "../diff-util.js"
import { readLockfile } from "../lockfile.js"
import { Logger, data, json } from "../output.js"
import { requireProject } from "../project.js"
import { resolveItem, type RegistryDeps } from "../registry.js"
import { loadRegistry } from "./shared.js"

interface FileDiff {
  component: string
  path: string
  locallyModified: boolean
  upstreamChanged: boolean
  missing: boolean
  /** Unified diff of local → upstream, when upstream changed. */
  patch?: string[]
}

export async function diff(ctx: Context, deps: RegistryDeps = {}): Promise<number> {
  const log = new Logger(ctx)
  const project = requireProject(ctx)
  const lock = readLockfile(project.root)
  if (!lock || Object.keys(lock.components).length === 0) {
    throw new CliError(
      "no installed components to diff.",
      ExitCode.NotFound,
      "Run `dither-kit add <name>` first.",
    )
  }

  const registry = await loadRegistry(ctx, log, deps)
  const byName = new Map(registry.items.map((it) => [it.name, it]))

  const diffs: FileDiff[] = []
  for (const [name, locked] of Object.entries(lock.components)) {
    if (!byName.has(name)) continue
    const { item } = await resolveItem(ctx, name, deps)
    const upstreamByTarget = new Map(
      item.files.filter((f) => typeof f.content === "string").map((f) => [f.target, f.content!]),
    )

    for (const file of locked.files) {
      const localPath = join(project.root, file.path)
      const missing = !existsSync(localPath)
      const local = missing ? "" : readFileSync(localPath, "utf8")
      const localHash = missing ? null : hashContent(local)
      const upstream = upstreamByTarget.get(file.path)
      const upstreamHash = upstream !== undefined ? hashContent(upstream) : null

      const locallyModified = !missing && localHash !== file.hash
      const upstreamChanged = upstreamHash !== null && upstreamHash !== file.hash
      if (!missing && !locallyModified && !upstreamChanged) continue

      diffs.push({
        component: name,
        path: file.path,
        locallyModified,
        upstreamChanged,
        missing,
        patch:
          upstreamChanged && upstream !== undefined && !missing
            ? renderDiff(diffLines(local, upstream))
            : undefined,
      })
    }
  }

  if (ctx.json) {
    json({ clean: diffs.length === 0, files: diffs })
    return 0
  }

  if (diffs.length === 0) {
    log.step("No differences — your components match the lockfile and the registry.")
    return 0
  }

  const { c } = ctx
  for (const d of diffs) {
    const tags: string[] = []
    if (d.missing) tags.push(c.red("missing locally"))
    if (d.locallyModified) tags.push(c.yellow("modified locally"))
    if (d.upstreamChanged) tags.push(c.cyan("changed upstream"))
    data(`${c.bold(d.path)}  ${tags.join(c.dim(" · "))}`)
    if (d.patch) {
      for (const line of d.patch) data(colorizePatch(line, ctx))
    }
    data("")
  }

  if (diffs.some((d) => d.upstreamChanged)) log.next("dither-kit update")
  return 0
}

function colorizePatch(line: string, ctx: Context): string {
  if (!ctx.color) return line
  if (line.startsWith("+")) return ctx.c.green(line)
  if (line.startsWith("-")) return ctx.c.red(line)
  if (line === "…") return ctx.c.dim(line)
  return ctx.c.dim(line)
}
