import { JLPT_LEVELS, type JlptLevel, type VocabEntry, type WordInfo } from '@/types'

const KANA = /^[぀-ヿー]+$/

/**
 * Turns a dictionary headword into the form the analyzer produces as a lemma, e.g.
 * "〜やすい" → "やすい", "石 鹸[けん]" → "石鹸", "ああ(嘆)" → "ああ".
 */
export function vocabKey(headword: string): string {
  return headword
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[〜～\s]/g, '')
}

/** The kana reading of an entry; loanwords store their etymology in this field instead. */
export function entryReading(entry: VocabEntry): string {
  const reading = entry.VocabFurigana.replace(/[〜～\s]/g, '')
  return KANA.test(reading) ? reading : ''
}

export function entryDefinition(entry: VocabEntry, language: 'en' | 'zh'): string {
  return (language === 'zh' ? entry.VocabDefCN : entry.VocabDefEN) || ''
}

export function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60))
}

function normalizeReading(reading: string): string {
  return toHiragana(reading.normalize('NFC')).replace(/ー/g, '').replace(/っ/g, 'つ')
}

/**
 * Whether furigana seen in a subtitle plausibly belongs to a dictionary reading. Inflected
 * forms and small differences (long vowels, sokuon) still count as a match.
 */
export function readingsMatch(contextReading: string, dictionaryReading: string): boolean {
  const context = normalizeReading(contextReading)
  const dictionary = normalizeReading(dictionaryReading)
  if (!context || !dictionary) return false
  if (context.includes(dictionary) || dictionary.includes(context)) return true
  return similarity(context, dictionary) > 0.8
}

function similarity(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
    }
    previous = current
  }
  const longest = Math.max(a.length, b.length)
  return (longest - previous[b.length]) / longest
}

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(chrome.runtime.getURL(path))
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`)
  return response.json()
}

function isJlptLevel(level: string): level is JlptLevel {
  return (JLPT_LEVELS as readonly string[]).includes(level)
}

/** The bundled JLPT word list, indexed by lemma. */
export class Vocabulary {
  private readonly byKey = new Map<string, VocabEntry[]>()

  constructor(readonly entries: VocabEntry[]) {
    for (const entry of entries) {
      const key = vocabKey(entry.VocabKanji)
      const list = this.byKey.get(key)
      if (list) list.push(entry)
      else this.byKey.set(key, [entry])
    }
  }

  /** Loads the word list and its English definitions, which are kept in a separate file. */
  static async load(): Promise<Vocabulary> {
    const [entries, english] = await Promise.all([
      loadJson<VocabEntry[]>('dict/jlpt.json'),
      loadJson<Record<string, Record<string, string>>>('dict/jmdict-en.json'),
    ])
    for (const entry of entries) {
      entry.VocabDefEN = english[entry.VocabKanji]?.[entry.VocabFurigana] ?? ''
    }
    return new Vocabulary(entries)
  }

  entriesForLevel(level: JlptLevel): VocabEntry[] {
    return this.entries.filter(entry => entry.Level === level)
  }

  /** Readings of every word in the enabled levels, keyed by lemma, for subtitle matching. */
  activeWords(levels: readonly JlptLevel[]): [string, string[]][] {
    const enabled = new Set<string>(levels)
    const words = new Map<string, string[]>()
    for (const [key, entries] of this.byKey) {
      const active = entries.filter(entry => enabled.has(entry.Level))
      if (active.length > 0) words.set(key, active.map(entryReading).filter(Boolean))
    }
    return [...words]
  }

  lookup(word: string, language: 'en' | 'zh'): WordInfo | null {
    const entry = this.byKey.get(word)?.find(candidate => isJlptLevel(candidate.Level))
    if (!entry) return null
    return {
      level: entry.Level as JlptLevel,
      reading: entryReading(entry),
      definition: entryDefinition(entry, language),
    }
  }
}
