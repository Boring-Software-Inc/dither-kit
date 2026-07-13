import { createColors } from "./colors.js"
import { registryBase } from "./env.js"

/** Resolved global options + environment, threaded through every command. */
export interface Context {
  /** Project root to operate in (--dir); defaults to cwd. */
  dir: string
  /** Skip confirmations, answer yes. */
  yes: boolean
  /** Overwrite existing files. */
  overwrite: boolean
  /** Describe actions, write nothing. */
  dryRun: boolean
  /** Never prompt; a missing required value fails. */
  input: boolean
  /** Emit machine-readable JSON on stdout. */
  json: boolean
  /** Emit grep/awk-friendly plain output. */
  plain: boolean
  /** Suppress non-essential output. */
  quiet: boolean
  /** Show internal detail. */
  debug: boolean
  /** Whether colour/animation is allowed (resolved from TTY + env + flags). */
  color: boolean
  /** True when stdin is an interactive terminal (safe to prompt). */
  interactive: boolean
  /** Registry base URL (https://tripwire.sh, unless a dev override applies). */
  registry: string
  /** picocolors instance, enabled per {@link Context.color}. */
  c: ReturnType<typeof createColors>
}

/** Raw global options as commander parses them. `color`/`input` are booleans
 * (commander turns `--no-color`/`--no-input` into `color:false`/`input:false`). */
export interface GlobalOptions {
  dir?: string
  yes?: boolean
  overwrite?: boolean
  dryRun?: boolean
  input?: boolean
  json?: boolean
  plain?: boolean
  quiet?: boolean
  debug?: boolean
  color?: boolean
}

/**
 * Decide whether colour + animations are allowed. Disabled when: stdout is not
 * a TTY, NO_COLOR is set (non-empty), TERM=dumb, or --no-color was passed.
 * FORCE_COLOR overrides the TTY check (but not an explicit --no-color).
 * (clig.dev / no-color.org / 12-factor CLI.)
 */
export function resolveColor(opts: GlobalOptions): boolean {
  if (opts.color === false) return false
  if (opts.json) return false
  if (process.env.NO_COLOR && process.env.NO_COLOR.length > 0) return false
  if (process.env.TERM === "dumb") return false
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== "0") return true
  return Boolean(process.stdout.isTTY)
}

export function resolveContext(opts: GlobalOptions): Context {
  const color = resolveColor(opts)
  return {
    dir: opts.dir ? opts.dir : process.cwd(),
    yes: Boolean(opts.yes),
    overwrite: Boolean(opts.overwrite),
    dryRun: Boolean(opts.dryRun),
    input: opts.input !== false,
    json: Boolean(opts.json),
    plain: Boolean(opts.plain),
    quiet: Boolean(opts.quiet),
    debug: Boolean(opts.debug) || isTruthy(process.env.DEBUG),
    color,
    interactive: Boolean(process.stdin.isTTY) && opts.input !== false,
    registry: registryBase(),
    c: createColors(color),
  }
}

function isTruthy(v: string | undefined): boolean {
  return v !== undefined && v !== "" && v !== "0" && v.toLowerCase() !== "false"
}
