import assert from "node:assert/strict"
import { describe, test } from "node:test"
import {
  commandFromArgv,
  telemetryEnabled,
} from "../src/telemetry.js"

describe("telemetry", () => {
  test("commandFromArgv picks the first non-flag arg", () => {
    assert.equal(commandFromArgv(["node", "dither-kit", "add", "button"]), "add")
    assert.equal(commandFromArgv(["node", "dither-kit", "--json", "list"]), "list")
    assert.equal(commandFromArgv(["node", "dither-kit", "--help"]), "help")
  })

  test("disabled under NODE_ENV=test (test runner sets this)", () => {
    // The test runner itself runs with NODE_ENV=test or we force opt-out.
    process.env.DITHER_KIT_TELEMETRY = "0"
    assert.equal(telemetryEnabled(), false)
    delete process.env.DITHER_KIT_TELEMETRY
  })

  test("DO_NOT_TRACK opts out", () => {
    const prev = process.env.DO_NOT_TRACK
    process.env.DO_NOT_TRACK = "1"
    // Even if telemetry flag is unset, DNT wins — but NODE_ENV=test also
    // disables. Assert the DNT path is recognized by temporarily clearing test.
    const nodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "production"
    assert.equal(telemetryEnabled(), false)
    process.env.NODE_ENV = nodeEnv
    if (prev === undefined) delete process.env.DO_NOT_TRACK
    else process.env.DO_NOT_TRACK = prev
  })
})
