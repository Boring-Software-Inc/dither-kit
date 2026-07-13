import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"
import type { Context } from "./context.js"
import { CliError, ExitCode } from "./errors.js"

export interface Project {
  /** The project root (directory containing components.json). */
  root: string
  /** Absolute path to components.json. */
  componentsJson: string
}

/** Walk up from `start` looking for a components.json. Returns its directory, or
 * null if none is found before the filesystem root. */
export function findComponentsJson(start: string): string | null {
  let dir = resolve(start)
  for (;;) {
    if (existsSync(join(dir, "components.json"))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/**
 * Locate the project to operate in. When --dir is passed it is authoritative
 * (we look there and only there); otherwise we search upward from the cwd.
 * Fails with an actionable message when there is no shadcn project.
 */
export function requireProject(ctx: Context): Project {
  const dir = isAbsolute(ctx.dir) ? ctx.dir : resolve(process.cwd(), ctx.dir)

  const root = ctx.dir === process.cwd() || !hasExplicitDir(ctx) ? findComponentsJson(dir) : localOnly(dir)

  if (!root) {
    throw new CliError(
      "no components.json found — this doesn't look like a shadcn project.",
      ExitCode.NoProject,
      "Run `npx shadcn@latest init` first, or pass --dir <path> to point at your project.",
    )
  }
  return { root, componentsJson: join(root, "components.json") }
}

/** True when the user explicitly passed --dir (vs. the cwd default). */
function hasExplicitDir(ctx: Context): boolean {
  return resolve(ctx.dir) !== resolve(process.cwd())
}

function localOnly(dir: string): string | null {
  return existsSync(join(dir, "components.json")) ? dir : null
}

/**
 * Best-effort Tailwind detection. Dither Kit components are unstyled without
 * Tailwind, so `init` warns loudly when it's missing. We check for a config
 * file or a `tailwindcss` import in common CSS entry points.
 */
export function hasTailwind(root: string): boolean {
  const configs = [
    "tailwind.config.js",
    "tailwind.config.cjs",
    "tailwind.config.mjs",
    "tailwind.config.ts",
  ]
  if (configs.some((f) => existsSync(join(root, f)))) return true

  // Tailwind v4 drops the config file and uses `@import "tailwindcss"` in CSS.
  const pkgPath = join(root, "package.json")
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      if (deps && typeof deps === "object" && "tailwindcss" in deps) return true
    } catch {
      // ignore
    }
  }
  return false
}

/** Detect the package runner to use for `shadcn`, from the project's lockfiles. */
export function detectRunner(root: string): "npx" | "pnpm" | "yarn" | "bun" {
  const files = new Set(safeReaddir(root))
  if (files.has("bun.lockb") || files.has("bun.lock")) return "bun"
  if (files.has("pnpm-lock.yaml")) return "pnpm"
  if (files.has("yarn.lock")) return "yarn"
  return "npx"
}

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}
