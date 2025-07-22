import type { FlashCard, ExtensionSettings } from '@/types'
import { VocabLibraryManager } from '@/lib/vocab-library'

class ImmersiveMemorize {
  private vocabLibraryManager: VocabLibraryManager
  private activeWordlist: string[] = []
  private learnedWords: Set<string> = new Set()
  private currentTargetWord: string | null = null
  private currentTargetElement: HTMLElement | null = null
  private observer: MutationObserver | null = null
  private captureHotkey: string = 's'
  private debugMode: boolean = true

  constructor() {
    this.vocabLibraryManager = new VocabLibraryManager()
  }

  async init(): Promise<void> {
    try {
      // 初始化词汇库管理器
      await this.vocabLibraryManager.init()

      // 加载设置
      const result = (await chrome.storage.local.get([
        'captureHotkey',
        'debugMode',
        'savedCards',
      ])) as Partial<ExtensionSettings>

      this.captureHotkey = result.captureHotkey || 's'
      this.debugMode = result.debugMode !== false

      // 获取激活的词汇表
      this.activeWordlist = this.vocabLibraryManager.getActiveWordlist()

      // 加载已学词汇
      const savedCards = result.savedCards || []
      this.learnedWords = new Set(savedCards.map(card => card.word))

      if (this.debugMode) {
        const selectedLibrary = this.vocabLibraryManager.getSelectedLibrary()
        const settings = this.vocabLibraryManager.getSettings()
        const enabledLevels = Object.entries(settings.levelSettings)
          .filter(([_, progress]) => progress.enabled)
          .map(([level]) => level)

        console.log(`[Immersive Memorize] 当前词库: ${selectedLibrary?.name || '未选择'}`)
        console.log(`[Immersive Memorize] 激活等级: ${enabledLevels.join(', ')}`)
        console.log(`[Immersive Memorize] 已加载 ${this.activeWordlist.length} 个词汇`)
        console.log(`[Immersive Memorize] 已学 ${this.learnedWords.size} 个词汇`)
        console.log(`[Immersive Memorize] 捕获快捷键: ${this.captureHotkey.toUpperCase()}`)
        console.log(`[Immersive Memorize] 顺序学习模式：每次仅显示一个生词`)
      }

      this.startSubtitleObserver()
      this.setupEventListeners()

      // 监听存储变化，实时更新词汇表
      this.setupStorageListener()
    } catch (error) {
      console.error('[Immersive Memorize] 初始化失败:', error)
    }
  }

  private setupStorageListener(): void {
    chrome.storage.onChanged.addListener(async changes => {
      if (changes.vocabLibrarySettings) {
        // 重新加载词汇库设置
        await this.vocabLibraryManager.init()
        this.activeWordlist = this.vocabLibraryManager.getActiveWordlist()

        if (this.debugMode) {
          console.log(
            `[Immersive Memorize] 词汇表已更新，当前 ${this.activeWordlist.length} 个词汇`
          )
        }

        // 重新扫描当前字幕
        this.refreshCurrentSubtitles()
      }

      if (changes.captureHotkey) {
        this.captureHotkey = changes.captureHotkey.newValue || 's'
        if (this.debugMode) {
          console.log(`[Immersive Memorize] 快捷键已更新: ${this.captureHotkey.toUpperCase()}`)
        }
      }

      if (changes.debugMode) {
        this.debugMode = changes.debugMode.newValue !== false
      }
    })
  }

  private refreshCurrentSubtitles(): void {
    // 清除所有处理标记并重新扫描
    const subtitleContainers = document.querySelectorAll<HTMLElement>(
      '.player-timedtext-text-container, ' + '.ltr-1472gpj, ' + '[data-uia="player-caption-text"]'
    )

    subtitleContainers.forEach(container => {
      container.dataset.imProcessed = ''
      this.highlightFirstUnlearnedWord(container)
    })
  }

  private startSubtitleObserver(): void {
    const targetNode = document.body

    this.observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          const subtitleContainers = document.querySelectorAll<HTMLElement>(
            '.player-timedtext-text-container, ' +
              '.ltr-1472gpj, ' +
              '[data-uia="player-caption-text"]'
          )

          subtitleContainers.forEach(container => {
            if (!container.dataset.imProcessed) {
              this.highlightFirstUnlearnedWord(container)
              container.dataset.imProcessed = 'true'
            }
          })
        }
      })
    })

    this.observer.observe(targetNode, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  }

  private highlightFirstUnlearnedWord(container: HTMLElement): void {
    if (!container || this.activeWordlist.length === 0) return

    // 清除之前的高亮
    this.clearAllHighlights()

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)

    const textNodes: Text[] = []
    let node: Node | null

    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        textNodes.push(node as Text)
      }
    }

    // 查找第一个未学的词汇
    for (const textNode of textNodes) {
      const text = textNode.textContent || ''

      for (const word of this.activeWordlist) {
        if (word && text.includes(word) && !this.learnedWords.has(word)) {
          // 找到第一个未学词汇，高亮它
          this.highlightSingleWord(textNode, word)
          this.currentTargetWord = word

          if (this.debugMode) {
            console.log(`[Immersive Memorize] 当前目标词汇: ${word}`)
          }

          return // 只高亮第一个找到的词汇
        }
      }
    }

    // 如果没有找到未学词汇
    this.currentTargetWord = null
    this.currentTargetElement = null

    if (this.debugMode) {
      console.log('[Immersive Memorize] 当前字幕无未学词汇')
    }
  }

  private highlightSingleWord(textNode: Text, word: string): void {
    const text = textNode.textContent || ''
    const wordIndex = text.indexOf(word)

    if (wordIndex === -1) return

    // 分割文本节点
    const beforeText = text.substring(0, wordIndex)
    const afterText = text.substring(wordIndex + word.length)

    // 创建高亮元素
    const highlightSpan = document.createElement('span')
    highlightSpan.className = 'im-highlight im-current-target'
    highlightSpan.textContent = word
    highlightSpan.style.cssText = `
      background-color: #ff9800 !important;
      color: #000 !important;
      padding: 2px 4px !important;
      border-radius: 4px !important;
      font-weight: bold !important;
      border: 2px solid #f57c00 !important;
      box-shadow: 0 0 8px rgba(255, 152, 0, 0.6) !important;
      animation: pulse 2s infinite !important;
    `

    // 添加脉冲动画
    if (!document.getElementById('im-target-styles')) {
      const style = document.createElement('style')
      style.id = 'im-target-styles'
      style.textContent = `
        @keyframes pulse {
          0% { box-shadow: 0 0 8px rgba(255, 152, 0, 0.6); }
          50% { box-shadow: 0 0 15px rgba(255, 152, 0, 0.9); }
          100% { box-shadow: 0 0 8px rgba(255, 152, 0, 0.6); }
        }
      `
      document.head.appendChild(style)
    }

    const parent = textNode.parentNode!

    // 插入分割后的内容
    if (beforeText) {
      parent.insertBefore(document.createTextNode(beforeText), textNode)
    }

    parent.insertBefore(highlightSpan, textNode)

    if (afterText) {
      parent.insertBefore(document.createTextNode(afterText), textNode)
    }

    // 移除原始文本节点
    parent.removeChild(textNode)

    // 设置当前目标元素
    this.currentTargetElement = highlightSpan
  }

  private clearAllHighlights(): void {
    const highlights = document.querySelectorAll<HTMLElement>('.im-highlight')
    highlights.forEach(highlight => {
      const parent = highlight.parentNode
      if (parent) {
        parent.replaceChild(document.createTextNode(highlight.textContent || ''), highlight)
        parent.normalize()
      }
    })

    this.currentTargetElement = null
  }

  private setupEventListeners(): void {
    const keyHandler = async (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === this.captureHotkey.toLowerCase()) {
        if (!this.currentTargetWord) {
          if (this.debugMode) {
            console.log('[Immersive Memorize] 当前无目标词汇，忽略按键')
          }
          this.showNotification('当前无生词可学习', 'info')
          return
        }

        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()

        if (this.debugMode) {
          console.log(`[Immersive Memorize] 开始学习: ${this.currentTargetWord}`)
        }

        await this.captureData()
      }
    }

    // 简化的事件监听
    document.addEventListener('keydown', keyHandler, true)
    window.addEventListener('keydown', keyHandler, true)

    if (this.debugMode) {
      console.log('[Immersive Memorize] 按键监听器已设置（顺序学习模式）')
    }
  }

  private async captureData(): Promise<void> {
    if (!this.currentTargetWord || !this.currentTargetElement) return

    try {
      const word = this.currentTargetWord

      // 检查是否已经学过这个词
      if (this.learnedWords.has(word)) {
        this.showNotification(`${word} 已存在`, 'warning')
        return
      }

      const sentenceElement = this.currentTargetElement.closest(
        '.player-timedtext-text-container, .ltr-1472gpj, [data-uia="player-caption-text"]'
      ) as HTMLElement | null
      const sentence = sentenceElement ? sentenceElement.innerHTML : ''

      const videoElement = document.querySelector<HTMLVideoElement>('video')
      const timestamp = videoElement ? Math.floor(videoElement.currentTime) : 0

      const screenshot = await this.captureVideoFrame(videoElement)

      const sourceTitle = document.title.replace(' - Netflix', '') || 'Unknown'

      const cardData: FlashCard = {
        id: Date.now(),
        word: word,
        sentence: sentence,
        timestamp: timestamp,
        screenshot: screenshot,
        sourceTitle: sourceTitle,
        createdAt: new Date().toISOString(),
      }

      const result = (await chrome.storage.local.get(['savedCards'])) as Partial<ExtensionSettings>
      const savedCards = result.savedCards || []
      savedCards.push(cardData)

      await chrome.storage.local.set({ savedCards: savedCards })

      // 立即添加到已学词汇集合
      this.learnedWords.add(word)

      // 更新词汇库中的学习进度
      await this.updateLearningProgress(word)

      // 清除当前高亮并寻找下一个词汇
      this.clearAllHighlights()
      this.currentTargetWord = null
      this.currentTargetElement = null

      // 重新扫描当前字幕寻找下一个生词
      setTimeout(() => {
        const subtitleContainers = document.querySelectorAll<HTMLElement>(
          '.player-timedtext-text-container, ' +
            '.ltr-1472gpj, ' +
            '[data-uia="player-caption-text"]'
        )

        subtitleContainers.forEach(container => {
          container.dataset.imProcessed = ''
          this.highlightFirstUnlearnedWord(container)
        })
      }, 100)

      if (this.debugMode) {
        console.log(`[Immersive Memorize] 已保存卡片:`, cardData)
      }

      this.showNotification(`${word} 已学习`)
    } catch (error) {
      console.error('[Immersive Memorize] 捕获数据失败:', error)
      this.showNotification('保存失败: ' + (error as Error).message, 'error')
    }
  }

  private async updateLearningProgress(word: string): Promise<void> {
    try {
      const selectedLibrary = this.vocabLibraryManager.getSelectedLibrary()
      if (!selectedLibrary) return

      // 查找词汇所属的等级
      const vocabEntry = selectedLibrary.data.find(entry => entry.VocabKanji === word)
      if (!vocabEntry) return

      // 更新词汇库中的学习进度
      await this.vocabLibraryManager.markWordAsLearned(word, vocabEntry.Level)

      if (this.debugMode) {
        console.log(`[Immersive Memorize] 更新学习进度: ${word} (${vocabEntry.Level})`)
      }
    } catch (error) {
      console.error('[Immersive Memorize] 更新学习进度失败:', error)
    }
  }

  private async captureVideoFrame(videoElement: HTMLVideoElement | null): Promise<string> {
    if (!videoElement) return ''

    try {
      const canvas = document.createElement('canvas')
      canvas.width = videoElement.videoWidth
      canvas.height = videoElement.videoHeight

      const ctx = canvas.getContext('2d')!
      ctx.drawImage(videoElement, 0, 0)

      return canvas.toDataURL('image/png')
    } catch (error) {
      console.error('[Immersive Memorize] 截图失败:', error)
      return ''
    }
  }

  private showNotification(
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'success'
  ): void {
    const notification = document.createElement('div')
    let bgColor: string, icon: string

    switch (type) {
      case 'error':
        bgColor = '#f44336'
        icon = '✗'
        break
      case 'warning':
        bgColor = '#ff9800'
        icon = '⚠'
        break
      case 'info':
        bgColor = '#2196f3'
        icon = 'ℹ'
        break
      default:
        bgColor = '#4caf50'
        icon = '✓'
    }

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${bgColor};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 2147483647;
      font-family: Arial, sans-serif;
      font-size: 16px;
      font-weight: bold;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      border: 2px solid rgba(255,255,255,0.2);
      max-width: 350px;
      word-wrap: break-word;
      animation: slideIn 0.3s ease-out;
    `

    notification.textContent = `${icon} ${message}`

    // 确定附加通知的目标元素
    const appendTarget = document.fullscreenElement || document.body
    if (this.debugMode) {
      console.log('[Immersive Memorize] Appending notification to:', appendTarget.tagName)
    }

    // 将动画样式附加到目标元素内，以确保在 Shadow DOM 中也能生效
    const styleId = 'im-notification-styles'
    // 如果目标是 Shadow DOM，则在其中查找/附加样式，否则使用 document.head
    const styleParent = appendTarget.shadowRoot || document.head
    if (!styleParent.querySelector(`#${styleId}`)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `
      styleParent.appendChild(style)
    }

    appendTarget.appendChild(notification)

    const duration = type === 'error' ? 4000 : type === 'warning' ? 3000 : 2000
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.transform = 'translateX(100%)'
        notification.style.opacity = '0'
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification)
          }
        }, 300)
      }
    }, duration)
  }
}

// 初始化
const immersiveMemorize = new ImmersiveMemorize()

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => immersiveMemorize.init())
} else {
  immersiveMemorize.init()
}
