// Splits a prompt into the parts the person typed (editable) and the parts
// that must reach the model byte-for-byte (pastes, code, URLs). Protected
// parts are swapped for ⟦N⟧ placeholders before the correction call and
// swapped back afterwards.

type Range = { start: number; end: number }

export type Masked = {
  masked: string
  protectedParts: string[]
}

const OPEN = '⟦'
const CLOSE = '⟧'
const PLACEHOLDER = /⟦(\d+)⟧/g

const ALWAYS_PROTECTED: RegExp[] = [
  // Pastes the engine marks for the model.
  /<pasted_content\b[^>]*>[\s\S]*?<\/pasted_content\b[^>]*>/g,
  // Fenced code, closed or running to the end.
  /```[\s\S]*?(?:```|$)/g,
  /`[^`\n]+`/g,
  /\bhttps?:\/\/\S+/g,
]

// A paste arrives as one edit with no key; so does a fast burst of typing,
// which is short and single-line, so small keyless edits stay editable.
export const looksPasted = (inputText: string): boolean =>
  inputText.length >= 8 || (inputText.length > 1 && inputText.includes('\n'))

const findRanges = (text: string, pastes: readonly string[]): Range[] => {
  const ranges: Range[] = []

  for (const pattern of ALWAYS_PROTECTED) {
    for (const m of text.matchAll(pattern)) {
      ranges.push({ start: m.index, end: m.index + m[0].length })
    }
  }

  for (const paste of pastes) {
    if (paste.trim() === '') continue
    for (let at = text.indexOf(paste); at !== -1; at = text.indexOf(paste, at + paste.length)) {
      ranges.push({ start: at, end: at + paste.length })
    }
  }

  ranges.sort((a, b) => a.start - b.start || b.end - a.end)

  const merged: Range[] = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end)
    } else {
      merged.push({ ...r })
    }
  }
  return merged
}

export const mask = (text: string, pastes: readonly string[]): Masked => {
  const protectedParts: string[] = []
  let masked = ''
  let at = 0

  for (const r of findRanges(text, pastes)) {
    masked += text.slice(at, r.start) + OPEN + protectedParts.length + CLOSE
    protectedParts.push(text.slice(r.start, r.end))
    at = r.end
  }
  masked += text.slice(at)

  return { masked, protectedParts }
}

// The typed words alone, placeholders removed.
export const editableText = (masked: string): string => masked.replace(PLACEHOLDER, '')

// Puts the protected parts back, or returns undefined when the model lost,
// duplicated, reordered or invented a placeholder.
export const unmask = (corrected: string, protectedParts: readonly string[]): string | undefined => {
  const seen = [...corrected.matchAll(PLACEHOLDER)].map(m => Number(m[1]))
  const isIntact =
    seen.length === protectedParts.length && seen.every((n, i) => n === i)

  if (!isIntact) return undefined

  return corrected.replace(PLACEHOLDER, (_, n: string) => protectedParts[Number(n)] ?? '')
}

export const hasPlaceholderChars = (text: string): boolean =>
  text.includes(OPEN) || text.includes(CLOSE)
