import { CommanderError } from "commander"
import pc from "picocolors"
import { buildProgram } from "./cli.js"
import { CliError, ExitCode } from "./errors.js"

// Ctrl-C exits immediately and cleanly — no half-written files. @clack/prompts
// handles cancellation inside prompts; this covers the rest (e.g. a hanging
// network call).
process.on("SIGINT", () => {
  process.stderr.write("\n")
  process.exit(ExitCode.Cancelled)
})

function reportError(err: unknown): number {
  const useColor = Boolean(process.stderr.isTTY) && !process.env.NO_COLOR
  const c = pc.createColors(useColor)

  if (err instanceof CliError) {
    process.stderr.write(`${c.red("✗")} ${err.message}\n`)
    if (err.hint) process.stderr.write(`  ${c.dim(err.hint)}\n`)
    return err.code
  }

  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`${c.red("✗")} ${message}\n`)
  if (err instanceof Error && err.stack && isDebug()) {
    process.stderr.write(`${c.dim(err.stack)}\n`)
  } else {
    process.stderr.write(
      `  ${c.dim("Re-run with --debug for details. Report bugs: https://github.com/Boring-Software-Inc/dither-kit/issues")}\n`,
    )
  }
  return ExitCode.Error
}

function isDebug(): boolean {
  const argv = process.argv
  const d = process.env.DEBUG
  return argv.includes("--debug") || (d !== undefined && d !== "" && d !== "0")
}

export async function run(argv: string[] = process.argv): Promise<void> {
  const program = buildProgram()
  // We own exit codes + error formatting, so intercept commander's exits.
  program.exitOverride()

  try {
    await program.parseAsync(argv)
  } catch (err) {
    if (err instanceof CommanderError) {
      // Help/version are a successful, intentional exit.
      if (err.code === "commander.help" || err.code === "commander.helpDisplayed" || err.code === "commander.version") {
        process.exitCode = ExitCode.Ok
        return
      }
      // Everything else from commander is a usage error.
      process.exitCode = ExitCode.Usage
      return
    }
    process.exitCode = reportError(err)
  }
}

run()
