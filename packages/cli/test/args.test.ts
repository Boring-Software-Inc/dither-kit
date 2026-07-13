import assert from "node:assert/strict"
import { afterEach, describe, test } from "node:test"
import { buildProgram } from "../src/cli.js"
import { resolveColor, resolveContext } from "../src/context.js"
import { devOverrideAllowed, registryBase, registryItemUrl } from "../src/env.js"

const savedEnv = { ...process.env }
afterEach(() => {
  process.env = { ...savedEnv }
})

describe("colour resolution", () => {
  test("disabled when --no-color", () => {
    assert.equal(resolveColor({ color: false }), false)
  })
  test("disabled in --json mode", () => {
    assert.equal(resolveColor({ json: true }), false)
  })
  test("disabled when NO_COLOR is set", () => {
    process.env.NO_COLOR = "1"
    assert.equal(resolveColor({}), false)
  })
  test("disabled when TERM=dumb", () => {
    delete process.env.NO_COLOR
    process.env.TERM = "dumb"
    assert.equal(resolveColor({}), false)
  })
  test("FORCE_COLOR overrides the TTY check", () => {
    delete process.env.NO_COLOR
    delete process.env.TERM
    process.env.FORCE_COLOR = "1"
    assert.equal(resolveColor({}), true)
  })
})

describe("global options → context", () => {
  test("maps flags and --no-input/--no-color booleans", () => {
    const ctx = resolveContext({
      dir: "/tmp/x",
      yes: true,
      overwrite: true,
      dryRun: true,
      input: false,
      json: true,
      plain: true,
      quiet: true,
      debug: true,
      color: false,
    })
    assert.equal(ctx.dir, "/tmp/x")
    assert.equal(ctx.yes, true)
    assert.equal(ctx.overwrite, true)
    assert.equal(ctx.dryRun, true)
    assert.equal(ctx.input, false)
    assert.equal(ctx.json, true)
    assert.equal(ctx.plain, true)
    assert.equal(ctx.color, false)
    // --no-input forces non-interactive regardless of the TTY.
    assert.equal(ctx.interactive, false)
  })
})

describe("registry base URL (dev override is fail-closed)", () => {
  test("defaults to tripwire.sh when no override", () => {
    delete process.env.DITHER_KIT_REGISTRY
    delete process.env.NODE_ENV
    delete process.env.DITHER_KIT_DEV
    assert.equal(registryBase(), "https://tripwire.sh")
  })
  test("ignores the override outside development", () => {
    process.env.DITHER_KIT_REGISTRY = "http://localhost:9999"
    delete process.env.NODE_ENV
    delete process.env.DITHER_KIT_DEV
    assert.equal(devOverrideAllowed(), false)
    assert.equal(registryBase(), "https://tripwire.sh")
  })
  test("honours the override in development, trimming trailing slash", () => {
    process.env.DITHER_KIT_REGISTRY = "http://localhost:9999/"
    process.env.NODE_ENV = "development"
    assert.equal(registryBase(), "http://localhost:9999")
  })
  test("item URL is <base>/r/<name>.json", () => {
    assert.equal(
      registryItemUrl("https://tripwire.sh", "area-chart"),
      "https://tripwire.sh/r/area-chart.json",
    )
  })
})

describe("commander wiring", () => {
  test("--help is a clean, intentional exit", async () => {
    const program = buildProgram().exitOverride()
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} })
    await assert.rejects(
      () => program.parseAsync(["node", "dither-kit", "--help"]),
      (err: { code?: string }) => typeof err.code === "string" && err.code.includes("help"),
    )
  })

  test("an unknown command is a usage error, not a silent no-op", async () => {
    const program = buildProgram().exitOverride()
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} })
    await assert.rejects(
      () => program.parseAsync(["node", "dither-kit", "frobnicate"]),
      (err: { code?: string }) => err.code === "commander.unknownCommand",
    )
  })

  test("global flags parse after the subcommand (order-independent)", async () => {
    const program = buildProgram().exitOverride()
    let seen: Record<string, unknown> | undefined
    // Replace the list action by intercepting via a fresh parse: read opts off
    // the matched command instead of executing the network action.
    program.configureOutput({ writeOut: () => {}, writeErr: () => {} })
    const listCmd = program.commands.find((c) => c.name() === "list")!
    listCmd.action(function (this: unknown) {
      seen = (listCmd as { optsWithGlobals: () => Record<string, unknown> }).optsWithGlobals()
    })
    await program.parseAsync(["node", "dither-kit", "list", "--json", "--plain"])
    assert.equal(seen?.json, true)
    assert.equal(seen?.plain, true)
  })
})
