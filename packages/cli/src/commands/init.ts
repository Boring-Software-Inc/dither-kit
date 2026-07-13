import { select } from "@clack/prompts"
import type { InstallMode } from "@dither-kit/registry-core"
import type { Context } from "../context.js"
import { CliError, ExitCode } from "../errors.js"
import { emptyLockfile, readLockfile, writeLockfile } from "../lockfile.js"
import { Logger, json } from "../output.js"
import { hasTailwind, requireProject } from "../project.js"
import { bailIfCancelled } from "../ui.js"

export interface InitOptions {
  mode?: string
}

/**
 * Prepare a project to use Dither Kit. The one question that matters is how the
 * project consumes the kit — vendored source (the shadcn way) or, later, an npm
 * package — after which we record a lockfile so `add`/`update`/`diff` have a
 * home. Writes nothing under --dry-run.
 */
export async function init(ctx: Context, opts: InitOptions = {}): Promise<number> {
  const log = new Logger(ctx)
  const project = requireProject(ctx)

  // Tailwind is a hard requirement — without it the components render unstyled.
  if (!hasTailwind(project.root)) {
    log.warn(
      "Tailwind CSS was not detected. Dither Kit components are unstyled without it —",
    )
    log.warn("set up Tailwind before you rely on the output (https://tailwindcss.com/docs/installation).")
  }

  const mode = await resolveMode(ctx, opts, log)

  if (ctx.dryRun) {
    if (ctx.json) json({ dryRun: true, root: project.root, mode })
    else {
      log.info(ctx.c.bold("Dry run — nothing will be written."))
      log.info(`Would initialise ${ctx.c.dim(project.root)} in ${ctx.c.cyan(mode)} mode.`)
    }
    return 0
  }

  // Preserve any components already recorded; just (re)establish the lockfile.
  const existing = readLockfile(project.root)
  const lock = existing
    ? { ...existing, registry: ctx.registry, mode }
    : emptyLockfile(ctx.registry, mode)
  writeLockfile(project.root, lock)

  if (ctx.json) {
    json({ initialised: true, root: project.root, mode, registry: ctx.registry })
    return 0
  }

  log.step(`Initialised Dither Kit in ${ctx.c.cyan(mode)} mode.`)
  log.detail(`  wrote dither-kit.json in ${project.root}`)
  log.next("dither-kit add   # pick components to install")
  return 0
}

async function resolveMode(ctx: Context, opts: InitOptions, log: Logger): Promise<InstallMode> {
  // Flag wins (scriptable). Validate it explicitly.
  if (opts.mode !== undefined) {
    if (opts.mode !== "source" && opts.mode !== "package") {
      throw new CliError(
        `invalid --mode "${opts.mode}"`,
        ExitCode.Usage,
        "Use --mode source or --mode package.",
      )
    }
    return normalizeMode(opts.mode, log)
  }

  // No flag, no TTY: fall back to the sensible default rather than failing —
  // source is the only mode available today.
  if (!ctx.interactive) return "source"

  const choice = await select({
    message: "How do you want to use Dither Kit?",
    options: [
      {
        value: "source",
        label: "Copy the source in (recommended)",
        hint: "vendored into your repo, editable, tracked by dither-kit.json",
      },
      {
        value: "package",
        label: "Install as a package",
        hint: "coming soon — not yet published",
      },
    ],
    initialValue: "source",
  })
  return normalizeMode(bailIfCancelled(choice) as string, log)
}

/** Package mode isn't available yet; accept the choice but fall back to source
 * and say so, rather than pretending. */
function normalizeMode(mode: string, log: Logger): InstallMode {
  if (mode === "package") {
    log.warn("Package mode isn't available yet — falling back to copying the source in.")
    return "source"
  }
  return "source"
}
