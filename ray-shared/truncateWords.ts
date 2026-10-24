export const LIST_REFLECTION_MAX_WORDS = 15
export const LIST_BIBLE_VERSE_MAX_WORDS = 15

export function truncateWords(text: string, maxWords: number): string {
  const trimmed = text.trim()
  if (!trimmed || maxWords < 1) return trimmed

  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return trimmed

  return `${words.slice(0, maxWords).join(' ')}\u2026`
}
