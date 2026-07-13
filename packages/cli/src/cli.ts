import { Command } from "commander"
import { add } from "./commands/add.js"
import { diff } from "./commands/diff.js"
import { init } from "./commands/init.js"
import { list } from "./commands/list.js"
import { update } from "./commands/update.js"
import { resolveContext, type GlobalOptions } from "./context.js"
import { version } from "./version.js"

const HOMEPAGE = "https://tripwire.sh/dither-kit"

/** Apply the global flags to a command. Attached to every subcommand as well as
 * the root so they work in any position (`add --json` and `--json add` both
 * parse) — clig.dev: make flags order-independent. */
function withGlobals(cmd: Command): Command {
  return cmd
    .option("--dir <path>", "project directory (defaults to the current directory)")
    .option("-y, --yes", "skip confirmation prompts")
    .option("--overwrite", "overwrite existing files")
    .option("-n, --dry-run", "describe what would happen; write nothing")
    .option("--no-input", "never prompt; fail if a required value is missing")
    .option("--json", "output machine-readable JSON on stdout")
    .option("--plain", "output plain, tab-separated text for grep/awk")
    .option("--no-color", "disable colour output")
    .option("-q, --quiet", "suppress non-essential output")
    .option("--debug", "show internal detail (or set DEBUG)")
}

/** Merge parent + command options into the resolved context. */
function ctxFor(cmd: Command) {
  return resolveContext(cmd.optsWithGlobals() as GlobalOptions)
}

export function buildProgram(): Command {
  const program = new Command()

  program
    .name("dither-kit")
    .description("The Dither Kit installer — composable dithered charts for shadcn/ui.")
    .version(version, "--version", "print the version and exit")
    .configureHelp({ showGlobalOptions: true })
    .addHelpText(
      "before",
      `\nDither Kit — add dithered charts to your shadcn/ui project.\n`,
    )
    .addHelpText(
      "after",
      `
Examples:
  $ dither-kit add area-chart          add one component
  $ dither-kit add                     pick from a menu
  $ dither-kit list                    see what's available
  $ dither-kit update                  pull upstream changes into your copy

Requires Tailwind CSS and a shadcn project (components.json).
Docs: ${HOMEPAGE}
`,
    )

  withGlobals(program)

  withGlobals(
    program
      .command("init")
      .description("set up Dither Kit in this project (source vs. package, then a lockfile)")
      .option("--mode <mode>", "source | package (skips the prompt)")
      .addHelpText("after", `\nExample:\n  $ dither-kit init --mode source\n`)
      .action(async (_opts, cmd: Command) => {
        const ctx = ctxFor(cmd)
        process.exitCode = await init(ctx, { mode: cmd.opts().mode as string | undefined })
      }),
  )

  withGlobals(
    program
      .command("add")
      .argument("[names...]", "components to add; omit to choose interactively")
      .description("install one or more components (delegates the write to shadcn)")
      .addHelpText(
        "after",
        `\nExamples:\n  $ dither-kit add area-chart bar-chart\n  $ dither-kit add --dry-run pie-chart\n`,
      )
      .action(async (names: string[], _opts, cmd: Command) => {
        const ctx = ctxFor(cmd)
        process.exitCode = await add(names, ctx)
      }),
  )

  withGlobals(
    program
      .command("list")
      .description("list available components, grouped by category, with installed status")
      .action(async (_opts, cmd: Command) => {
        const ctx = ctxFor(cmd)
        process.exitCode = await list(ctx)
      }),
  )

  withGlobals(
    program
      .command("update")
      .description("apply upstream changes to installed components (lockfile-driven)")
      .action(async (_opts, cmd: Command) => {
        const ctx = ctxFor(cmd)
        process.exitCode = await update(ctx)
      }),
  )

  withGlobals(
    program
      .command("diff")
      .description("show how your installed components differ from the registry")
      .action(async (_opts, cmd: Command) => {
        const ctx = ctxFor(cmd)
        process.exitCode = await diff(ctx)
      }),
  )

  return program
}
