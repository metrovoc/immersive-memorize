/**
 * Netflix字幕源实现
 * 专门处理Netflix网站的字幕提取和解析
 */

import type {
  ISubtitleSource,
  PageContext,
  MediaInfo,
  ParsedSubtitle,
  SubtitleSourceCapabilities,
} from './types'
import { SubtitleTextParser } from '../subtitle-text-parser'

export class NetflixSubtitleSource implements ISubtitleSource {
  readonly name = 'Netflix Native'
  readonly priority = 0 // 最高优先级
  readonly capabilities: SubtitleSourceCapabilities = {
    supportsNativeSubtitles: true,
    supportsCustomSubtitles: false,
    requiresUserInput: false,
  }

  private observer: MutationObserver | null = null
  private textParser: SubtitleTextParser
  private debugMode: boolean
  private isInitialized: boolean = false

  constructor(debugMode: boolean = false) {
    this.debugMode = debugMode
    this.textParser = new SubtitleTextParser()
  }

  canHandle(context: PageContext): boolean {
    return context.hostname.includes('netflix.com') && context.hasVideo && this.hasNetflixPlayer()
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      const playerReady = await this._waitForNetflixPlayer(10000)
      if (!playerReady) {
        throw new Error('Netflix player timed out')
      }

      this.isInitialized = true

      if (this.debugMode) {
        console.log('[NetflixSubtitleSource] Initialized successfully')
      }
    } catch (error) {
      console.error('[NetflixSubtitleSource] Initialization failed:', error)
      throw error
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.hasNetflixPlayer()
  }

  detectSubtitleContainers(): HTMLElement[] {
    const selectors = ['.player-timedtext-text-container']

    const containers: HTMLElement[] = []

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector) as NodeListOf<HTMLElement>
      containers.push(...Array.from(elements))
    }

    if (this.debugMode && containers.length > 0) {
      console.log(`[NetflixSubtitleSource] 发现 ${containers.length} 个字幕容器`)
    }

    return containers
  }

  parseSubtitleContent(container: HTMLElement): ParsedSubtitle {
    try {
      const parsedText = this.textParser.parse(container)

      if (this.debugMode) {
        console.log('[NetflixSubtitleSource] 解析字幕内容:', {
          cleanText: parsedText.cleanText,
          furiganaCount: parsedText.furiganaMap.length,
        })
      }

      return {
        cleanText: parsedText.cleanText,
        displayHTML: parsedText.displayHTML,
        furiganaMap: parsedText.furiganaMap,
      }
    } catch (error) {
      console.error('[NetflixSubtitleSource] 解析字幕内容失败:', error)
      return {
        cleanText: '',
        displayHTML: '',
        furiganaMap: [],
      }
    }
  }

  extractMediaInfo(): MediaInfo {
    try {
      const netflixInfo = this._extractNetflixInfo()

      return {
        title: netflixInfo.showTitle,
        fullTitle: netflixInfo.fullTitle,
        showTitle: netflixInfo.showTitle,
        seasonNumber: netflixInfo.seasonNumber,
        episodeNumber: netflixInfo.episodeNumber,
        episodeTitle: netflixInfo.episodeTitle,
      }
    } catch (error) {
      console.error('[NetflixSubtitleSource] Failed to extract media info:', error)
      return {
        title: 'Unknown',
        fullTitle: 'Unknown',
      }
    }
  }

  setupObserver(callback: (containers: HTMLElement[]) => void): void {
    this.cleanup() // 清理现有的观察器

    const subtitleSelectors = ['.player-timedtext-text-container'].join(', ')

    const handleMutation = (mutations: MutationRecord[]) => {
      let hasSubtitleChanges = false

      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement

              if (element.matches(subtitleSelectors) || element.querySelector(subtitleSelectors)) {
                hasSubtitleChanges = true
              }
            }
          })
        }
      })

      if (hasSubtitleChanges) {
        const containers = this.detectSubtitleContainers()
        callback(containers)
      }
    }

    this.observer = new MutationObserver(handleMutation)

    // 尝试找到更具体的观察目标
    const initialCheck = () => {
      const subtitleParent = document.querySelector(subtitleSelectors)?.parentElement

      if (subtitleParent) {
        if (this.debugMode) {
          console.log('[NetflixSubtitleSource] 在字幕容器父级上设置观察器')
        }

        this.observer?.observe(subtitleParent, {
          childList: true,
          subtree: true,
        })
      } else {
        if (this.debugMode) {
          console.log('[NetflixSubtitleSource] 在document.body上设置观察器')
        }

        this.observer?.observe(document.body, {
          childList: true,
          subtree: true,
        })
      }

      // 立即检查现有字幕
      const containers = this.detectSubtitleContainers()
      if (containers.length > 0) {
        callback(containers)
      }
    }

    // 给页面一些时间加载
    setTimeout(initialCheck, 1000)
  }

  cleanup(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }

    if (this.debugMode) {
      console.log('[NetflixSubtitleSource] 清理完成')
    }
  }

  /**
   * 检查是否存在Netflix播放器
   */
  private hasNetflixPlayer(): boolean {
    const hasVideo = document.querySelector('video') !== null
    const hasNetflixElements =
      document.querySelector('[class*="player"]') !== null ||
      document.querySelector('[data-uia*="player"]') !== null ||
      document.querySelector('.video-title') !== null

    return hasVideo && hasNetflixElements
  }

  // --- Start of integrated NetflixExtractor logic ---

  /**
   * 提取Netflix页面的详细信息
   * @private
   */
  private _extractNetflixInfo(): any {
    const info: any = {
      showTitle: 'Unknown',
      fullTitle: 'Unknown',
    }

    try {
      const documentTitle = document.title.replace(' - Netflix', '')
      const showTitle = this._extractShowTitle()
      const seasonNumber = this._extractSeasonNumber()
      const episodeNumber = this._extractEpisodeNumber()
      const episodeTitle = this._extractEpisodeTitle()

      info.showTitle = showTitle || documentTitle || 'Unknown'
      info.seasonNumber = seasonNumber || undefined
      info.episodeNumber = episodeNumber || undefined
      info.episodeTitle = episodeTitle || undefined
      info.fullTitle = this._buildFullTitle(info)

      if (this.debugMode) {
        console.log('[NetflixSubtitleSource] Extracted Info:', info)
      }
    } catch (error) {
      console.error('[NetflixSubtitleSource] Failed to extract info:', error)
      info.showTitle = document.title.replace(' - Netflix', '') || 'Unknown'
      info.fullTitle = info.showTitle
    }

    return info
  }

  /**
   * @private
   */
  private _extractShowTitle(): string | null {
    const titleSelectors = [
      'h4.ellipsize-text',
      '[data-uia="video-title"]',
      '.video-title',
      '.title-info-metadata h1',
      '.fallback-text-container h1',
      '.player-status-main-title',
      '.nf-player-container .video-title',
      '[data-uia="title-field"]',
      '.title-field',
      '.video-metadata .show-title',
      '.episode-metadata .show-title',
    ]
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector)
      if (element?.textContent?.trim()) return element.textContent.trim()
    }
    return null
  }

  /**
   * @private
   */
  private _extractSeasonNumber(): string | null {
    const seasonSelectors = [
      '[data-uia="season-selector"] .current-season',
      '[data-uia="season-selector"]',
      '.season-label',
      '.current-season',
      '.episode-metadata .season-info',
      '.video-metadata .season-number',
      '.season-number',
      '.player-status-season',
      '.nf-player-container .season-info',
      '[data-uia="season-field"]',
      '.season-field',
    ]
    for (const selector of seasonSelectors) {
      const element = document.querySelector(selector)
      if (element?.textContent?.trim()) {
        const text = element.textContent.trim()
        const seasonMatch = text.match(/(?:第|Season|S)[\s]*(\d+)[\s]*[季]?/i)
        if (seasonMatch) return text
      }
    }
    return null
  }

  /**
   * @private
   */
  private _extractEpisodeNumber(): string | null {
    const episodeSelectors = [
      '[data-uia="episode-title"]',
      '.episode-title',
      '.current-episode',
      '.video-metadata .episode-number',
      '.episode-number',
      '.episode-metadata .episode-number',
      '.player-status-episode',
      '.nf-player-container .episode-info',
      '.episode-selector .selected .episode-number',
      '.episode-list .selected .episode-number',
      '[data-uia="episode-field"]',
      '.episode-field',
    ]
    for (const selector of episodeSelectors) {
      const element = document.querySelector(selector)
      if (element?.textContent?.trim()) {
        const text = element.textContent.trim()
        const episodeMatch = text.match(/(?:第|Episode|E|EP)[\s]*(\d+)[\s]*[集话]?/i)
        if (episodeMatch) return text
      }
    }
    return null
  }

  /**
   * @private
   */
  private _extractEpisodeTitle(): string | null {
    const episodeTitleSelectors = [
      '[data-uia="episode-title"] .episode-title-1',
      '.episode-title-text',
      '.episode-title-name',
      '.video-metadata .episode-title',
      '.episode-metadata .episode-title',
      '.player-status-main-title .episode-title',
      '.player-status-episode-title',
      '.episode-selector .selected .episode-title',
      '.episode-list .selected .title',
    ]
    for (const selector of episodeTitleSelectors) {
      const element = document.querySelector(selector)
      if (element?.textContent?.trim()) return element.textContent.trim()
    }
    return null
  }

  /**
   * @private
   */
  private _buildFullTitle(info: any): string {
    let parts: string[] = []
    if (info.showTitle && info.showTitle !== 'Unknown') parts.push(info.showTitle)
    if (info.seasonNumber) parts.push(info.seasonNumber)
    if (info.episodeNumber) parts.push(info.episodeNumber)
    if (info.episodeTitle) parts.push(`"${info.episodeTitle}"`)
    return parts.length > 0 ? parts.join(' ') : 'Unknown'
  }

  /**
   * @private
   */
  private async _waitForNetflixPlayer(timeout: number = 10000): Promise<boolean> {
    const startTime = Date.now()
    while (Date.now() - startTime < timeout) {
      if (this.hasNetflixPlayer()) {
        if (this.debugMode) console.log('[NetflixSubtitleSource] Netflix player is ready.')
        return true
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (this.debugMode) console.log('[NetflixSubtitleSource] Wait for Netflix player timed out.')
    return false
  }

  // --- End of integrated NetflixExtractor logic ---

  /**
   * 获取当前视频元素
   */
  getVideoElement(): HTMLVideoElement | null {
    return document.querySelector('video')
  }

  /**
   * 获取视频时间戳
   */
  getCurrentTimestamp(): number {
    const videoElement = this.getVideoElement()
    return videoElement ? Math.floor(videoElement.currentTime) : 0
  }

  /**
   * 检查是否在Netflix观看页面
   */
  static isNetflixWatchPage(): boolean {
    return (
      window.location.hostname.includes('netflix.com') &&
      (window.location.pathname.includes('/watch') || document.querySelector('video') !== null)
    )
  }
}
