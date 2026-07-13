import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { cacheDir } from "./cache.js"
import { version } from "./version.js"

/**
 * Best-effort product analytics for the CLI.
 *
 * No secrets ship in the package. Events POST to tripwire.sh which forwards
 * them to Databuddy with the server key (see apps/web/src/routes/r/cli-event.ts
 * in the tripwire repo). Failures are swallowed — analytics never blocks a
 * command or changes its exit code.
 *
 * Opt out: `DO_NOT_TRACK=1` or `DITHER_KIT_TELEMETRY=0`.
 */

const TELEMETRY_URL = "https://tripwire.sh/r/cli-event"
const TIMEOUT_MS = 1_500

export type TelemetryEvent =
  | "cli_run"
  | "cli_add"
  | "cli_list"
  | "cli_init"
  | "cli_update"
  | "cli_diff"

type PropValue = string | number | boolean | null | string[]

const pending: Promise<void>[] = []

/** True when we should send events. */
export function telemetryEnabled(): boolean {
  if (process.env.NODE_ENV === "test") return false
  const flag = process.env.DITHER_KIT_TELEMETRY
  if (flag === "0" || flag === "false") return false
  if (process.env.DITHER_KIT_NO_TELEMETRY === "1" || process.env.DITHER_KIT_NO_TELEMETRY === "true") {
    return false
  }
  const dnt = process.env.DO_NOT_TRACK
  if (dnt === "1" || dnt === "true") return false
  return true
}

/** Stable anonymous id for this machine (not PII — random UUID on first run). */
export function anonymousId(): string {
  const dir = cacheDir()
  const path = join(dir, "anon-id")
  try {
    if (existsSync(path)) {
      const existing = readFileSync(path, "utf8").trim()
      if (existing.length > 0) return existing
    }
  } catch {
    // fall through to mint
  }
  const id = `cli_${randomUUID()}`
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(path, id, "utf8")
  } catch {
    // ephemeral id if the cache dir is unwritable
  }
  return id
}

/**
 * Queue an event. Safe to call anywhere; never throws. Call
 * {@link flushTelemetry} before process exit so the request can complete.
 */
export function track(
  name: TelemetryEvent,
  properties: Record<string, PropValue> = {},
): void {
  if (!telemetryEnabled()) return
  pending.push(send(name, properties))
}

async function send(
  name: TelemetryEvent,
  properties: Record<string, PropValue>,
): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    await fetch(TELEMETRY_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": `dither-kit-cli/${version}`,
      },
      body: JSON.stringify({
        name,
        anonymousId: anonymousId(),
        properties: {
          cli_version: version,
          node: process.version,
          platform: process.platform,
          arch: process.arch,
          ...properties,
        },
      }),
    })
  } catch {
    // swallow — offline / timeout / blocked
  } finally {
    clearTimeout(timer)
  }
}

/** Await outstanding telemetry requests (with the same short timeout budget). */
export async function flushTelemetry(): Promise<void> {
  if (pending.length === 0) return
  const batch = pending.splice(0, pending.length)
  await Promise.allSettled(batch)
}

/** Best-effort parse of which subcommand is being run from argv. */
export function commandFromArgv(argv: string[]): string {
  // argv: [node, script, ...user args] or [script, ...user args] depending on entry.
  const args = argv.slice(2)
  for (const a of args) {
    if (a === "--") continue
    if (a.startsWith("-")) continue
    return a
  }
  return "help"
}
