import type { Word } from '@/types'

export interface FuriganaMapping {
  kanji: string
  furigana: string
}

export interface ParsedSubtitle {
  /** Text without furigana, for analysis. */
  text: string
  furigana: FuriganaMapping[]
}

/** Reads a subtitle element, separating ruby annotations (furigana) from the base text. */
export function parseSubtitle(container: HTMLElement): ParsedSubtitle {
  const analysis = container.cloneNode(true) as HTMLElement
  const furigana: FuriganaMapping[] = []
  let text = ''
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? ''
      return
    }
    if (!(node instanceof Element)) return
    if (node.localName === 'ruby') {
      const base = node.querySelector('rb') ?? node.querySelector('span:not(rt span)')
      const reading = node.querySelector('rt')
      if (base && reading) {
        const kanji = base.textContent?.trim() ?? ''
        const kana = reading.textContent?.trim() ?? ''
        if (kanji && kana) furigana.push({ kanji, furigana: kana })
      }
      node.querySelectorAll('rt, rp').forEach(element => element.remove())
    }
    node.childNodes.forEach(walk)
  }
  walk(analysis)

  return { text, furigana }
}

export function findFurigana(word: Word, mappings: FuriganaMapping[]): FuriganaMapping | null {
  return (
    mappings.find(
      mapping => word.word === mapping.kanji || (word.word && mapping.kanji.includes(word.word))
    ) ?? null
  )
}
