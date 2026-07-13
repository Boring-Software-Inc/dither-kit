import type { Registry, RegistryItem } from "@dither-kit/registry-core"

/** Levenshtein edit distance — used to suggest the nearest component name on a
 * typo. Small inputs, so the simple O(n·m) table is fine. */
export function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let curr = new Array<number>(n + 1)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n]!
}

/** The closest name to `input` among `names`, if any is close enough to be a
 * plausible typo (within a third of the length, min 2). */
export function nearestName(input: string, names: string[]): string | undefined {
  let best: string | undefined
  let bestDist = Infinity
  for (const name of names) {
    const d = editDistance(input, name)
    if (d < bestDist) {
      bestDist = d
      best = name
    }
  }
  const threshold = Math.max(2, Math.floor(input.length / 3))
  return best !== undefined && bestDist <= threshold ? best : undefined
}

export interface Resolution {
  found: RegistryItem[]
  missing: { name: string; suggestion?: string }[]
}

/** Map requested names to registry items, collecting misses (with a suggested
 * correction where one is plausible). */
export function resolveNames(names: string[], registry: Registry): Resolution {
  const byName = new Map(registry.items.map((it) => [it.name, it]))
  const allNames = registry.items.map((it) => it.name)
  const found: RegistryItem[] = []
  const missing: { name: string; suggestion?: string }[] = []
  for (const name of names) {
    const item = byName.get(name)
    if (item) found.push(item)
    else missing.push({ name, suggestion: nearestName(name, allNames) })
  }
  return { found, missing }
}
