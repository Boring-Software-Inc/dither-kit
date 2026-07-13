import { spawn } from "node:child_process"
import type { Context } from "./context.js"
import { CliError, ExitCode } from "./errors.js"
import type { Logger } from "./output.js"
import { detectRunner } from "./project.js"

/** Build the argv for invoking shadcn through the project's package runner. */
export function shadcnCommand(
  root: string,
  urls: string[],
  opts: { yes: boolean; overwrite: boolean },
): { command: string; args: string[] } {
  const runner = detectRunner(root)
  const shadcn = process.env.DITHER_KIT_SHADCN ?? "shadcn@latest"
  const flags: string[] = ["add", ...urls, "--cwd", root]
  if (opts.yes) flags.push("--yes")
  if (opts.overwrite) flags.push("--overwrite")

  switch (runner) {
    case "pnpm":
      return { command: "pnpm", args: ["dlx", shadcn, ...flags] }
    case "yarn":
      return { command: "yarn", args: ["dlx", shadcn, ...flags] }
    case "bun":
      return { command: "bunx", args: [shadcn, ...flags] }
    default:
      return { command: "npx", args: ["--yes", shadcn, ...flags] }
  }
}

/**
 * Delegate the actual file write to shadcn — it already handles components.json
 * aliases, Tailwind paths, dep install, and path resolution. We own resolution
 * + UX + the lockfile; shadcn owns the write.
 *
 * shadcn's own output is routed to stderr so our stdout stays clean for the
 * summary / --json. Resolves on exit 0; throws a {@link CliError} otherwise.
 */
export function runShadcnAdd(
  ctx: Context,
  root: string,
  urls: string[],
  log: Logger,
): Promise<void> {
  const { command, args } = shadcnCommand(root, urls, {
    yes: ctx.yes || !ctx.interactive,
    overwrite: ctx.overwrite,
  })
  log.debug(`delegating: ${command} ${args.join(" ")}`)

  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      // stdin from the user (shadcn may prompt); shadcn's stdout+stderr → our
      // stderr so piping `dither-kit … --json` never sees shadcn chatter.
      stdio: ["inherit", "pipe", "pipe"],
      env: process.env,
    })
    child.stdout.on("data", (d: Buffer) => process.stderr.write(d))
    child.stderr.on("data", (d: Buffer) => process.stderr.write(d))

    child.on("error", (err) => {
      reject(
        new CliError(
          `could not run \`${command}\`: ${err.message}`,
          ExitCode.Delegate,
          command === "npx"
            ? "Is Node/npm installed and on your PATH?"
            : `Is ${command} installed?`,
        ),
      )
    })
    child.on("close", (code) => {
      if (code === 0) resolvePromise()
      else
        reject(
          new CliError(
            `\`shadcn add\` exited with code ${code ?? "unknown"}`,
            ExitCode.Delegate,
            "Re-run with --debug to see shadcn's full output.",
          ),
        )
    })
  })
}
