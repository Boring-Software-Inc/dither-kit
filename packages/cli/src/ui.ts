import { cancel, confirm, groupMultiselect, isCancel } from "@clack/prompts"
import { ExitCode } from "./errors.js"

// Thin wrappers over @clack/prompts so every prompt handles Ctrl-C the same
// way: clack returns a cancel symbol, we print a clean message and exit 130
// (no half-written state). Callers must only reach these when stdin is a TTY.

/** Exit immediately and cleanly on cancellation. */
export function bailIfCancelled<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Cancelled.")
    process.exit(ExitCode.Cancelled)
  }
  return value as T
}

export interface Choice {
  value: string
  label: string
  hint?: string
}

/** Grouped multiselect (used by `add` with no names), organised by category.
 * `groups` maps a category heading to its choices. Returns chosen values. */
export async function pickComponents(groups: Record<string, Choice[]>): Promise<string[]> {
  const picked = await groupMultiselect({
    message: "Which components? (space to select, enter to confirm)",
    options: groups,
    required: true,
  })
  return bailIfCancelled(picked) as string[]
}

/** Yes/no confirmation. `initial` is the default when the user just hits enter. */
export async function confirmYes(message: string, initial = true): Promise<boolean> {
  const answer = await confirm({ message, initialValue: initial })
  return bailIfCancelled(answer) as boolean
}
