// A minimal unified-diff for two small text blobs, via an LCS table. Files in
// this registry are at most a few hundred lines, so the O(n·m) table is fine
// and pulling in a diff dependency would be overkill.

export type DiffLine = { kind: " " | "-" | "+"; text: string }

export function diffLines(a: string, b: string): DiffLine[] {
  const al = a.split("\n")
  const bl = b.split("\n")
  const n = al.length
  const m = bl.length

  // lcs[i][j] = length of LCS of al[i:] and bl[j:]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = al[i] === bl[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (al[i] === bl[j]) {
      out.push({ kind: " ", text: al[i]! })
      i++
      j++
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push({ kind: "-", text: al[i]! })
      i++
    } else {
      out.push({ kind: "+", text: bl[j]! })
      j++
    }
  }
  while (i < n) out.push({ kind: "-", text: al[i++]! })
  while (j < m) out.push({ kind: "+", text: bl[j++]! })
  return out
}

/** Render a diff compactly: changed lines with a little surrounding context,
 * collapsing long unchanged runs. */
export function renderDiff(lines: DiffLine[], context = 2): string[] {
  const changed = lines.map((l) => l.kind !== " ")
  const keep = new Array<boolean>(lines.length).fill(false)
  for (let i = 0; i < lines.length; i++) {
    if (changed[i]) {
      for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) {
        keep[k] = true
      }
    }
  }
  const out: string[] = []
  let gap = false
  for (let i = 0; i < lines.length; i++) {
    if (keep[i]) {
      out.push(`${lines[i]!.kind}${lines[i]!.text}`)
      gap = false
    } else if (!gap) {
      out.push("…")
      gap = true
    }
  }
  return out
}

/** True when the two blobs differ in any line. */
export function differs(a: string, b: string): boolean {
  return a !== b
}
