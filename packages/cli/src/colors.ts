import pc from "picocolors"

export type Colors = ReturnType<typeof pc.createColors>

/** picocolors, forced on or off by our resolved decision rather than
 * picocolors' own auto-detection — so --no-color, NO_COLOR, non-TTY, and
 * --json all route through {@link resolveColor} in one place. */
export function createColors(enabled: boolean): Colors {
  return pc.createColors(enabled)
}
