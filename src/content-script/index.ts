import type { FlashCard, ExtensionSettings, Word } from '@/types'
import { VocabLibraryManager } from '@/lib/vocab-library'
import { SubtitleProcessor } from './subtitle-processor'
import { NetflixExtractor } from './netflix-extractor'
import { SubtitleTextParser } from './subtitle-text-parser'

class ImmersiveMemorize {
  private vocabLibraryManager: VocabLibraryManager
  private subtitleProcessor: SubtitleProcessor | null = null
  private netflixExtractor: NetflixExtractor | null = null
  private learnedWords: Set<string> = new Set()
  private currentTargetWord: Word | null = null
  private currentTargetElement: HTMLElement | null = null
  private observer: MutationObserver | null = null
  private captureHotkey: string = 's'
  private debugMode: boolean = true
  private enableScreenshot: boolean = false // 新增：截图功能开关，默认关闭

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
        'enableScreenshot',
        'savedCards',
      ])) as Partial<ExtensionSettings>

      this.captureHotkey = result.captureHotkey || 's'
      this.debugMode = result.debugMode !== false
      this.enableScreenshot = result.enableScreenshot || false // 默认关闭

      // 加载已学词汇 (lemmas)
      const savedCards = result.savedCards || []
      this.learnedWords = new Set(savedCards.map((card: FlashCard) => card.word)) // Assuming card.word stores the lemma

      // 初始化 SubtitleProcessor
      this.subtitleProcessor = new SubtitleProcessor(
        this.vocabLibraryManager,
        this.learnedWords,
        this.debugMode
      )

      // 初始化 NetflixExtractor
      this.netflixExtractor = new NetflixExtractor(this.debugMode)

      if (this.debugMode) {
        const selectedLibrary = this.vocabLibraryManager.getSelectedLibrary()
        const settings = this.vocabLibraryManager.getSettings()
        const enabledLevels = Object.entries(settings.levelSettings)
          .filter(([_, progress]) => progress.enabled)
          .map(([level]) => level)

        console.log(`[Immersive Memorize] 当前词库: ${selectedLibrary?.name || '未选择'}`)
        console.log(`[Immersive Memorize] 激活等级: ${enabledLevels.join(', ')}`)
        const activeWordlist = await this.vocabLibraryManager.getActiveWordlist()
        console.log(`[Immersive Memorize] 已加载 ${activeWordlist.length} 个词汇`)
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
      let needsRefresh = false

      if (changes.vocabLibrarySettings) {
        await this.vocabLibraryManager.init()
        await this.subtitleProcessor?.updateWordLists()
        needsRefresh = true

        if (this.debugMode) {
          console.log('[Immersive Memorize] 词汇表设置已更新，重新处理字幕。')
        }
      }

      if (changes.savedCards) {
        const savedCards = changes.savedCards.newValue || []
        this.learnedWords = new Set(savedCards.map((card: FlashCard) => card.word))
        this.subtitleProcessor?.setLearnedWords(this.learnedWords)
        needsRefresh = true

        if (this.debugMode) {
          console.log('[Immersive Memorize] 已学词汇列表已更新，重新处理字幕。')
        }
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

      if (needsRefresh) {
        this.refreshCurrentSubtitles()
      }
    })
  }

  private async refreshCurrentSubtitles(): Promise<void> {
    const subtitleContainers = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.player-timedtext-text-container, ' + '.ltr-1472gpj, ' + '[data-uia="player-caption-text"]'
      )
    )

    if (subtitleContainers.length === 0) return

    // 统一清除所有高亮（只执行一次）
    this.clearAllHighlights()
    this.currentTargetWord = null
    this.currentTargetElement = null

    // 按优先级处理container
    for (const container of subtitleContainers) {
      const text = container.innerText?.trim()
      if (!text) continue

      // 重置处理标记
      container.dataset.imProcessed = ''

      // 尝试处理这个container
      const targetWord = await this.subtitleProcessor?.processAndHighlight(container)

      if (targetWord) {
        // 找到目标词汇，设置状态并停止处理
        this.currentTargetWord = targetWord
        this.currentTargetElement = document.querySelector('.im-current-target')
        container.dataset.imProcessed = 'true'

        if (this.debugMode) {
          console.log(
            `[Immersive Memorize] 当前目标词汇: ${targetWord.word} (原形: ${targetWord.lemma})`
          )
        }
        return // 关键：找到就停止，避免被后续container覆盖
      }
    }

    // 如果所有container都没有找到目标词汇
    if (this.debugMode) {
      console.log('[Immersive Memorize] 当前字幕无未学词汇')
    }
  }

  private startSubtitleObserver(): void {
    const subtitleSelectors = [
      '.player-timedtext-text-container',
      '.ltr-1472gpj',
      '[data-uia="player-caption-text"]',
    ].join(', ')

    const handleMutation = (mutations: MutationRecord[]) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement

              // Check if the added element itself is a subtitle container or if it contains one.
              if (element.matches(subtitleSelectors) || element.querySelector(subtitleSelectors)) {
                // 有新的字幕容器出现，统一处理所有容器避免竞态
                this.refreshCurrentSubtitles()
              }
            }
          })
        }
      })
    }

    this.observer = new MutationObserver(handleMutation)

    // Instead of observing the body immediately, wait for a potential subtitle container to appear first
    // to find a more specific observation target.
    const initialCheck = () => {
      const subtitleParent = document.querySelector(subtitleSelectors)?.parentElement
      if (subtitleParent) {
        if (this.debugMode) {
          console.log(
            '[Immersive Memorize] Subtitle container found. Attaching observer to parent:',
            subtitleParent
          )
        }
        this.observer?.observe(subtitleParent, {
          childList: true,
          subtree: true, // Subtree is needed as subtitles might be added nested inside the parent
        })
        // Also process any subtitles that might already be on the page
        this.refreshCurrentSubtitles()
      } else {
        // If not found, fallback to observing the body, but with a delay to allow video players to load.
        // This is a fallback and less efficient.
        if (this.debugMode) {
          console.log(
            '[Immersive Memorize] No subtitle container found yet. Falling back to observing body.'
          )
        }
        this.observer?.observe(document.body, {
          childList: true,
          subtree: true,
        })
      }
    }

    // Give the page a moment to load the player UI
    setTimeout(initialCheck, 2000)
  }

  private async processSubtitleContainer(container: HTMLElement): Promise<void> {
    if (!container || !this.subtitleProcessor) return

    // 移除内部的清除逻辑，改为在refreshCurrentSubtitles中统一处理
    // 避免多container竞态问题

    this.currentTargetWord = await this.subtitleProcessor.processAndHighlight(container)
    this.currentTargetElement = document.querySelector('.im-current-target')

    if (this.debugMode) {
      if (this.currentTargetWord) {
        console.log(
          `[Immersive Memorize] 当前目标词汇: ${this.currentTargetWord.word} (原形: ${this.currentTargetWord.lemma})`
        )
      } else {
        console.log('[Immersive Memorize] 当前字幕无未学词汇')
      }
    }
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
      const lemma = word.lemma // Use lemma as the unique identifier

      // 检查是否已经学过这个词 (based on lemma)
      if (this.learnedWords.has(lemma)) {
        this.showNotification(`${lemma} 已存在`, 'warning')
        return
      }

      const sentenceElement = this.currentTargetElement.closest(
        '.player-timedtext-text-container, .ltr-1472gpj, [data-uia="player-caption-text"]'
      ) as HTMLElement | null

      let sentence = ''
      if (sentenceElement) {
        // 使用新的文本解析器处理句子内容
        const textParser = new SubtitleTextParser()
        const parsedText = textParser.parse(sentenceElement)
        sentence = parsedText.displayHTML

        if (this.debugMode) {
          console.log('[Immersive Memorize] Captured sentence HTML:', sentence)
          console.log('[Immersive Memorize] Furigana mappings:', parsedText.furiganaMap)
        }
      }

      const videoElement = document.querySelector<HTMLVideoElement>('video')
      const timestamp = videoElement ? Math.floor(videoElement.currentTime) : 0

      // 根据截图开关决定是否进行截图
      let screenshot = ''
      if (this.enableScreenshot) {
        screenshot = await this.captureVideoFrame(videoElement)
        if (this.debugMode) {
          console.log('[Immersive Memorize] 截图功能已启用，截图结果长度:', screenshot.length)
        }
      } else {
        if (this.debugMode) {
          console.log('[Immersive Memorize] 截图功能已关闭，跳过截图')
        }
      }

      // 使用 NetflixExtractor 获取详细的页面信息
      let sourceTitle = 'Unknown'
      let netflixInfo = null
      if (this.netflixExtractor) {
        netflixInfo = this.netflixExtractor.extractNetflixInfo()
        sourceTitle = netflixInfo.fullTitle

        if (this.debugMode) {
          console.log('[Immersive Memorize] 提取的Netflix信息:', netflixInfo)
        }
      } else {
        // 退回到原来的方法
        sourceTitle = document.title.replace(' - Netflix', '') || 'Unknown'
      }

      // 获取词汇的详细信息
      const selectedLibrary = this.vocabLibraryManager.getSelectedLibrary()
      const vocabEntry = selectedLibrary?.data.find(entry => entry.VocabKanji === lemma)

      const cardData: FlashCard = {
        id: Date.now(),
        word: lemma, // <-- IMPORTANT: Save the lemma
        sentence: sentence,
        timestamp: timestamp,
        screenshot: screenshot,
        sourceTitle: sourceTitle,
        createdAt: new Date().toISOString(),
        level: vocabEntry?.Level,
        definition: vocabEntry?.VocabDefCN,
        reading: vocabEntry?.VocabFurigana,
        // 保存详细的Netflix信息
        showTitle: netflixInfo?.showTitle,
        seasonNumber: netflixInfo?.seasonNumber,
        episodeNumber: netflixInfo?.episodeNumber,
        episodeTitle: netflixInfo?.episodeTitle,
      }

      const result = (await chrome.storage.local.get(['savedCards'])) as Partial<ExtensionSettings>
      const savedCards = result.savedCards || []
      savedCards.push(cardData)

      await chrome.storage.local.set({ savedCards: savedCards })

      // 立即添加到已学词汇集合
      this.learnedWords.add(lemma)
      this.subtitleProcessor?.setLearnedWords(this.learnedWords)

      // 更新词汇库中的学习进度（从记忆卡片推导）
      await this.vocabLibraryManager.updateProgressFromCards()

      if (this.debugMode) {
        console.log(`[Immersive Memorize] 已保存卡片:`, cardData)
      }

      this.showNotification(`${word.word} ( ${lemma} ) 已学习`)

      // 清除当前高亮并寻找下一个词汇
      this.clearAllHighlights()
      this.currentTargetWord = null
      this.currentTargetElement = null

      // 重新扫描当前字幕寻找下一个生词
      setTimeout(() => {
        this.refreshCurrentSubtitles()
      }, 100)
    } catch (error) {
      console.error('[Immersive Memorize] 捕获数据失败:', error)
      this.showNotification('保存失败: ' + (error as Error).message, 'error')
    }
  }

  private async captureVideoFrame(videoElement: HTMLVideoElement | null): Promise<string> {
    if (!videoElement) return '';

    if (this.debugMode) {
      console.log('[Immersive Memorize] Requesting screenshot via background script...');
    }

    try {
      // Send a message to the background script to request a screenshot
      const response = await chrome.runtime.sendMessage({ action: 'captureVisibleTab' });

      if (response && response.data) {
        if (this.debugMode) {
          console.log('[Immersive Memorize] Screenshot successful, received data URL');
        }
        return response.data;
      } else {
        const errorMessage = response?.error || 'Unknown error';
        console.error(`[Immersive Memorize] Screenshot failed: ${errorMessage}`);
        this.showNotification(`Screenshot failed: ${errorMessage}`, 'error');
        return '';
      }
    } catch (error) {
      console.error('[Immersive Memorize] A critical error occurred while calling the screenshot API:', error);
      this.showNotification(`Screenshot failed: ${(error as Error).message}`, 'error');
      return '';
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
