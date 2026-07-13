import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { createColors } from "../src/colors.js"
import type { Context } from "../src/context.js"

/** Directory holding the generated registry JSON (repo `r/`). */
const R_DIR = fileURLToPath(new URL("../../../r/", import.meta.url))

/** A fake `fetchText` that serves the repo's generated registry off disk, keyed
 * by the file name in the URL. Lets command/registry tests run with no network
 * and no live host. */
export function localFetch(url: string): Promise<{ text: string; note?: string }> {
  const name = url.split("/").pop() ?? ""
  return Promise.resolve({ text: readFileSync(new URL(name, `file://${R_DIR}`), "utf8") })
}

/** A `fetchText` that always fails — simulates being offline. */
export function offlineFetch(): Promise<{ text: string; note?: string }> {
  return Promise.reject(new Error("offline"))
}

/** Build a Context without touching the real TTY/env, for unit tests. */
export function makeCtx(over: Partial<Context> = {}): Context {
  const color = over.color ?? false
  return {
    dir: process.cwd(),
    yes: false,
    overwrite: false,
    dryRun: false,
    input: true,
    json: false,
    plain: false,
    quiet: true,
    debug: false,
    interactive: false,
    registry: "http://registry.test",
    ...over,
    color,
    c: createColors(color),
  }
}
