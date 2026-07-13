import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, test } from "node:test"
import { add } from "../src/commands/add.js"
import { CliError } from "../src/errors.js"
import { localFetch, makeCtx } from "./helpers.js"

/** A temp shadcn-ish project with components.json + Tailwind. */
function tmpProject(): string {
  const root = mkdtempSync(join(tmpdir(), "dk-proj-"))
  writeFileSync(join(root, "components.json"), JSON.stringify({ aliases: { components: "@/components" } }))
  writeFileSync(join(root, "package.json"), JSON.stringify({ devDependencies: { tailwindcss: "^3" } }))
  return root
}

const deps = () => ({ fetchText: localFetch, cacheDir: mkdtempSync(join(tmpdir(), "dk-c-")) })

describe("add --dry-run", () => {
  test("writes nothing: no components/, no lockfile", async () => {
    const root = tmpProject()
    const ctx = makeCtx({ dir: root, dryRun: true })
    const code = await add(["area-chart"], ctx, deps())
    assert.equal(code, 0)
    assert.equal(existsSync(join(root, "dither-kit.json")), false, "no lockfile written")
    assert.equal(existsSync(join(root, "components")), false, "no files written")
    // Only the two seed files remain.
    assert.deepEqual(readdirSync(root).sort(), ["components.json", "package.json"])
  })
})

describe("add under --no-input", () => {
  test("fails with a useful message + flag when no names are given", async () => {
    const root = tmpProject()
    const ctx = makeCtx({ dir: root, input: false, interactive: false })
    await assert.rejects(
      () => add([], ctx, deps()),
      (err: unknown) => {
        assert.ok(err instanceof CliError)
        assert.equal(err.code, 5) // MissingInput
        assert.match(err.message, /no components specified/)
        assert.match(err.hint ?? "", /dither-kit add area-chart/)
        return true
      },
    )
  })

  test("a typo is reported (not silently corrected) with a suggestion", async () => {
    const root = tmpProject()
    const ctx = makeCtx({ dir: root, input: false, interactive: false })
    await assert.rejects(
      () => add(["aria-chart"], ctx, deps()),
      (err: unknown) => {
        assert.ok(err instanceof CliError)
        assert.equal(err.code, 7) // NotFound
        assert.match(err.message, /did you mean area-chart/)
        return true
      },
    )
  })
})
