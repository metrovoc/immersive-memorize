/**
 * 自定义SRT字幕源实现
 * 支持用户上传SRT文件并在任何视频上显示字幕
 */

import type {
  ICustomSubtitleSource,
  PageContext,
  MediaInfo,
  ParsedSubtitle,
  SubtitleEntry,
  SubtitleSourceCapabilities,
} from './types'

export class CustomSRTSubtitleSource implements ICustomSubtitleSource {
  readonly name = 'Custom SRT'
  readonly priority = 1 // 低于原生字幕
  readonly capabilities: SubtitleSourceCapabilities = {
    supportsNativeSubtitles: false,
    supportsCustomSubtitles: true,
    requiresUserInput: true,
  }

  private srtEntries: SubtitleEntry[] = []
  private targetVideo: HTMLVideoElement | null = null
  private overlayElement: HTMLElement | null = null
  private currentSubtitle: SubtitleEntry | null = null
  private timeUpdateHandler: (() => void) | null = null
  private debugMode: boolean
  private isInitialized: boolean = false
  private timeOffset: number = 0

  constructor(debugMode: boolean = false) {
    this.debugMode = debugMode
  }

  canHandle(context: PageContext): boolean {
    // 只要有视频元素就可以处理
    return context.hasVideo
  }

  async initialize(): Promise<void> {
    this.isInitialized = true
    if (this.debugMode) {
      console.log('[CustomSRTSubtitleSource] 初始化完成')
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.srtEntries.length > 0 && this.targetVideo !== null
  }

  detectSubtitleContainers(): HTMLElement[] {
    // 自定义字幕源返回自己创建的覆盖层
    return this.overlayElement ? [this.overlayElement] : []
  }

  parseSubtitleContent(container: HTMLElement): ParsedSubtitle {
    const text = container.textContent || ''
    return {
      cleanText: text,
      displayHTML: container.innerHTML,
      furiganaMap: [], // SRT字幕默认不包含Furigana信息
    }
  }

  extractMediaInfo(): MediaInfo {
    const title = document.title || 'Unknown'
    return {
      title,
      fullTitle: title,
    }
  }

  setupObserver(callback: (containers: HTMLElement[]) => void): void {
    // 自定义字幕源通过时间同步来更新
    if (this.targetVideo && this.timeUpdateHandler) {
      this.targetVideo.removeEventListener('timeupdate', this.timeUpdateHandler)
    }

    this.timeUpdateHandler = () => {
      if (this.targetVideo) {
        this.syncSubtitles(this.targetVideo.currentTime)
        const containers = this.detectSubtitleContainers()
        if (containers.length > 0) {
          callback(containers)
        }
      }
    }

    if (this.targetVideo) {
      this.targetVideo.addEventListener('timeupdate', this.timeUpdateHandler)
    }
  }

  cleanup(): void {
    if (this.targetVideo && this.timeUpdateHandler) {
      this.targetVideo.removeEventListener('timeupdate', this.timeUpdateHandler)
    }

    if (this.overlayElement) {
      this.overlayElement.remove()
      this.overlayElement = null
    }

    this.timeUpdateHandler = null
    this.currentSubtitle = null

    // Reset all state to allow fresh reload
    this.srtEntries = []
    this.targetVideo = null
    this.isInitialized = false

    if (this.debugMode) {
      console.log('[CustomSRTSubtitleSource] 清理完成')
    }
  }

  /**
   * 加载SRT文件
   */
  async loadSRTFile(file: File): Promise<void> {
    try {
      const content = await this.readFileAsText(file)
      this.srtEntries = this.parseSRT(content)

      if (this.debugMode) {
        console.log(`[CustomSRTSubtitleSource] 成功解析 ${this.srtEntries.length} 条字幕`)
      }
    } catch (error) {
      console.error('[CustomSRTSubtitleSource] SRT文件加载失败:', error)
      throw error
    }
  }

  /**
   * 设置目标视频元素
   */
  setTargetVideo(video: HTMLVideoElement): void {
    if (this.targetVideo === video) return

    // 清理旧的视频监听器
    if (this.targetVideo && this.timeUpdateHandler) {
      this.targetVideo.removeEventListener('timeupdate', this.timeUpdateHandler)
    }

    this.targetVideo = video

    // 重新创建覆盖层
    if (this.overlayElement) {
      this.overlayElement.remove()
    }
    this.overlayElement = this.createSubtitleOverlay()

    if (this.debugMode) {
      console.log('[CustomSRTSubtitleSource] 设置目标视频元素')
    }
  }

  /**
   * 创建字幕覆盖层
   */
  createSubtitleOverlay(): HTMLElement {
    if (!this.targetVideo) {
      throw new Error('必须先设置目标视频元素')
    }

    const overlay = document.createElement('div')
    overlay.className = 'im-custom-subtitle-overlay'
    overlay.style.cssText = `
      position: absolute;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      max-width: 80%;
      text-align: center;
      font-size: 16px;
      font-weight: bold;
      color: white;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
      background-color: rgba(0, 0, 0, 0.5);
      padding: 8px 16px;
      border-radius: 8px;
      z-index: 1000;
      pointer-events: none;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.4;
    `

    // 找到视频的父容器
    const videoContainer = this.findVideoContainer(this.targetVideo)
    if (videoContainer) {
      // 确保容器具有相对定位
      if (getComputedStyle(videoContainer).position === 'static') {
        videoContainer.style.position = 'relative'
      }
      videoContainer.appendChild(overlay)
    } else {
      // 后备方案：直接添加到body
      overlay.style.position = 'fixed'
      document.body.appendChild(overlay)
    }

    return overlay
  }

  /**
   * 同步字幕显示
   */
  syncSubtitles(currentTime: number): void {
    const subtitle = this.getCurrentSubtitle(currentTime)

    if (subtitle !== this.currentSubtitle) {
      this.currentSubtitle = subtitle
      this.updateOverlayDisplay()
    }
  }

  /**
   * 获取当前时间的字幕
   */
  getCurrentSubtitle(currentTime: number): SubtitleEntry | null {
    const adjustedTime = currentTime + this.timeOffset
    for (const entry of this.srtEntries) {
      if (adjustedTime >= entry.startTime && adjustedTime <= entry.endTime) {
        return entry
      }
    }
    return null
  }

  /**
   * 更新覆盖层显示
   */
  private updateOverlayDisplay(): void {
    if (!this.overlayElement) return

    if (this.currentSubtitle) {
      this.overlayElement.innerHTML = this.formatSubtitleText(this.currentSubtitle.text)
      this.overlayElement.style.display = 'block'
    } else {
      this.overlayElement.style.display = 'none'
    }
  }

  /**
   * 格式化字幕文本
   */
  private formatSubtitleText(text: string): string {
    // 处理常见的SRT格式标记
    return text
      .replace(/\n/g, '<br>')
      .replace(/<i>(.*?)<\/i>/g, '<em>$1</em>')
      .replace(/<b>(.*?)<\/b>/g, '<strong>$1</strong>')
      .replace(/<u>(.*?)<\/u>/g, '<span style="text-decoration: underline">$1</span>')
  }

  /**
   * 读取文件内容
   */
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsText(file, 'utf-8')
    })
  }

  /**
   * 解析SRT文件内容
   */
  private parseSRT(content: string): SubtitleEntry[] {
    const entries: SubtitleEntry[] = []
    const blocks = content.trim().split(/\n\s*\n/)

    for (const block of blocks) {
      const lines = block.trim().split('\n')
      if (lines.length < 3) continue

      const index = parseInt(lines[0])
      const timeMatch = lines[1].match(
        /(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/
      )

      if (!timeMatch) continue

      const startTime = this.parseTimeToSeconds(
        timeMatch[1],
        timeMatch[2],
        timeMatch[3],
        timeMatch[4]
      )
      const endTime = this.parseTimeToSeconds(
        timeMatch[5],
        timeMatch[6],
        timeMatch[7],
        timeMatch[8]
      )
      const text = lines.slice(2).join('\n')

      entries.push({
        index,
        startTime,
        endTime,
        text,
      })
    }

    return entries.sort((a, b) => a.startTime - b.startTime)
  }

  /**
   * 将时间字符串转换为秒数
   */
  private parseTimeToSeconds(
    hours: string,
    minutes: string,
    seconds: string,
    milliseconds: string
  ): number {
    return (
      parseInt(hours) * 3600 +
      parseInt(minutes) * 60 +
      parseInt(seconds) +
      parseInt(milliseconds) / 1000
    )
  }

  /**
   * 寻找视频的容器元素
   */
  private findVideoContainer(video: HTMLVideoElement): HTMLElement | null {
    let element = video.parentElement

    while (element) {
      const style = getComputedStyle(element)

      // 寻找具有定位属性的容器
      if (style.position === 'relative' || style.position === 'absolute') {
        return element
      }

      // 寻找视频播放器容器的常见类名
      if (
        element.classList.contains('video-player') ||
        element.classList.contains('player-container') ||
        element.classList.contains('video-container')
      ) {
        return element
      }

      element = element.parentElement
    }

    return null
  }

  /**
   * 更新字幕样式
   */
  updateStyles(styles: {
    fontSize: number
    verticalPosition: number
    backgroundOpacity: number
    timeOffset?: number
  }): void {
    if (!this.overlayElement) return

    // 更新字体大小
    this.overlayElement.style.fontSize = `${styles.fontSize}px`

    // 更新垂直位置
    this.overlayElement.style.bottom = `${styles.verticalPosition}px`

    // 更新背景透明度
    const opacity = styles.backgroundOpacity / 100
    this.overlayElement.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`

    // 更新时间偏移
    if (styles.timeOffset !== undefined) {
      this.timeOffset = styles.timeOffset

      // 立即重新同步字幕
      if (this.targetVideo) {
        this.syncSubtitles(this.targetVideo.currentTime)
      }
    }

    if (this.debugMode) {
      console.log('[CustomSRTSubtitleSource] 样式已更新:', styles)
    }
  }

  /**
   * 获取字幕统计信息
   */
  getStats(): { totalEntries: number; duration: number; averageLength: number } {
    if (this.srtEntries.length === 0) {
      return { totalEntries: 0, duration: 0, averageLength: 0 }
    }

    const lastEntry = this.srtEntries[this.srtEntries.length - 1]
    const duration = lastEntry.endTime
    const averageLength =
      this.srtEntries.reduce((sum, entry) => sum + entry.text.length, 0) / this.srtEntries.length

    return {
      totalEntries: this.srtEntries.length,
      duration,
      averageLength: Math.round(averageLength),
    }
  }
}
