import pkg from "../package.json"

/** The CLI version, sourced from package.json so it can never drift. */
export const version: string = (pkg as { version: string }).version
