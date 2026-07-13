// Distinct exit codes for the main failure modes, so scripts can branch on
// *why* a run failed (clig.dev: "Map the non-zero exit codes to the most
// important failure modes").

export const ExitCode = {
  /** Everything worked. */
  Ok: 0,
  /** Catch-all failure. */
  Error: 1,
  /** Bad invocation: unknown command/flag, invalid argument. */
  Usage: 2,
  /** Registry unreachable and no usable cache to fall back to. */
  Network: 3,
  /** No components.json / not a usable project. */
  NoProject: 4,
  /** A required value was missing under --no-input. */
  MissingInput: 5,
  /** The delegated `shadcn add` failed. */
  Delegate: 6,
  /** The user asked for a component that does not exist. */
  NotFound: 7,
  /** The user cancelled an interactive prompt (Ctrl-C). */
  Cancelled: 130,
} as const

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode]

/**
 * An error we know how to explain to a human. Carries the exit code and,
 * optionally, a `hint` line telling the user what to do next.
 */
export class CliError extends Error {
  readonly code: ExitCodeValue
  readonly hint?: string

  constructor(message: string, code: ExitCodeValue = ExitCode.Error, hint?: string) {
    super(message)
    this.name = "CliError"
    this.code = code
    this.hint = hint
  }
}
