import { CliError, ExitCode } from "./errors.js"

/** Default network timeout, overridable for slow links / CI. */
export function timeoutMs(): number {
  const raw = process.env.DITHER_KIT_TIMEOUT
  const n = raw ? Number.parseInt(raw, 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : 10_000
}

/**
 * Resolve the proxy that applies to `url`, honouring HTTPS_PROXY / HTTP_PROXY /
 * ALL_PROXY and the NO_PROXY exclusion list (clig.dev: respect the proxy env).
 * Returns the proxy URL or null.
 */
export function proxyFor(url: string): string | null {
  let host: string
  let isHttps: boolean
  try {
    const u = new URL(url)
    host = u.hostname
    isHttps = u.protocol === "https:"
  } catch {
    return null
  }

  const noProxy = process.env.NO_PROXY ?? process.env.no_proxy
  if (noProxy && matchesNoProxy(host, noProxy)) return null

  const pick = (...names: string[]): string | null => {
    for (const name of names) {
      const v = process.env[name] ?? process.env[name.toLowerCase()]
      if (v && v.length > 0) return v
    }
    return null
  }

  return isHttps
    ? pick("HTTPS_PROXY", "ALL_PROXY")
    : pick("HTTP_PROXY", "ALL_PROXY")
}

function matchesNoProxy(host: string, noProxy: string): boolean {
  const entries = noProxy
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  for (const entry of entries) {
    if (entry === "*") return true
    const bare = entry.replace(/^\./, "")
    if (host === bare || host.endsWith(`.${bare}`)) return true
  }
  return false
}

/**
 * Best-effort proxy dispatcher. Node's global fetch (undici) does not read the
 * proxy env by itself; if a proxy applies and `undici` is importable we build a
 * ProxyAgent. If it is not available we proceed proxy-less rather than fail —
 * and say so under --debug via the returned `note`.
 */
async function dispatcherFor(
  url: string,
): Promise<{ dispatcher?: unknown; note?: string }> {
  const proxy = proxyFor(url)
  if (!proxy) return {}
  try {
    // Indirect specifier so the bundler doesn't try to inline undici and TS
    // doesn't require its types — it is an optional, runtime-only dependency.
    const spec = "undici"
    const undici = (await import(spec)) as {
      ProxyAgent: new (uri: string) => unknown
    }
    return { dispatcher: new undici.ProxyAgent(proxy) }
  } catch {
    return { note: `proxy ${proxy} requested but 'undici' is unavailable; continuing without it` }
  }
}

export interface FetchResult {
  text: string
  note?: string
}

/**
 * Fetch a URL as text with an explicit timeout and proxy support. Throws a
 * {@link CliError} with a human message on timeout, network failure, or a
 * non-2xx status — never a raw stack.
 */
export async function fetchText(url: string): Promise<FetchResult> {
  const controller = new AbortController()
  const ms = timeoutMs()
  const timer = setTimeout(() => controller.abort(), ms)
  const { dispatcher, note } = await dispatcherFor(url)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // `dispatcher` is an undici-only option; harmless when undefined.
      ...(dispatcher ? { dispatcher } : {}),
      headers: { accept: "application/json" },
    } as RequestInit)
    if (!res.ok) {
      throw new CliError(
        `registry responded ${res.status} ${res.statusText} for ${url}`,
        ExitCode.Network,
      )
    }
    return { text: await res.text(), note }
  } catch (err) {
    if (err instanceof CliError) throw err
    if (err instanceof Error && err.name === "AbortError") {
      throw new CliError(
        `registry request timed out after ${ms}ms: ${url}`,
        ExitCode.Network,
        "Check your connection, or set DITHER_KIT_TIMEOUT to allow more time.",
      )
    }
    const reason = err instanceof Error ? err.message : String(err)
    throw new CliError(`could not reach the registry: ${reason}`, ExitCode.Network)
  } finally {
    clearTimeout(timer)
  }
}
