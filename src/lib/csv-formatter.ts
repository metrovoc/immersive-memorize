import type { FlashCard } from '@/types'

export enum CSVExportFormat {
  PLAIN_TEXT = 'plain-text',      // 纯文本格式
  ANKI_HTML = 'anki-html',        // Anki兼容的HTML格式
  RICH_TEXT = 'rich-text'         // 保留Ruby标签的富文本格式
}

export interface CSVExportOptions {
  format: CSVExportFormat
  separator: string
  includeScreenshots: boolean
  includeTimestamp: boolean
  includeSource: boolean
}

/**
 * CSV导出格式化器
 * 解决HTML内容破坏CSV格式的问题
 */
export class CSVFormatter {
  
  /**
   * 导出记忆卡片为CSV格式
   */
  exportFlashCards(
    cards: FlashCard[], 
    options: CSVExportOptions = this.getDefaultOptions()
  ): string {
    if (cards.length === 0) {
      throw new Error('没有卡片可导出')
    }

    const header = this.buildHeader(options)
    const rows = cards.map(card => this.formatCardRow(card, options))
    
    return [header, ...rows].join('\n')
  }

  /**
   * 获取默认导出选项
   */
  private getDefaultOptions(): CSVExportOptions {
    return {
      format: CSVExportFormat.ANKI_HTML,
      separator: ';',
      includeScreenshots: true,
      includeTimestamp: true,
      includeSource: true
    }
  }

  /**
   * 构建CSV头部
   */
  private buildHeader(options: CSVExportOptions): string {
    const fields = ['Word', 'Reading', 'Definition', 'Sentence']
    
    if (options.includeScreenshots) fields.push('Screenshot')
    if (options.includeTimestamp) fields.push('Timestamp') 
    if (options.includeSource) fields.push('Source')
    
    return fields.join(options.separator)
  }

  /**
   * 格式化单个卡片行
   */
  private formatCardRow(card: FlashCard, options: CSVExportOptions): string {
    const fields: string[] = []
    
    // 词汇
    fields.push(this.escapeCSVField(card.word, options.separator))
    
    // 读音
    fields.push(this.escapeCSVField(card.reading || '', options.separator))
    
    // 定义
    fields.push(this.escapeCSVField(card.definition || '', options.separator))
    
    // 句子（根据格式选项处理）
    const formattedSentence = this.formatSentence(card.sentence, options.format)
    fields.push(this.escapeCSVField(formattedSentence, options.separator))
    
    // 可选字段
    if (options.includeScreenshots) {
      const screenshot = card.screenshot ? 
        this.formatScreenshot(card.screenshot, options.format) : ''
      fields.push(this.escapeCSVField(screenshot, options.separator))
    }
    
    if (options.includeTimestamp) {
      fields.push(this.formatTimestamp(card.timestamp))
    }
    
    if (options.includeSource) {
      fields.push(this.escapeCSVField(card.sourceTitle, options.separator))
    }
    
    return fields.join(options.separator)
  }

  /**
   * 根据格式选项处理句子内容
   */
  private formatSentence(sentence: string, format: CSVExportFormat): string {
    if (!sentence) return ''

    switch (format) {
      case CSVExportFormat.PLAIN_TEXT:
        return this.convertToPlainText(sentence)
      
      case CSVExportFormat.ANKI_HTML:
        return this.convertToAnkiHTML(sentence)
      
      case CSVExportFormat.RICH_TEXT:
        return this.cleanRichTextHTML(sentence)
      
      default:
        return this.convertToPlainText(sentence)
    }
  }

  /**
   * 转换为纯文本格式
   */
  private convertToPlainText(htmlContent: string): string {
    if (!htmlContent) return ''
    
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = htmlContent
    
    // 移除rt标签（Furigana）
    tempDiv.querySelectorAll('rt').forEach(rt => rt.remove())
    
    // 移除高亮标记，保留文本
    tempDiv.querySelectorAll('.im-highlight').forEach(highlight => {
      const textNode = document.createTextNode(highlight.textContent || '')
      highlight.parentNode?.replaceChild(textNode, highlight)
    })
    
    // 处理Ruby标签：保留rb内容，移除rt
    tempDiv.querySelectorAll('ruby').forEach(ruby => {
      const rb = ruby.querySelector('rb') || ruby.querySelector('span:not(rt span)')
      if (rb) {
        const textNode = document.createTextNode(rb.textContent || '')
        ruby.parentNode?.replaceChild(textNode, ruby)
      }
    })
    
    return tempDiv.innerText.trim()
  }

  /**
   * 转换为Anki兼容的HTML格式
   */
  private convertToAnkiHTML(htmlContent: string): string {
    if (!htmlContent) return ''
    
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = htmlContent
    
    // 移除高亮标记，保留文本
    tempDiv.querySelectorAll('.im-highlight').forEach(highlight => {
      const textNode = document.createTextNode(highlight.textContent || '')
      highlight.parentNode?.replaceChild(textNode, highlight)
    })
    
    // 转换Ruby标签为Anki格式：汉字[读音]
    tempDiv.querySelectorAll('ruby').forEach(ruby => {
      const rb = ruby.querySelector('rb') || ruby.querySelector('span:not(rt span)')
      const rt = ruby.querySelector('rt')
      
      if (rb && rt) {
        const rbText = this.extractTextContent(rb)
        const rtText = this.extractTextContent(rt)
        
        if (rbText && rtText) {
          const ankiFormat = `${rbText}[${rtText}]`
          const textNode = document.createTextNode(ankiFormat)
          ruby.parentNode?.replaceChild(textNode, ruby)
        }
      }
    })
    
    // 清理其他HTML标签，保留基本格式
    return this.cleanHTMLForCSV(tempDiv.innerHTML)
  }

  /**
   * 清理富文本HTML
   */
  private cleanRichTextHTML(htmlContent: string): string {
    if (!htmlContent) return ''
    
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = htmlContent
    
    // 移除内联样式
    tempDiv.querySelectorAll('[style]').forEach(el => {
      if (!el.classList.contains('im-highlight')) {
        el.removeAttribute('style')
      }
    })
    
    // 清理类名，只保留im-开头的
    tempDiv.querySelectorAll('[class]').forEach(el => {
      const classesToKeep: string[] = []
      for (const cls of el.classList) {
        if (cls.startsWith('im-')) {
          classesToKeep.push(cls)
        }
      }
      el.className = classesToKeep.join(' ')
    })
    
    return this.cleanHTMLForCSV(tempDiv.innerHTML)
  }

  /**
   * 清理HTML内容，移除可能破坏CSV的元素
   */
  private cleanHTMLForCSV(html: string): string {
    return html
      .replace(/\r?\n/g, ' ')  // 移除换行符
      .replace(/\s+/g, ' ')    // 合并多个空格
      .trim()
  }

  /**
   * 提取元素的纯文本内容
   */
  private extractTextContent(element: Element): string {
    const clone = element.cloneNode(true) as HTMLElement
    
    // 移除高亮标记，保留文本
    clone.querySelectorAll('.im-highlight').forEach(highlight => {
      const textNode = document.createTextNode(highlight.textContent || '')
      highlight.parentNode?.replaceChild(textNode, highlight)
    })
    
    return clone.textContent?.trim() || ''
  }

  /**
   * 格式化截图
   */
  private formatScreenshot(screenshot: string, format: CSVExportFormat): string {
    if (format === CSVExportFormat.PLAIN_TEXT) {
      return '[截图]' // 纯文本模式下用占位符
    }
    return `<img src="${screenshot}">` // HTML模式下用img标签
  }

  /**
   * 格式化时间戳
   */
  private formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  /**
   * CSV字段转义
   * 处理包含分隔符、引号、换行符的字段
   */
  private escapeCSVField(field: string, separator: string): string {
    if (typeof field !== 'string') return ''
    
    // 检查是否需要转义
    const needsEscaping = field.includes(separator) || 
                         field.includes('"') || 
                         field.includes('\n') || 
                         field.includes('\r')
    
    if (needsEscaping) {
      // 转义内部的引号，然后用引号包围整个字段
      return `"${field.replace(/"/g, '""')}"`
    }
    
    return field
  }

  /**
   * 创建下载文件
   */
  downloadCSV(csvContent: string, filename?: string): void {
    const blob = new Blob([csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    })
    
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    
    link.href = url
    link.download = filename || `immersive-memorize-${new Date().toISOString().slice(0, 10)}.csv`
    
    // 触发下载
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // 清理资源
    URL.revokeObjectURL(url)
  }
}