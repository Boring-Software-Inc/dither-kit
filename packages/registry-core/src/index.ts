import { createHash } from "node:crypto"
import { z } from "zod"

// ─────────────────────────────────────────────────────────────────────────────
// The Dither Kit registry, defined ONCE.
//
// This module is the single source of truth for two shapes:
//   • the registry item / registry index that the build script emits and the
//     CLI fetches, and
//   • the CLI lockfile (dither-kit.json).
//
// Every schema below is authored as a zod schema; the TypeScript types are
// *inferred* from those schemas (`z.infer`). There is therefore exactly one
// definition per shape — no hand-written type sitting in parallel with a
// hand-written validator that can drift out of sync.
//
// Importers:
//   • scripts/build-registry.mts — validates what it emits against these.
//   • @dither-kit/cli            — parses the fetched registry + reads/writes
//                                  the lockfile through these.
//   • any downstream consumer    — imports the same definition, never a copy.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Known categories used to group `list` output and the `add` multiselect.
 *
 * This is advisory, not a closed set: {@link RegistryItemSchema} accepts any
 * string category so a new group (buttons, gradients, …) can ship in the
 * registry JSON without a CLI release. The constant just documents the ones we
 * expect today and gives callers a stable display order.
 */
export const CATEGORIES = ["charts", "buttons", "gradients", "core"] as const
export type KnownCategory = (typeof CATEGORIES)[number]

/**
 * shadcn registry item `type`. shadcn defines a fixed vocabulary
 * (`registry:component`, `registry:ui`, `registry:lib`, …); we keep it as a
 * plain string so the registry can use any of them without a schema bump.
 */
export const RegistryItemTypeSchema = z.string()
export type RegistryItemType = z.infer<typeof RegistryItemTypeSchema>

/** A single file shipped by a registry item. `content` is present in the
 * per-item registry (`r/<name>.json`) and absent in the index (`registry.json`). */
export const RegistryFileSchema = z.object({
  path: z.string(),
  type: RegistryItemTypeSchema,
  target: z.string(),
  content: z.string().optional(),
})
export type RegistryFile = z.infer<typeof RegistryFileSchema>

/**
 * One installable registry item (a chart, the core engine, a future button…).
 *
 * `categories` and `version` are what the CLI needs beyond the raw shadcn
 * shape: `categories` drives grouping, `version` drives the lockfile /
 * `update` / `diff`. Both default so a legacy or partial cached registry still
 * parses instead of throwing.
 */
export const RegistryItemSchema = z.object({
  $schema: z.string().optional(),
  name: z.string(),
  type: RegistryItemTypeSchema,
  title: z.string(),
  description: z.string(),
  author: z.string().optional(),
  categories: z.array(z.string()).default([]),
  version: z.string().default("0.0.0"),
  dependencies: z.array(z.string()).default([]),
  devDependencies: z.array(z.string()).default([]),
  registryDependencies: z.array(z.string()).default([]),
  files: z.array(RegistryFileSchema).default([]),
})
export type RegistryItem = z.infer<typeof RegistryItemSchema>

/** The registry index (`registry.json`): the list the CLI fetches to discover
 * what is installable. */
export const RegistrySchema = z.object({
  $schema: z.string().optional(),
  name: z.string(),
  homepage: z.string().optional(),
  items: z.array(RegistryItemSchema),
})
export type Registry = z.infer<typeof RegistrySchema>

// ─────────────────────────────────────────────────────────────────────────────
// Lockfile — dither-kit.json in the consumer project.
// ─────────────────────────────────────────────────────────────────────────────

/** File name written at the project root (next to components.json). */
export const LOCKFILE_NAME = "dither-kit.json"
/** Bump only on a breaking change to the lockfile shape. */
export const LOCKFILE_VERSION = 1 as const

/** Per-file record: where it landed and the hash of what we wrote. Lets `diff`
 * detect a file the user edited locally. */
export const LockFileEntrySchema = z.object({
  path: z.string(),
  hash: z.string(),
})
export type LockFileEntry = z.infer<typeof LockFileEntrySchema>

/** One installed component: the version we resolved, an aggregate content hash,
 * and the per-file hashes. */
export const LockComponentSchema = z.object({
  version: z.string(),
  hash: z.string(),
  files: z.array(LockFileEntrySchema),
})
export type LockComponent = z.infer<typeof LockComponentSchema>

/** How the project consumes Dither Kit — vendored source (the shadcn way,
 * editable + tracked here) or, in future, an npm package. Recorded by `init`. */
export const InstallModeSchema = z.enum(["source", "package"])
export type InstallMode = z.infer<typeof InstallModeSchema>

export const LockfileSchema = z.object({
  $schema: z.string().optional(),
  lockfileVersion: z.literal(LOCKFILE_VERSION).default(LOCKFILE_VERSION),
  registry: z.string(),
  mode: InstallModeSchema.default("source"),
  components: z.record(z.string(), LockComponentSchema).default({}),
})
export type Lockfile = z.infer<typeof LockfileSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Content hashing — one implementation, so the build script, the CLI, and any
// consumer compute identical hashes for identical content.
// ─────────────────────────────────────────────────────────────────────────────

/** Hash a single file's content. Prefixed with the algorithm so the lockfile
 * stays forward-compatible if we ever change it. */
export function hashContent(content: string): string {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`
}

/** Deterministic aggregate hash across an item's files. Order-independent:
 * files are sorted by path before hashing so re-ordering the registry array
 * never changes the result. */
export function hashFiles(files: ReadonlyArray<{ path: string; content: string }>): string {
  const hash = createHash("sha256")
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path))
  for (const file of sorted) {
    hash.update(file.path)
    hash.update("\0")
    hash.update(file.content)
    hash.update("\0")
  }
  return `sha256:${hash.digest("hex")}`
}

/** Build the {@link LockComponent} record for an item from its resolved files.
 * `files` carry the target path (where the file lands) and its content. */
export function toLockComponent(
  version: string,
  files: ReadonlyArray<{ target: string; content: string }>,
): LockComponent {
  return {
    version,
    hash: hashFiles(files.map((f) => ({ path: f.target, content: f.content }))),
    files: files
      .map((f) => ({ path: f.target, hash: hashContent(f.content) }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  }
}
