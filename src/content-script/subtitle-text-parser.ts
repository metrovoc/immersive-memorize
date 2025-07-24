import type { Word } from '@/types'

export interface FuriganaMapping {
  kanji: string        // 汉字部分
  furigana: string     // 对应的Furigana
  startPos: number     // 在纯文本中的起始位置
  endPos: number       // 在纯文本中的结束位置
}

export interface ParsedSubtitleText {
  cleanText: string              // 纯汉字文本，用于日语分析
  displayHTML: string            // 完整HTML，用于显示
  furiganaMap: FuriganaMapping[] // 汉字-Furigana映射关系
}

/**
 * Netflix字幕文本解析器
 * 负责从包含Ruby标签的字幕中提取纯文本和Furigana映射
 */
export class SubtitleTextParser {
  
  /**
   * 解析包含Ruby标签的字幕容器
   * @param container 字幕容器元素
   * @returns 解析结果，包含纯文本、HTML和映射关系
   */
  parse(container: HTMLElement): ParsedSubtitleText {
    // 克隆容器避免影响原DOM
    const clonedContainer = container.cloneNode(true) as HTMLElement
    
    const furiganaMap: FuriganaMapping[] = []
    let cleanText = ''
    
    // 递归处理所有节点
    this.processNode(clonedContainer, furiganaMap, { text: cleanText })
    cleanText = this.getCleanTextFromContainer(clonedContainer)
    
    // 处理显示用的HTML
    const displayHTML = this.prepareDisplayHTML(clonedContainer)
    
    return {
      cleanText,
      displayHTML,
      furiganaMap
    }
  }
  
  /**
   * 递归处理节点，提取Furigana映射
   */
  private processNode(
    node: Node, 
    mappings: FuriganaMapping[], 
    context: { text: string }
  ): void {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement
      
      if (element.tagName === 'RUBY') {
        this.processRubyElement(element, mappings, context)
      } else {
        // 递归处理子节点
        Array.from(node.childNodes).forEach(child => {
          this.processNode(child, mappings, context)
        })
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.textContent || ''
      context.text += textContent
    }
  }
  
  /**
   * 处理Ruby元素，提取汉字和Furigana
   */
  private processRubyElement(
    rubyElement: HTMLElement, 
    mappings: FuriganaMapping[],
    context: { text: string }
  ): void {
    // 查找汉字部分（rb标签或直接的span）
    const kanjiElement = rubyElement.querySelector('span:not(rt span)') || 
                        rubyElement.querySelector('rb') ||
                        rubyElement.firstElementChild
    
    // 查找读音部分（rt标签内的内容）
    const rtElement = rubyElement.querySelector('rt')
    const furiganaElement = rtElement?.querySelector('span') || rtElement
    
    if (kanjiElement && furiganaElement) {
      const kanji = this.extractTextContent(kanjiElement)
      const furigana = this.extractTextContent(furiganaElement)
      
      if (kanji && furigana) {
        const startPos = context.text.length
        
        mappings.push({
          kanji,
          furigana,
          startPos,
          endPos: startPos + kanji.length
        })
        
        context.text += kanji
        
        // 移除rt标签，只保留汉字用于分析
        if (rtElement) {
          rtElement.remove()
        }
      }
    }
  }
  
  /**
   * 提取元素的纯文本内容，用于Furigana分析（移除高亮标记）
   */
  private extractTextContent(element: Element): string {
    // 克隆元素避免影响原DOM
    const clone = element.cloneNode(true) as HTMLElement
    
    // 移除高亮元素，保留其文本内容（仅用于文本分析）
    const highlights = clone.querySelectorAll('.im-highlight')
    highlights.forEach(highlight => {
      const textNode = document.createTextNode(highlight.textContent || '')
      highlight.parentNode?.replaceChild(textNode, highlight)
    })
    
    return clone.textContent || ''
  }
  
  /**
   * 从处理后的容器中获取纯文本（用于日语分析）
   */
  private getCleanTextFromContainer(container: HTMLElement): string {
    // 移除所有rt标签
    container.querySelectorAll('rt').forEach(rt => rt.remove())
    
    // 移除高亮标记，保留文本（仅用于分析）
    const highlights = container.querySelectorAll('.im-highlight')
    highlights.forEach(highlight => {
      const textNode = document.createTextNode(highlight.textContent || '')
      highlight.parentNode?.replaceChild(textNode, highlight)
    })
    
    return container.innerText.trim()
  }
  
  /**
   * 准备用于显示的HTML内容
   */
  private prepareDisplayHTML(container: HTMLElement): string {
    // 清理样式属性，保留im-开头的类
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
    
    // 为Ruby标签添加标识类
    container.querySelectorAll('ruby').forEach(ruby => ruby.classList.add('im-ruby'))
    container.querySelectorAll('rt').forEach(rt => rt.classList.add('im-rt'))
    container.querySelectorAll('rb').forEach(rb => rb.classList.add('im-rb'))
    
    return container.innerHTML
  }
  
  /**
   * 根据词汇位置查找对应的Furigana
   */
  findFuriganaForWord(word: Word, mappings: FuriganaMapping[]): FuriganaMapping | null {
    // 根据词汇在文本中的位置查找对应的Furigana
    for (const mapping of mappings) {
      // 检查词汇是否完全包含在这个汉字区间内
      if (word.word === mapping.kanji || 
          (word.word.length > 0 && mapping.kanji.includes(word.word))) {
        return mapping
      }
    }
    return null
  }
}