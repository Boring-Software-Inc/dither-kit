import assert from "node:assert/strict"
import { existsSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, test } from "node:test"
import { hashContent, type RegistryItem } from "@dither-kit/registry-core"
import {
  emptyLockfile,
  lockComponentFor,
  readLockfile,
  upsert,
  writeLockfile,
} from "../src/lockfile.js"

function item(name: string, files: { target: string; content: string }[]): RegistryItem {
  return {
    name,
    type: "registry:component",
    title: name,
    description: name,
    categories: ["charts"],
    version: "1.2.0",
    dependencies: [],
    devDependencies: [],
    registryDependencies: [],
    files: files.map((f) => ({ path: f.target, type: "registry:component", target: f.target, content: f.content })),
  }
}

describe("lockfile", () => {
  test("hashContent is deterministic and content-sensitive", () => {
    assert.equal(hashContent("hello"), hashContent("hello"))
    assert.notEqual(hashContent("hello"), hashContent("hello!"))
    assert.match(hashContent("x"), /^sha256:[0-9a-f]{64}$/)
  })

  test("lockComponentFor records version, aggregate hash, and per-file hashes", () => {
    const c = lockComponentFor(item("bar-chart", [
      { target: "components/dither-kit/bar.tsx", content: "export const Bar = 1" },
      { target: "components/dither-kit/bar-chart.tsx", content: "export const BarChart = 2" },
    ]))
    assert.equal(c.version, "1.2.0")
    assert.match(c.hash, /^sha256:/)
    assert.equal(c.files.length, 2)
    // Files are sorted by path for a stable lockfile.
    assert.deepEqual(
      c.files.map((f) => f.path),
      ["components/dither-kit/bar-chart.tsx", "components/dither-kit/bar.tsx"],
    )
  })

  test("write → read round-trips through the shared schema", () => {
    const root = mkdtempSync(join(tmpdir(), "dk-lock-"))
    let lock = emptyLockfile("https://tripwire.sh", "source")
    lock = upsert(lock, item("area-chart", [
      { target: "components/dither-kit/area.tsx", content: "A" },
    ]))
    writeLockfile(root, lock)
    assert.ok(existsSync(join(root, "dither-kit.json")))

    const read = readLockfile(root)
    assert.ok(read)
    assert.equal(read!.registry, "https://tripwire.sh")
    assert.equal(read!.mode, "source")
    assert.equal(read!.lockfileVersion, 1)
    assert.ok(read!.components["area-chart"])
    assert.equal(read!.components["area-chart"]!.version, "1.2.0")
  })

  test("readLockfile returns null when there is no lockfile", () => {
    const root = mkdtempSync(join(tmpdir(), "dk-nolock-"))
    assert.equal(readLockfile(root), null)
  })
})
