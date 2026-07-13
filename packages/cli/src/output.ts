import type { Context } from "./context.js"

// Output discipline (clig.dev):
//   • Primary, machine-consumable output → stdout. Only `data()`/`json()` write
//     there, so `dither-kit list --json | jq` is clean.
//   • Everything else — status, progress, prompts, errors — → stderr.
//   • Colour + animation only when allowed (TTY, not --json, not NO_COLOR…).

/** Write primary output to stdout. The only thing a pipe should see. */
export function data(line: string): void {
  process.stdout.write(line.endsWith("\n") ? line : `${line}\n`)
}

/** Pretty-print a JSON value to stdout. */
export function json(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

export class Logger {
  constructor(private readonly ctx: Context) {}

  private write(line: string): void {
    process.stderr.write(`${line}\n`)
  }

  /** Neutral status line. Suppressed by --quiet. */
  info(msg: string): void {
    if (this.ctx.quiet) return
    this.write(msg)
  }

  /** A step that changed state — kept even under --quiet? No: still status. */
  step(msg: string): void {
    if (this.ctx.quiet) return
    const { c } = this.ctx
    this.write(`${c.green("✓")} ${msg}`)
  }

  /** A softer, secondary detail line. */
  detail(msg: string): void {
    if (this.ctx.quiet) return
    this.write(this.ctx.c.dim(msg))
  }

  /** A suggestion for the next command (clig.dev: guide the conversation). */
  next(cmd: string): void {
    if (this.ctx.quiet) return
    const { c } = this.ctx
    this.write(`\n${c.dim("Next:")} ${c.cyan(cmd)}`)
  }

  warn(msg: string): void {
    const { c } = this.ctx
    this.write(`${c.yellow("!")} ${msg}`)
  }

  error(msg: string): void {
    const { c } = this.ctx
    this.write(`${c.red("✗")} ${msg}`)
  }

  /** Only shown under --debug / DEBUG. Internals for the maintainers. */
  debug(msg: string): void {
    if (!this.ctx.debug) return
    this.write(this.ctx.c.dim(`[debug] ${msg}`))
  }

  /** A minimal, CI-safe progress indicator on stderr. Animates only when
   * colour/TTY is allowed; otherwise prints a single static line so it never
   * turns CI logs into a christmas tree. Returns a stop handle. */
  spinner(label: string): { stop: (final?: string) => void } {
    if (this.ctx.quiet) return { stop: () => {} }
    if (!this.ctx.color || !process.stderr.isTTY) {
      this.write(`${label}…`)
      return { stop: (final) => (final ? this.step(final) : undefined) }
    }
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
    let i = 0
    const render = () => {
      process.stderr.write(`\r${this.ctx.c.cyan(frames[i % frames.length]!)} ${label}`)
      i++
    }
    render()
    const timer = setInterval(render, 80)
    if (typeof timer.unref === "function") timer.unref()
    return {
      stop: (final) => {
        clearInterval(timer)
        process.stderr.write("\r\x1b[2K") // clear the spinner line
        if (final) this.step(final)
      },
    }
  }
}
