import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, test } from "node:test"
import { getRegistry } from "../src/registry.js"
import { CliError } from "../src/errors.js"
import { localFetch, makeCtx, offlineFetch } from "./helpers.js"

function tmpCache(): string {
  return mkdtempSync(join(tmpdir(), "dk-cache-"))
}

describe("getRegistry: fetch + cache + offline fallback", () => {
  test("network fetch parses the registry and writes the cache", async () => {
    const ctx = makeCtx()
    const dir = tmpCache()
    const res = await getRegistry(ctx, { cacheDir: dir, fetchText: localFetch, now: () => 1000 })
    assert.equal(res.source, "network")
    assert.equal(res.registry.items.length, 6)
    assert.ok(existsSync(join(dir, "registry.json")), "cache file was written")
    // The cache records when it was fetched and against which base.
    const env = JSON.parse(readFileSync(join(dir, "registry.json"), "utf8"))
    assert.equal(env.base, ctx.registry)
    assert.equal(env.fetchedAt, 1000)
  })

  test("a fresh cache is served without hitting the network", async () => {
    const ctx = makeCtx()
    const dir = tmpCache()
    await getRegistry(ctx, { cacheDir: dir, fetchText: localFetch, ttlMs: 10_000, now: () => 1000 })
    // Second call: offline, but within TTL → cache is used, fetch not called.
    const res = await getRegistry(ctx, {
      cacheDir: dir,
      fetchText: offlineFetch,
      ttlMs: 10_000,
      now: () => 5000,
    })
    assert.equal(res.source, "cache")
    assert.equal(res.registry.items.length, 6)
  })

  test("a stale cache is used when the registry is unreachable, and flagged", async () => {
    const ctx = makeCtx()
    const dir = tmpCache()
    await getRegistry(ctx, { cacheDir: dir, fetchText: localFetch, ttlMs: 1000, now: () => 1000 })
    // TTL expired + offline → stale fallback rather than a hard failure.
    const res = await getRegistry(ctx, {
      cacheDir: dir,
      fetchText: offlineFetch,
      ttlMs: 1000,
      now: () => 999_999,
    })
    assert.equal(res.source, "stale")
    assert.equal(res.registry.items.length, 6)
  })

  test("no cache + offline is a network error", async () => {
    const ctx = makeCtx()
    const dir = tmpCache()
    await assert.rejects(
      () => getRegistry(ctx, { cacheDir: dir, fetchText: offlineFetch, now: () => 1000 }),
      (err: unknown) => err instanceof CliError && err.code === 3,
    )
  })
})
