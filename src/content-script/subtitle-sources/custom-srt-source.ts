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
  private isUsingFixedPositioning: boolean = false
  private resizeHandler: (() => void) | null = null
  private scrollHandler: (() => void) | null = null
  private fullscreenHandler: (() => void) | null = null
  private orientationHandler: (() => void) | null = null
  private updateTimer: number | null = null
  private forceFullscreenMode: boolean = false

  constructor(debugMode: boolean = false) {
    this.debugMode = debugMode
  }

  canHandle(context: PageContext): boolean {
    // 自定义字幕源需要用户主动激活，不应该在初始检测时激活
    // 避免在每个iframe中触发重型资源加载
    return false
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

    // 清理Fixed定位监听器
    this.removeFixedPositionListeners()

    // Reset all state to allow fresh reload
    this.srtEntries = []
    this.targetVideo = null
    this.isInitialized = false
    this.isUsingFixedPositioning = false

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

    // 清理固定定位监听器
    this.removeFixedPositionListeners()
    this.isUsingFixedPositioning = false

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

    if (this.debugMode) {
      console.log('[CustomSRTSubtitleSource] 创建字幕覆盖层')
    }

    const overlay = document.createElement('div')
    overlay.className = 'im-custom-subtitle-overlay'

    // 从存储中加载并应用样式
    this.loadAndApplyStyles(overlay).then(() => {
      if (this.debugMode) {
        console.log('[CustomSRTSubtitleSource] 自定义样式已应用')
      }
    })

    const videoContainer = this.findVideoContainer(this.targetVideo)

    if (videoContainer) {
      if (this.debugMode) {
        console.log('[CustomSRTSubtitleSource] 使用视频容器定位')
      }
      overlay.style.position = 'absolute'
      overlay.style.left = '50%'
      overlay.style.transform = 'translateX(-50%)'

      const originalPosition = getComputedStyle(videoContainer!).position
      if (originalPosition === 'static') {
        videoContainer!.style.position = 'relative'
      }

      videoContainer!.appendChild(overlay)
      this.isUsingFixedPositioning = false
    } else {
      if (this.debugMode) {
        console.log('[CustomSRTSubtitleSource] 使用固定定位作为后备方案')
      }

      if (this.forceFullscreenMode) {
        this.setupFullscreenPositioning(overlay)
        if (this.debugMode) {
          console.log('[CustomSRTSubtitleSource] 使用全屏字幕定位')
        }
      } else {
        this.setupFixedPositioning(overlay)
        this.setupFixedPositionListeners()
      }

      document.body.appendChild(overlay)
      this.isUsingFixedPositioning = true
    }

    return overlay
  }

  /**
   * 从存储中加载并应用样式
   */
  private async loadAndApplyStyles(overlay: HTMLElement): Promise<void> {
    try {
      const styles = await this.getStoredStyles()
      if (this.debugMode) {
        console.log('[CustomSRTSubtitleSource] 加载到存储的样式:', styles)
      }

      overlay.style.cssText = `
        position: absolute;
        bottom: ${styles.verticalPosition}px;
        left: 50%;
        transform: translateX(-50%);
        max-width: 80%;
        text-align: center;
        font-size: ${styles.fontSize}px;
        font-weight: bold;
        color: white;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
        background-color: rgba(0, 0, 0, ${styles.backgroundOpacity / 100});
        padding: 8px 16px;
        border-radius: 8px;
        z-index: 2147483647;
        pointer-events: none;
        display: none;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        line-height: 1.4;
      `
      if (styles.timeOffset !== undefined) {
        this.timeOffset = styles.timeOffset
      }
    } catch (error) {
      if (this.debugMode) {
        console.error('[CustomSRTSubtitleSource] 加载样式失败:', error)
      }
      // 应用默认样式作为后备
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
        z-index: 2147483647;
        pointer-events: none;
        display: none;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        line-height: 1.4;
      `
    }
  }

  /**
   * 获取存储的样式
   */
  private getStoredStyles(): Promise<{
    fontSize: number
    verticalPosition: number
    backgroundOpacity: number
    timeOffset: number
  }> {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        {
          subtitleStyles: {
            fontSize: 16,
            verticalPosition: 60,
            backgroundOpacity: 50,
            timeOffset: 0,
          },
        },
        (result) => {
          resolve(result.subtitleStyles)
        }
      )
    })
  }

  /**
   * 设置Fixed定位样式
   */
  private setupFixedPositioning(overlay: HTMLElement): void {
    if (!this.targetVideo) return

    this.getStoredStyles().then((styles) => {
      const videoRect = this.targetVideo!.getBoundingClientRect()
      overlay.style.cssText = `
        position: fixed;
        left: ${videoRect.left + videoRect.width / 2}px;
        top: ${videoRect.bottom - styles.verticalPosition - 20}px;
        transform: translateX(-50%);
        max-width: 80%;
        text-align: center;
        font-size: ${styles.fontSize}px;
        font-weight: bold;
        color: white;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
        background-color: rgba(0, 0, 0, ${styles.backgroundOpacity / 100});
        padding: 8px 16px;
        border-radius: 8px;
        z-index: 2147483647;
        pointer-events: none;
        display: none;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        line-height: 1.4;
      `
    })
  }

  /**
   * 设置全屏字幕定位
   */
  private setupFullscreenPositioning(overlay: HTMLElement): void {
    overlay.style.cssText = `
      position: fixed;
      left: 50%;
      bottom: 120px;
      transform: translateX(-50%);
      max-width: 80%;
      text-align: center;
      font-size: 18px;
      font-weight: bold;
      color: white;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
      background-color: rgba(0, 0, 0, 0.7);
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 2147483647;
      pointer-events: none;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.4;
    `
  }

  /**
   * 设置强制全屏模式
   */
  setForceFullscreenMode(enabled: boolean): void {
    if (this.forceFullscreenMode === enabled) return
    
    this.forceFullscreenMode = enabled
    
    if (this.debugMode) {
      console.log('[CustomSRTSubtitleSource] 全屏模式:', enabled ? '启用' : '禁用')
    }
    
    // 如果当前正在使用fixed定位，重新创建overlay
    if (this.isUsingFixedPositioning && this.overlayElement) {
      this.removeFixedPositionListeners()
      
      const wasVisible = this.overlayElement.style.display !== 'none'
      const currentSubtitle = this.currentSubtitle
      
      // 重新创建overlay
      this.overlayElement.remove()
      this.overlayElement = this.createSubtitleOverlay()
      
      // 恢复显示状态
      if (wasVisible && currentSubtitle) {
        this.currentSubtitle = currentSubtitle
        this.updateOverlayDisplay()
      }
    }
  }

  /**
   * 设置Fixed定位的事件监听器
   */
  private setupFixedPositionListeners(): void {
    // 清理现有监听器
    this.removeFixedPositionListeners()
    
    // 防抖更新函数
    const debouncedUpdate = () => {
      if (this.updateTimer) {
        clearTimeout(this.updateTimer)
      }
      this.updateTimer = window.setTimeout(() => {
        if (this.isUsingFixedPositioning && this.overlayElement) {
          // 使用 requestAnimationFrame 确保DOM更新完成
          requestAnimationFrame(() => {
            this.updateFixedPosition()
          })
        }
      }, 16) // ~60fps
    }
    
    // 窗口尺寸变化
    this.resizeHandler = debouncedUpdate
    
    // 页面滚动
    this.scrollHandler = debouncedUpdate
    
    // 全屏状态变化
    this.fullscreenHandler = () => {
      if (this.debugMode) {
        console.log('[CustomSRTSubtitleSource] 全屏状态变化')
      }
      // 全屏变化需要稍微延迟，因为浏览器需要时间重新布局
      setTimeout(() => {
        if (this.isUsingFixedPositioning && this.overlayElement) {
          this.updateFixedPosition()
        }
      }, 100)
    }
    
    // 设备方向变化（移动设备）
    this.orientationHandler = debouncedUpdate
    
    // 添加所有监听器
    window.addEventListener('resize', this.resizeHandler)
    window.addEventListener('scroll', this.scrollHandler, { passive: true })
    document.addEventListener('fullscreenchange', this.fullscreenHandler)
    window.addEventListener('orientationchange', this.orientationHandler)
    
    // 定期检查视频位置（保险措施）
    const periodicCheck = () => {
      if (this.isUsingFixedPositioning && this.overlayElement && this.targetVideo) {
        const rect = this.targetVideo.getBoundingClientRect()
        const overlayRect = this.overlayElement.getBoundingClientRect()
        
        // 检查位置是否严重偏离
        const expectedLeft = rect.left + rect.width / 2
        const actualLeft = overlayRect.left + overlayRect.width / 2
        
        if (Math.abs(expectedLeft - actualLeft) > 50) {
          if (this.debugMode) {
            console.log('[CustomSRTSubtitleSource] 检测到位置偏离，重新定位')
          }
          this.updateFixedPosition()
        }
      }
    }
    
    // 每2秒检查一次位置
    this.updateTimer = window.setInterval(periodicCheck, 2000)
    
    if (this.debugMode) {
      console.log('[CustomSRTSubtitleSource] 增强版Fixed定位监听器已设置')
    }
  }

  /**
   * 更新Fixed定位
   */
  private updateFixedPosition(): void {
    if (!this.overlayElement || !this.targetVideo || !this.isUsingFixedPositioning) return

    this.getStoredStyles().then((styles) => {
      const videoRect = this.targetVideo!.getBoundingClientRect()

      // 检查视频是否可见
      if (videoRect.width === 0 || videoRect.height === 0) {
        if (this.debugMode) {
          console.log('[CustomSRTSubtitleSource] 视频不可见，跳过位置更新')
        }
        return
      }

      const newLeft = videoRect.left + videoRect.width / 2
      const newTop = videoRect.bottom - styles.verticalPosition - 20

      this.overlayElement!.style.left = `${newLeft}px`
      this.overlayElement!.style.top = `${newTop}px`

      if (this.debugMode) {
        console.log('[CustomSRTSubtitleSource] 位置已更新:', {
          videoRect: {
            left: videoRect.left,
            top: videoRect.top,
            width: videoRect.width,
            height: videoRect.height,
          },
          overlayPosition: {
            left: newLeft,
            top: newTop,
          },
        })
      }
    })
  }

  /**
   * 移除Fixed定位监听器
   */
  private removeFixedPositionListeners(): void {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler)
      this.resizeHandler = null
    }
    
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler)
      this.scrollHandler = null
    }
    
    if (this.fullscreenHandler) {
      document.removeEventListener('fullscreenchange', this.fullscreenHandler)
      this.fullscreenHandler = null
    }
    
    if (this.orientationHandler) {
      window.removeEventListener('orientationchange', this.orientationHandler)
      this.orientationHandler = null
    }
    
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      clearTimeout(this.updateTimer)
      this.updateTimer = null
    }
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

    while (element && element !== document.body) {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()

      // 优先选择有实际尺寸且能包含视频的容器
      if (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.width >= video.clientWidth * 0.8 &&
        rect.height >= video.clientHeight * 0.8
      ) {
        if (this.debugMode) {
          console.log(
            '[CustomSRTSubtitleSource] 找到合适尺寸的容器:',
            element.tagName,
            element.className
          )
        }
        return element
      }

      // 回退：寻找具有定位属性的容器（但只有在有尺寸的情况下）
      if (
        (style.position === 'relative' || style.position === 'absolute') &&
        rect.width > 0 &&
        rect.height > 0
      ) {
        if (this.debugMode) {
          console.log(
            '[CustomSRTSubtitleSource] 找到有定位且有尺寸的容器:',
            element.tagName,
            element.className
          )
        }
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
