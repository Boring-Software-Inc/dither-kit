import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  LOCKFILE_NAME,
  LOCKFILE_VERSION,
  LockfileSchema,
  toLockComponent,
  type InstallMode,
  type Lockfile,
  type LockComponent,
  type RegistryItem,
} from "@dither-kit/registry-core"

/** Absolute path to the lockfile for a project root. */
export function lockfilePath(root: string): string {
  return join(root, LOCKFILE_NAME)
}

/** Read + validate the lockfile, or null if the project has none yet. */
export function readLockfile(root: string): Lockfile | null {
  const path = lockfilePath(root)
  if (!existsSync(path)) return null
  const raw = JSON.parse(readFileSync(path, "utf8"))
  return LockfileSchema.parse(raw)
}

/** An empty lockfile pinned to a registry. */
export function emptyLockfile(registry: string, mode: InstallMode = "source"): Lockfile {
  return {
    $schema: "https://tripwire.sh/schema/dither-kit.json",
    lockfileVersion: LOCKFILE_VERSION,
    registry,
    mode,
    components: {},
  }
}

/** Write the lockfile to disk (stable key order for clean diffs). */
export function writeLockfile(root: string, lock: Lockfile): void {
  const ordered: Lockfile = {
    $schema: lock.$schema,
    lockfileVersion: lock.lockfileVersion,
    registry: lock.registry,
    mode: lock.mode,
    components: Object.fromEntries(
      Object.keys(lock.components)
        .sort()
        .map((k) => [k, lock.components[k]!]),
    ),
  }
  writeFileSync(lockfilePath(root), `${JSON.stringify(ordered, null, 2)}\n`)
}

/** Compute the {@link LockComponent} record for a resolved registry item. Only
 * files that carry inline content contribute (the per-item registry always
 * does). */
export function lockComponentFor(item: RegistryItem): LockComponent {
  const files: { target: string; content: string }[] = []
  for (const f of item.files) {
    if (typeof f.content === "string") files.push({ target: f.target, content: f.content })
  }
  return toLockComponent(item.version, files)
}

/** Return a copy of the lockfile with `item` recorded/updated. */
export function upsert(lock: Lockfile, item: RegistryItem): Lockfile {
  return {
    ...lock,
    components: { ...lock.components, [item.name]: lockComponentFor(item) },
  }
}
