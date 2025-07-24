import type { Word } from '@/types'

export interface FuriganaMapping {
  kanji: string
  furigana: string
  startPos: number
  endPos: number
}

export interface ParsedSubtitleText {
  cleanText: string
  displayHTML: string
  furiganaMap: FuriganaMapping[]
}

/**
 * Netflix字幕文本解析器
 * 负责从包含Ruby标签的字幕中提取纯文本和Furigana映射
 */
export class SubtitleTextParser {
  public parse(container: HTMLElement): ParsedSubtitleText {
    // Clone 1: For creating the display HTML. Will be cleaned but content preserved.
    const displayClone = container.cloneNode(true) as HTMLElement
    const displayHTML = this.prepareDisplayHTML(displayClone)

    // Clone 2: For analysis. Will be modified to extract clean text and mappings.
    const analysisClone = container.cloneNode(true) as HTMLElement
    const { cleanText, furiganaMap } = this.extractAnalysisData(analysisClone)

    return {
      cleanText,
      displayHTML,
      furiganaMap,
    }
  }

  /**
   * Prepares the HTML for display.
   * Cleans up styles and classes but preserves all content, including highlights.
   */
  private prepareDisplayHTML(container: HTMLElement): string {
    container.querySelectorAll('[style]').forEach(el => {
      if (!el.classList.contains('im-highlight')) {
        el.removeAttribute('style')
      }
    })

    container.querySelectorAll('[class]').forEach(el => {
      const classesToKeep: string[] = []
      for (const cls of el.classList) {
        if (cls.startsWith('im-')) {
          classesToKeep.push(cls)
        }
      }
      el.className = classesToKeep.join(' ')
    })

    container.querySelectorAll('ruby').forEach(ruby => ruby.classList.add('im-ruby'))
    container.querySelectorAll('rt').forEach(rt => rt.classList.add('im-rt'))
    container.querySelectorAll('rb').forEach(rb => rb.classList.add('im-rb'))

    return container.innerHTML
  }

  /**
   * Extracts clean text and Furigana mappings for analysis.
   * This is a destructive operation on the provided container element.
   */
  private extractAnalysisData(
    container: HTMLElement,
  ): { cleanText: string; furiganaMap: FuriganaMapping[] } {
    const furiganaMap: FuriganaMapping[] = []

    // First, get rid of highlights, replacing them with their text content.
    // This simplifies the tree walker.
    container.querySelectorAll('.im-highlight').forEach(highlight => {
      const textNode = document.createTextNode(highlight.textContent || '')
      highlight.parentNode?.replaceChild(textNode, highlight)
    })

    const context = { text: '' }

    // This recursive function will build the clean text and the furigana map.
    this.buildCleanTextAndMappings(container, furiganaMap, context)

    const cleanText = context.text

    return { cleanText, furiganaMap }
  }

  /**
   * Recursively traverses the DOM to build clean text and Furigana mappings.
   * This is a destructive operation as it removes <rt> elements.
   */
  private buildCleanTextAndMappings(
    node: Node,
    mappings: FuriganaMapping[],
    context: { text: string },
  ): void {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement

      if (element.tagName === 'RUBY') {
        const kanjiElement =
          element.querySelector('rb') || element.querySelector('span:not(rt span)')
        const rtElement = element.querySelector('rt')

        if (kanjiElement && rtElement) {
          const kanji = (kanjiElement.textContent || '').trim()
          const furigana = (rtElement.textContent || '').trim()

          if (kanji && furigana) {
            const startPos = context.text.length
            mappings.push({
              kanji,
              furigana,
              startPos,
              endPos: startPos + kanji.length,
            })
          }
          // Remove the furigana part so it's not added to the clean text
          rtElement.remove()
        }
      }
      // Continue traversal for children
      Array.from(node.childNodes).forEach(child => {
        this.buildCleanTextAndMappings(child, mappings, context)
      })
    } else if (node.nodeType === Node.TEXT_NODE) {
      // Append text content to the context
      context.text += node.textContent || ''
    }
  }

  /**
   * Finds the corresponding Furigana for a given word based on its position.
   */
  public findFuriganaForWord(word: Word, mappings: FuriganaMapping[]): FuriganaMapping | null {
    for (const mapping of mappings) {
      if (
        word.word === mapping.kanji ||
        (word.word.length > 0 && mapping.kanji.includes(word.word))
      ) {
        return mapping
      }
    }
    return null
  }
}
