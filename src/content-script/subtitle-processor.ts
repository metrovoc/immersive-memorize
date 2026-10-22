import { callBackground } from '@/lib/messages'
import { readingsMatch } from '@/lib/vocab'
import type { Word } from '@/types'
import { findFurigana, parseSubtitle, type FuriganaMapping } from './subtitle-text-parser'

const NON_LEARNABLE = new Set([
  'postposition',
  'symbol',
  'interjection',
  'prefix',
  'other',
  'tbd',
  'TBD',
])
const CACHE_SIZE = 200

/** Finds the first word in a subtitle that the user is learning and has not saved yet. */
export class SubtitleProcessor {
  private readonly analyses = new Map<string, Word[]>()

  constructor(
    /** Readings of the active vocabulary, keyed by dictionary form. */
    private activeWords: Map<string, string[]>,
    private learnedWords: Set<string>
  ) {}

  setActiveWords(activeWords: Map<string, string[]>): void {
    this.activeWords = activeWords
  }

  setLearnedWords(learnedWords: Set<string>): void {
    this.learnedWords = learnedWords
  }

  async findTarget(container: HTMLElement): Promise<Word | null> {
    const { text, furigana } = parseSubtitle(container)
    if (!text.trim()) return null
    const words = await this.analyze(text)
    return words.find(word => this.isTarget(word, furigana)) ?? null
  }

  private async analyze(text: string): Promise<Word[]> {
    const cached = this.analyses.get(text)
    if (cached) return cached
    const words = await callBackground('analyzeText', { text })
    this.analyses.set(text, words)
    if (this.analyses.size > CACHE_SIZE) this.analyses.delete(this.analyses.keys().next().value!)
    return words
  }

  private isTarget(word: Word, furigana: FuriganaMapping[]): boolean {
    if (NON_LEARNABLE.has(word.part_of_speech)) return false
    if (word.tokens.length === 1 && /^[\p{P}\p{S}]$/u.test(word.word)) return false
    const readings = this.activeWords.get(word.lemma)
    if (!readings || this.learnedWords.has(word.lemma)) return false
    // When the subtitle shows furigana, it has to agree with the dictionary; this keeps names
    // written with common kanji from being picked.
    const mapping = findFurigana(word, furigana)
    return !mapping || readings.some(reading => readingsMatch(mapping.furigana, reading))
  }
}

const HIGHLIGHT_STYLE = `
  background-color: #ff9800 !important; color: #000 !important; font-weight: bold !important;
  text-shadow: none !important;
  padding: 0 3px !important; margin: 0 -3px !important; border-radius: 4px !important;
  box-shadow: 0 0 8px rgba(255, 152, 0, 0.6) !important;
  animation: im-pulse 2s ease-in-out infinite !important;
`

/** Wraps the last occurrence of the word's surface form in a highlight. */
export function highlightWord(container: HTMLElement, word: Word): HTMLElement | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

  for (const node of textNodes.reverse()) {
    const text = node.textContent ?? ''
    const index = text.lastIndexOf(word.word)
    if (index === -1 || !node.parentNode) continue
    const highlight = document.createElement('span')
    highlight.className = 'im-highlight im-current-target'
    highlight.style.cssText = HIGHLIGHT_STYLE
    highlight.textContent = word.word
    const after = node.splitText(index)
    after.textContent = text.slice(index + word.word.length)
    node.parentNode.insertBefore(highlight, after)
    if (!after.textContent) after.remove()
    return highlight
  }
  return null
}

export function clearHighlights(): void {
  document.querySelectorAll('.im-highlight').forEach(highlight => {
    const parent = highlight.parentNode
    highlight.replaceWith(document.createTextNode(highlight.textContent ?? ''))
    parent?.normalize()
  })
}
