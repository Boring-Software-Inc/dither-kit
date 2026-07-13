import { homedir } from "node:os"
import { join } from "node:path"

// XDG base directories (clig.dev: follow the XDG spec). Honour the env
// overrides; fall back to the conventional ~/.cache and ~/.config.

export function cacheDir(): string {
  const base =
    process.env.XDG_CACHE_HOME && process.env.XDG_CACHE_HOME.length > 0
      ? process.env.XDG_CACHE_HOME
      : join(homedir(), ".cache")
  return join(base, "dither-kit")
}

export function configDir(): string {
  const base =
    process.env.XDG_CONFIG_HOME && process.env.XDG_CONFIG_HOME.length > 0
      ? process.env.XDG_CONFIG_HOME
      : join(homedir(), ".config")
  return join(base, "dither-kit")
}
