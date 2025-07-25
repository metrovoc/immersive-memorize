/**
 * Immersive Memorize 主控制器 V2
 * 支持多字幕源架构的重构版本
 */

import type { FlashCard, ExtensionSettings, Word } from '@/types'
import { VocabLibraryManager } from '@/lib/vocab-library'
import { SubtitleProcessor } from './subtitle-processor'
import { SubtitleSourceRegistry, PageContextBuilder } from './subtitle-sources/registry'
import { NetflixSubtitleSource } from './subtitle-sources/netflix-source'
import { CustomSRTSubtitleSource } from './subtitle-sources/custom-srt-source'
import type { ISubtitleSource, PageContext } from './subtitle-sources/types'

export class ImmersiveMemorize {
  private vocabLibraryManager: VocabLibraryManager
  private subtitleProcessor: SubtitleProcessor | null = null
  private sourceRegistry: SubtitleSourceRegistry
  private activeSource: ISubtitleSource | null = null
  private customSource: CustomSRTSubtitleSource

  private learnedWords: Set<string> = new Set()
  private currentTargetWord: Word | null = null
  private currentTargetElement: HTMLElement | null = null
  private pageContextObserver: MutationObserver | null = null

  private captureHotkey: string = 's'
  private debugMode: boolean = true
  private enableScreenshot: boolean = false

  // Context-Aware 属性
  private isMainFrame: boolean
  private frameContext: 'main' | 'iframe'

  constructor() {
    // 检测当前frame上下文
    this.isMainFrame = window.top === window
    this.frameContext = this.isMainFrame ? 'main' : 'iframe'
    
    if (this.debugMode) {
      console.log(`[ImmersiveMemorizeV2] 初始化${this.frameContext}frame模式`)
    }

    this.vocabLibraryManager = new VocabLibraryManager()
    this.sourceRegistry = new SubtitleSourceRegistry(this.debugMode)
    this.customSource = new CustomSRTSubtitleSource(this.debugMode)
    this.initializeSubtitleSources()
    this.setupMessageListeners()
  }

  /**
   * 初始化所有字幕源
   */
  private initializeSubtitleSources(): void {
    // 注册Netflix字幕源
    this.sourceRegistry.register('netflix.com', new NetflixSubtitleSource(this.debugMode))

    // 注册自定义字幕源（支持所有网站）
    this.sourceRegistry.register('*', this.customSource)

    if (this.debugMode) {
      const stats = this.sourceRegistry.getStats()
      console.log('[ImmersiveMemorizeV2] 字幕源注册完成:', stats)
    }
  }

  async init(): Promise<void> {
    try {
      if (this.frameContext === 'main') {
        await this.initMainFrameFeatures()
      } else {
        await this.initIFrameFeatures()
      }

      if (this.debugMode) {
        console.log(`[ImmersiveMemorizeV2] ${this.frameContext}frame初始化完成`)
      }
    } catch (error) {
      console.error(`[ImmersiveMemorizeV2] ${this.frameContext}frame初始化失败:`, error)
    }
  }

  /**
   * 初始化主frame功能
   */
  private async initMainFrameFeatures(): Promise<void> {
    // 主frame：完整功能但不处理iframe内视频
    await this.vocabLibraryManager.init()
    await this.loadSettings()

    this.subtitleProcessor = new SubtitleProcessor(
      this.vocabLibraryManager,
      this.learnedWords,
      this.debugMode
    )

    // 只检测主frame的字幕源
    await this.detectAndInitializeSubtitleSources()
    this.setupEventListeners()
    this.setupStorageListener()

    if (this.debugMode) {
      this.logCurrentState()
    }
  }

  /**
   * 初始化iframe功能
   */
  private async initIFrameFeatures(): Promise<void> {
    // iframe：轻量功能，专注视频处理
    await this.vocabLibraryManager.init()
    await this.loadSettings()

    this.subtitleProcessor = new SubtitleProcessor(
      this.vocabLibraryManager,
      this.learnedWords,
      this.debugMode
    )

    // iframe只处理自己的视频和字幕
    await this.detectAndInitializeSubtitleSources()
    this.setupEventListeners()
    this.setupStorageListener()

    if (this.debugMode) {
      console.log('[ImmersiveMemorizeV2] iframe轻量模式，专注视频处理')
    }
  }

  /**
   * 检测页面环境并初始化字幕源
   */
  private async detectAndInitializeSubtitleSources(): Promise<void> {
    const context = PageContextBuilder.create()
    const availableSources = this.sourceRegistry.getAvailableSources(context)

    if (this.debugMode) {
      console.log('[ImmersiveMemorizeV2] 页面上下文:', context)
      console.log(
        '[ImmersiveMemorizeV2] 可用字幕源:',
        availableSources.map(s => s.name)
      )
    }

    // 选择最高优先级的字幕源作为主要源
    if (availableSources.length > 0) {
      this.activeSource = availableSources[0]
      await this.initializeActiveSource()
    }

    // 设置页面变化监听器
    this.setupPageContextObserver(context)
  }

  /**
   * 初始化当前活跃的字幕源
   */
  private async initializeActiveSource(): Promise<void> {
    if (!this.activeSource) return

    try {
      await this.activeSource.initialize()

      if (this.activeSource.isReady()) {
        this.setupSubtitleObserver()

        if (this.debugMode) {
          console.log(`[ImmersiveMemorizeV2] 字幕源 ${this.activeSource.name} 已就绪`)
        }
      }
    } catch (error) {
      console.error(`[ImmersiveMemorizeV2] 初始化字幕源 ${this.activeSource.name} 失败:`, error)
      this.activeSource = null
    }
  }

  /**
   * 设置字幕观察器
   */
  private setupSubtitleObserver(): void {
    if (!this.activeSource) return

    this.activeSource.setupObserver((containers: HTMLElement[]) => {
      this.processSubtitleContainers(containers)
    })
  }

  /**
   * 处理字幕容器
   */
  private async processSubtitleContainers(containers: HTMLElement[]): Promise<void> {
    if (!this.subtitleProcessor || containers.length === 0) return

    // 清除现有高亮
    this.clearAllHighlights()
    this.currentTargetWord = null
    this.currentTargetElement = null

    // 按优先级处理容器
    for (const container of containers) {
      const text = container.innerText?.trim()
      if (!text) continue

      // 重置处理标记
      container.dataset.imProcessed = ''

      // 尝试处理这个容器
      const targetWord = await this.subtitleProcessor.processAndHighlight(container)

      if (targetWord) {
        this.currentTargetWord = targetWord
        this.currentTargetElement = document.querySelector('.im-current-target')
        container.dataset.imProcessed = 'true'

        if (this.debugMode) {
          console.log(
            `[ImmersiveMemorizeV2] 找到目标词汇: ${targetWord.word} (原形: ${targetWord.lemma})`
          )
        }
        return // 找到目标词汇后停止处理
      }
    }

    if (this.debugMode) {
      console.log('[ImmersiveMemorizeV2] 当前字幕无未学词汇')
    }
  }

  /**
   * 设置页面上下文观察器
   */
  private setupPageContextObserver(initialContext: PageContext): void {
    this.pageContextObserver = PageContextBuilder.observeChanges(newContext => {
      if (this.hasSignificantContextChange(initialContext, newContext)) {
        if (this.debugMode) {
          console.log('[ImmersiveMemorizeV2] 页面上下文发生重大变化，重新初始化')
        }
        this.detectAndInitializeSubtitleSources()
      }
    })
  }

  /**
   * 检查上下文是否有重大变化
   */
  private hasSignificantContextChange(oldContext: PageContext, newContext: PageContext): boolean {
    return (
      oldContext.hostname !== newContext.hostname ||
      oldContext.hasVideo !== newContext.hasVideo ||
      Math.abs(oldContext.videoElements.length - newContext.videoElements.length) > 0
    )
  }

  /**
   * 切换到自定义字幕模式
   */
  async switchToCustomSubtitleMode(srtFile: File, targetVideo: HTMLVideoElement): Promise<void> {
    try {
      // 清理当前字幕源
      if (this.activeSource) {
        this.activeSource.cleanup()
      }

      // 配置自定义字幕源
      await this.customSource.loadSRTFile(srtFile)
      this.customSource.setTargetVideo(targetVideo)
      await this.customSource.initialize()

      // 切换到自定义字幕源
      this.activeSource = this.customSource
      this.setupSubtitleObserver()

      if (this.debugMode) {
        const stats = this.customSource.getStats()
        console.log('[ImmersiveMemorizeV2] 切换到自定义字幕模式:', stats)
      }

      this.showNotification(`已加载 ${this.customSource.getStats().totalEntries} 条自定义字幕`)
    } catch (error) {
      console.error('[ImmersiveMemorizeV2] 切换到自定义字幕模式失败:', error)
      this.showNotification('自定义字幕加载失败: ' + (error as Error).message, 'error')
    }
  }

  /**
   * 切换回原生字幕模式
   */
  async switchToNativeSubtitleMode(): Promise<void> {
    const context = PageContextBuilder.create()
    const nativeSources = this.sourceRegistry
      .getAvailableSources(context)
      .filter(source => source.capabilities.supportsNativeSubtitles)

    if (nativeSources.length > 0) {
      // 清理当前字幕源
      if (this.activeSource) {
        this.activeSource.cleanup()
      }

      // 切换到原生字幕源
      this.activeSource = nativeSources[0]
      await this.initializeActiveSource()

      if (this.debugMode) {
        console.log(`[ImmersiveMemorizeV2] 切换到原生字幕模式: ${this.activeSource.name}`)
      }

      this.showNotification(`已切换到${this.activeSource.name}`)
    } else {
      this.showNotification('当前网站不支持原生字幕', 'warning')
    }
  }

  /**
   * 加载设置
   */
  private async loadSettings(): Promise<void> {
    const result = (await chrome.storage.local.get([
      'captureHotkey',
      'debugMode',
      'enableScreenshot',
      'savedCards',
    ])) as Partial<ExtensionSettings>

    this.captureHotkey = result.captureHotkey || 's'
    this.debugMode = result.debugMode !== false
    this.enableScreenshot = result.enableScreenshot || false

    // 加载已学词汇
    const savedCards = result.savedCards || []
    this.learnedWords = new Set(savedCards.map((card: FlashCard) => card.word))
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    const keyHandler = async (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === this.captureHotkey.toLowerCase()) {
        if (!this.currentTargetWord) {
          this.showNotification('当前无生词可学习', 'info')
          return
        }

        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()

        await this.captureData()
      }
    }

    document.addEventListener('keydown', keyHandler, true)
    window.addEventListener('keydown', keyHandler, true)

    if (this.debugMode) {
      console.log('[ImmersiveMemorizeV2] 事件监听器已设置')
    }
  }

  /**
   * 设置消息监听器
   */
  private setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'INITIATE_VIDEO_SELECTION') {
        this.handleVideoSelectionRequest()
          .then(() => sendResponse({ success: true }))
          .catch(error => {
            console.error('[ImmersiveMemorizeV2] Video selection failed:', error)
            sendResponse({ success: false, error: error.message })
          })
        return true // Keep sendResponse alive for async response
      }
    })

    if (this.debugMode) {
      console.log('[ImmersiveMemorizeV2] 消息监听器已设置')
    }
  }

  /**
   * 处理视频选择请求
   */
  private async handleVideoSelectionRequest(): Promise<void> {
    // 发现页面中的视频元素
    const videoElements = this.discoverVideoElements()

    if (videoElements.length === 0) {
      return
    }

    if (this.debugMode) {
      console.log(`[ImmersiveMemorizeV2] 发现 ${videoElements.length} 个视频元素`)
    }

    // 为每个视频创建选择遮罩
    this.createVideoSelectionOverlays(videoElements)
  }

  /**
   * 发现页面中的视频元素
   */
  private discoverVideoElements(): HTMLVideoElement[] {
    const videos = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[]
    
    if (this.debugMode) {
      console.log('[ImmersiveMemorizeV2] 主页面视频元素:', videos.length)
      
      // 检查iframe中的视频
      const iframes = Array.from(document.querySelectorAll('iframe'))
      console.log('[ImmersiveMemorizeV2] 发现iframe数量:', iframes.length)
      
      iframes.forEach((iframe, index) => {
        try {
          // 尝试访问iframe内容（可能会被同源策略阻止）
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
          if (iframeDoc) {
            const iframeVideos = Array.from(iframeDoc.querySelectorAll('video'))
            console.log(`[ImmersiveMemorizeV2] iframe ${index} 中的视频:`, iframeVideos.length)
            if (iframeVideos.length > 0) {
              console.log(`[ImmersiveMemorizeV2] iframe ${index} 视频详情:`, iframeVideos.map(v => ({
                src: v.src,
                attributes: Array.from(v.attributes).map(attr => `${attr.name}="${attr.value}"`),
                rect: v.getBoundingClientRect()
              })))
            }
          } else {
            console.log(`[ImmersiveMemorizeV2] iframe ${index} 无法访问（可能跨域）:`, iframe.src)
          }
        } catch (e) {
          console.log(`[ImmersiveMemorizeV2] iframe ${index} 访问被阻止:`, (e as Error).message, iframe.src)
        }
      })
    }

    // 临时移除过滤条件进行测试，直接返回所有视频
    return videos

    // 原过滤逻辑（暂时注释掉）
    // return videos.filter(video => {
    //   // 过滤掉不可见或太小的视频
    //   const rect = video.getBoundingClientRect()
    //   return rect.width > 100 && rect.height > 100 && video.style.display !== 'none'
    // })
  }

  /**
   * 为视频元素创建选择遮罩
   */
  private createVideoSelectionOverlays(videos: HTMLVideoElement[]): void {
    // 清理可能存在的旧遮罩
    this.clearVideoSelectionOverlays()

    videos.forEach((video, index) => {
      const overlay = this.createVideoOverlay(video, index)
      this.positionOverlay(overlay, video)
      document.body.appendChild(overlay)
    })

    // 添加全局ESC键监听器来取消选择
    this.setupVideoSelectionEscapeHandler()
  }

  /**
   * 创建单个视频的选择遮罩
   */
  private createVideoOverlay(video: HTMLVideoElement, index: number): HTMLElement {
    const overlay = document.createElement('div')
    overlay.className = 'im-video-selection-overlay'
    overlay.dataset.videoIndex = index.toString()

    // 使用 Tailwind CSS 样式
    overlay.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.7);
      border: 3px solid #3b82f6;
      border-radius: 12px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s ease;
      backdrop-filter: blur(2px);
    `

    // 获取视频信息
    const videoInfo = this.getVideoDisplayInfo(video)

    overlay.innerHTML = `
      <div class="flex flex-col items-center space-y-4 p-6 text-white text-center">
        <div class="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
          <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
          </svg>
        </div>
        <div>
          <div class="text-lg font-semibold mb-2">视频 ${index + 1}</div>
          <div class="text-sm text-gray-300 space-y-1">
            <div>尺寸: ${videoInfo.dimensions}</div>
            <div>时长: ${videoInfo.duration}</div>
          </div>
        </div>
        <button class="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg transition-colors">
          选择此视频
        </button>
      </div>
    `

    // 添加点击事件
    overlay.addEventListener('click', e => {
      e.stopPropagation()
      this.handleVideoSelection(video, index)
    })

    // 添加悬停效果
    overlay.addEventListener('mouseenter', () => {
      overlay.style.borderColor = '#1d4ed8'
      overlay.style.transform = 'scale(1.02)'
    })

    overlay.addEventListener('mouseleave', () => {
      overlay.style.borderColor = '#3b82f6'
      overlay.style.transform = 'scale(1)'
    })

    return overlay
  }

  /**
   * 定位遮罩层到视频元素上方
   */
  private positionOverlay(overlay: HTMLElement, video: HTMLVideoElement): void {
    const rect = video.getBoundingClientRect()
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

    overlay.style.top = `${rect.top + scrollTop}px`
    overlay.style.left = `${rect.left + scrollLeft}px`
    overlay.style.width = `${rect.width}px`
    overlay.style.height = `${rect.height}px`
  }

  /**
   * 获取视频显示信息
   */
  private getVideoDisplayInfo(video: HTMLVideoElement): { dimensions: string; duration: string } {
    const dimensions = `${Math.round(video.videoWidth || video.clientWidth)}×${Math.round(video.videoHeight || video.clientHeight)}`

    let duration = '未知'
    if (video.duration && !isNaN(video.duration)) {
      const mins = Math.floor(video.duration / 60)
      const secs = Math.floor(video.duration % 60)
      duration = `${mins}:${secs.toString().padStart(2, '0')}`
    }

    return { dimensions, duration }
  }

  /**
   * 处理视频选择
   */
  private async handleVideoSelection(video: HTMLVideoElement, index: number): Promise<void> {
    try {
      // 清理选择界面
      this.clearVideoSelectionOverlays()

      if (this.debugMode) {
        console.log(`[ImmersiveMemorizeV2] 用户选择了视频 ${index + 1}`)
      }

      // 进入第三阶段：显示上下文控制面板
      this.showContextControlPanel(video)
    } catch (error) {
      console.error('[ImmersiveMemorizeV2] 处理视频选择失败:', error)
      this.showNotification('视频选择失败: ' + (error as Error).message, 'error')
    }
  }

  /**
   * 清理视频选择遮罩
   */
  private clearVideoSelectionOverlays(): void {
    const overlays = document.querySelectorAll('.im-video-selection-overlay')
    overlays.forEach(overlay => overlay.remove())

    // 移除ESC键监听器
    document.removeEventListener('keydown', this.videoSelectionEscapeHandler)
  }

  /**
   * ESC键处理器
   */
  private videoSelectionEscapeHandler = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.clearVideoSelectionOverlays()
      this.showNotification('已取消视频选择', 'info')
    }
  }

  /**
   * 设置视频选择ESC键监听器
   */
  private setupVideoSelectionEscapeHandler(): void {
    document.addEventListener('keydown', this.videoSelectionEscapeHandler)
  }

  /**
   * 显示上下文控制面板（第三阶段）
   */
  private showContextControlPanel(video: HTMLVideoElement): void {
    // 清理可能存在的旧面板
    this.clearContextControlPanel()

    const panel = this.createContextControlPanel(video)
    this.positionContextPanel(panel, video)
    document.body.appendChild(panel)

    if (this.debugMode) {
      console.log('[ImmersiveMemorizeV2] 上下文控制面板已显示')
    }

    this.showNotification('请选择字幕文件 (.srt)', 'info')
  }

  /**
   * 创建上下文控制面板
   */
  private createContextControlPanel(video: HTMLVideoElement): HTMLElement {
    const panel = document.createElement('div')
    panel.className = 'im-context-control-panel'
    panel.dataset.targetVideoIndex = Array.from(document.querySelectorAll('video'))
      .indexOf(video)
      .toString()

    // 使用内联样式确保样式正确应用
    panel.style.cssText = `
      position: fixed;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      border: 1px solid #e5e7eb;
      max-width: 320px;
      min-width: 280px;
    `

    const videoInfo = this.getVideoDisplayInfo(video)

    panel.innerHTML = `
      <div style="padding: 20px;">
        <!-- Header -->
        <div style="display: flex; items-center: space-between; margin-bottom: 16px;">
          <div style="flex: 1;">
            <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #1f2937;">关联字幕文件</h3>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">视频尺寸: ${videoInfo.dimensions}</p>
          </div>
          <button class="im-close-panel" style="
            background: #f3f4f6;
            border: none;
            border-radius: 6px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: #6b7280;
            transition: all 0.2s;
          " title="关闭">
            <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- File Upload Area -->
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; color: #374151;">
            选择字幕文件
          </label>
          <div class="im-file-upload-area" style="
            border: 2px dashed #d1d5db;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
            background: #f9fafb;
          ">
            <div style="margin-bottom: 12px;">
              <svg style="width: 32px; height: 32px; margin: 0 auto; color: #9ca3af;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 500; color: #374151;">
              点击选择或拖拽文件到此处
            </p>
            <p style="margin: 0; font-size: 12px; color: #6b7280;">
              支持 .srt, .vtt 格式
            </p>
            <input type="file" class="im-file-input" accept=".srt,.vtt" style="display: none;" />
          </div>
        </div>

        <!-- Selected File Info -->
        <div class="im-file-info" style="
          display: none;
          margin-bottom: 16px;
          padding: 12px;
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
        ">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="flex: 1; min-width: 0;">
              <div class="im-file-name" style="font-size: 14px; font-weight: 500; color: #0c4a6e; margin-bottom: 2px;"></div>
              <div class="im-file-size" style="font-size: 12px; color: #0369a1;"></div>
            </div>
            <button class="im-remove-file" style="
              background: none;
              border: none;
              color: #6b7280;
              cursor: pointer;
              padding: 4px;
            " title="移除文件">
              <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 8px;">
          <button class="im-cancel-btn" style="
            flex: 1;
            padding: 10px 16px;
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            color: #374151;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          ">
            取消
          </button>
          <button class="im-load-subtitle-btn" disabled style="
            flex: 2;
            padding: 10px 16px;
            background: #3b82f6;
            border: 1px solid #3b82f6;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            opacity: 0.5;
          ">
            加载字幕
          </button>
        </div>
      </div>
    `

    this.attachContextPanelEventListeners(panel, video)
    return panel
  }

  /**
   * 定位上下文面板
   */
  private positionContextPanel(panel: HTMLElement, video: HTMLVideoElement): void {
    const videoRect = video.getBoundingClientRect()
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

    // 计算面板位置 - 默认在视频右下角
    let left = videoRect.right + scrollLeft - 320 // 面板宽度
    let top = videoRect.bottom + scrollTop - 200 // 估算面板高度

    // 确保面板不会超出视窗
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    if (left < 10) left = 10
    if (left + 320 > viewportWidth - 10) left = viewportWidth - 330
    if (top < 10) top = 10
    if (top + 200 > viewportHeight - 10) top = Math.max(10, videoRect.top + scrollTop)

    panel.style.left = `${left}px`
    panel.style.top = `${top}px`
  }

  /**
   * 为上下文面板附加事件监听器
   */
  private attachContextPanelEventListeners(panel: HTMLElement, video: HTMLVideoElement): void {
    const fileInput = panel.querySelector('.im-file-input') as HTMLInputElement
    const fileUploadArea = panel.querySelector('.im-file-upload-area') as HTMLElement
    const fileInfo = panel.querySelector('.im-file-info') as HTMLElement
    const closeBtn = panel.querySelector('.im-close-panel') as HTMLButtonElement
    const cancelBtn = panel.querySelector('.im-cancel-btn') as HTMLButtonElement
    const loadBtn = panel.querySelector('.im-load-subtitle-btn') as HTMLButtonElement
    const removeFileBtn = panel.querySelector('.im-remove-file') as HTMLButtonElement

    let selectedFile: File | null = null

    // 文件选择处理
    fileInput.addEventListener('change', e => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        this.handleFileSelection(file, panel)
        selectedFile = file
      }
    })

    // 点击上传区域
    fileUploadArea.addEventListener('click', () => {
      fileInput.click()
    })

    // 拖拽处理
    fileUploadArea.addEventListener('dragover', e => {
      e.preventDefault()
      fileUploadArea.style.borderColor = '#3b82f6'
      fileUploadArea.style.backgroundColor = '#eff6ff'
    })

    fileUploadArea.addEventListener('dragleave', () => {
      fileUploadArea.style.borderColor = '#d1d5db'
      fileUploadArea.style.backgroundColor = '#f9fafb'
    })

    fileUploadArea.addEventListener('drop', e => {
      e.preventDefault()
      fileUploadArea.style.borderColor = '#d1d5db'
      fileUploadArea.style.backgroundColor = '#f9fafb'

      const file = e.dataTransfer?.files[0]
      if (file && (file.name.endsWith('.srt') || file.name.endsWith('.vtt'))) {
        this.handleFileSelection(file, panel)
        selectedFile = file
      } else {
        this.showNotification('请选择 .srt 或 .vtt 格式的字幕文件', 'warning')
      }
    })

    // 按钮事件
    closeBtn.addEventListener('click', () => this.clearContextControlPanel())
    cancelBtn.addEventListener('click', () => this.clearContextControlPanel())
    removeFileBtn.addEventListener('click', () => {
      selectedFile = null
      this.clearFileSelection(panel)
    })

    loadBtn.addEventListener('click', async () => {
      if (selectedFile) {
        await this.handleSubtitleLoad(selectedFile, video)
      }
    })

    // 悬停效果
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.backgroundColor = '#e5e7eb'
    })
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.backgroundColor = '#f3f4f6'
    })

    cancelBtn.addEventListener('mouseenter', () => {
      if (!cancelBtn.disabled) {
        cancelBtn.style.backgroundColor = '#e5e7eb'
      }
    })
    cancelBtn.addEventListener('mouseleave', () => {
      if (!cancelBtn.disabled) {
        cancelBtn.style.backgroundColor = '#f3f4f6'
      }
    })

    loadBtn.addEventListener('mouseenter', () => {
      if (!loadBtn.disabled) {
        loadBtn.style.backgroundColor = '#2563eb'
      }
    })
    loadBtn.addEventListener('mouseleave', () => {
      if (!loadBtn.disabled) {
        loadBtn.style.backgroundColor = '#3b82f6'
      }
    })
  }

  /**
   * 处理文件选择
   */
  private handleFileSelection(file: File, panel: HTMLElement): void {
    if (!file.name.endsWith('.srt') && !file.name.endsWith('.vtt')) {
      this.showNotification('请选择 .srt 或 .vtt 格式的字幕文件', 'warning')
      return
    }

    const fileInfo = panel.querySelector('.im-file-info') as HTMLElement
    const fileName = panel.querySelector('.im-file-name') as HTMLElement
    const fileSize = panel.querySelector('.im-file-size') as HTMLElement
    const loadBtn = panel.querySelector('.im-load-subtitle-btn') as HTMLButtonElement
    const uploadArea = panel.querySelector('.im-file-upload-area') as HTMLElement

    fileName.textContent = file.name
    fileSize.textContent = this.formatFileSize(file.size)

    fileInfo.style.display = 'block'
    uploadArea.style.display = 'none'

    loadBtn.disabled = false
    loadBtn.style.opacity = '1'
    loadBtn.style.cursor = 'pointer'

    if (this.debugMode) {
      console.log(`[ImmersiveMemorizeV2] 文件已选择: ${file.name} (${file.size} bytes)`)
    }
  }

  /**
   * 清理文件选择
   */
  private clearFileSelection(panel: HTMLElement): void {
    const fileInfo = panel.querySelector('.im-file-info') as HTMLElement
    const loadBtn = panel.querySelector('.im-load-subtitle-btn') as HTMLButtonElement
    const uploadArea = panel.querySelector('.im-file-upload-area') as HTMLElement
    const fileInput = panel.querySelector('.im-file-input') as HTMLInputElement

    fileInfo.style.display = 'none'
    uploadArea.style.display = 'block'

    loadBtn.disabled = true
    loadBtn.style.opacity = '0.5'
    loadBtn.style.cursor = 'not-allowed'

    fileInput.value = ''
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB'
    return Math.round(bytes / (1024 * 1024)) + ' MB'
  }

  /**
   * 处理字幕加载（第四阶段）
   */
  private async handleSubtitleLoad(file: File, video: HTMLVideoElement): Promise<void> {
    try {
      // 显示加载状态
      this.updateLoadButtonState('loading')

      if (this.debugMode) {
        console.log(`[ImmersiveMemorizeV2] 开始加载字幕文件: ${file.name}`)
      }

      // 验证文件格式
      if (!this.isValidSubtitleFile(file)) {
        throw new Error('不支持的文件格式，请选择 .srt 或 .vtt 文件')
      }

      // 直接调用现有的字幕切换方法
      // 这会处理所有的文件读取、解析和集成逻辑
      await this.switchToCustomSubtitleMode(file, video)

      // 成功处理
      this.clearContextControlPanel()
      this.showNotification(`${file.name} 加载成功！现在可以学习字幕中的词汇了`, 'success')

      if (this.debugMode) {
        console.log('[ImmersiveMemorizeV2] 字幕文件处理完成，流程结束')
      }
    } catch (error) {
      console.error('[ImmersiveMemorizeV2] 字幕加载失败:', error)
      this.showNotification(
        '字幕加载失败: ' + (error instanceof Error ? error.message : '未知错误'),
        'error'
      )

      // 恢复按钮状态
      this.updateLoadButtonState('ready')
    }
  }

  /**
   * 验证字幕文件格式
   */
  private isValidSubtitleFile(file: File): boolean {
    const validExtensions = ['.srt', '.vtt']
    const fileName = file.name.toLowerCase()
    return validExtensions.some(ext => fileName.endsWith(ext))
  }

  /**
   * 更新加载按钮状态
   */
  private updateLoadButtonState(state: 'ready' | 'loading' | 'disabled'): void {
    const loadBtn = document.querySelector('.im-load-subtitle-btn') as HTMLButtonElement
    if (!loadBtn) return

    switch (state) {
      case 'loading':
        loadBtn.disabled = true
        loadBtn.style.opacity = '0.7'
        loadBtn.style.cursor = 'not-allowed'
        loadBtn.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
            <div style="
              width: 16px; 
              height: 16px; 
              border: 2px solid transparent; 
              border-top: 2px solid white; 
              border-radius: 50%; 
              animation: spin 1s linear infinite;
            "></div>
            <span>加载中...</span>
          </div>
        `
        // 添加旋转动画
        if (!document.head.querySelector('#im-loading-animation')) {
          const style = document.createElement('style')
          style.id = 'im-loading-animation'
          style.textContent = `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `
          document.head.appendChild(style)
        }
        break

      case 'ready':
        loadBtn.disabled = false
        loadBtn.style.opacity = '1'
        loadBtn.style.cursor = 'pointer'
        loadBtn.textContent = '加载字幕'
        break

      case 'disabled':
        loadBtn.disabled = true
        loadBtn.style.opacity = '0.5'
        loadBtn.style.cursor = 'not-allowed'
        loadBtn.textContent = '加载字幕'
        break
    }
  }

  /**
   * 清理上下文控制面板
   */
  private clearContextControlPanel(): void {
    const panels = document.querySelectorAll('.im-context-control-panel')
    panels.forEach(panel => panel.remove())

    if (this.debugMode) {
      console.log('[ImmersiveMemorizeV2] 上下文控制面板已清理')
    }
  }

  /**
   * 设置存储监听器
   */
  private setupStorageListener(): void {
    chrome.storage.onChanged.addListener(async changes => {
      let needsRefresh = false

      if (changes.vocabLibrarySettings) {
        await this.vocabLibraryManager.init()
        await this.subtitleProcessor?.updateWordLists()
        needsRefresh = true
      }

      if (changes.savedCards) {
        const savedCards = changes.savedCards.newValue || []
        this.learnedWords = new Set(savedCards.map((card: FlashCard) => card.word))
        this.subtitleProcessor?.setLearnedWords(this.learnedWords)
        needsRefresh = true
      }

      if (changes.captureHotkey) {
        this.captureHotkey = changes.captureHotkey.newValue || 's'
      }

      if (changes.debugMode) {
        this.debugMode = changes.debugMode.newValue !== false
      }

      if (needsRefresh) {
        this.refreshCurrentSubtitles()
      }
    })
  }

  /**
   * 刷新当前字幕
   */
  private refreshCurrentSubtitles(): void {
    if (!this.activeSource) return

    const containers = this.activeSource.detectSubtitleContainers()
    this.processSubtitleContainers(containers)
  }

  /**
   * 捕获学习数据
   */
  private async captureData(): Promise<void> {
    if (!this.currentTargetWord || !this.currentTargetElement || !this.activeSource) return

    try {
      const word = this.currentTargetWord
      const lemma = word.lemma

      // 检查是否已经学过
      if (this.learnedWords.has(lemma)) {
        this.showNotification(`${lemma} 已存在`, 'warning')
        return
      }

      // 获取句子内容
      const sentenceElement = this.currentTargetElement.closest(
        '.player-timedtext-text-container, .ltr-1472gpj, [data-uia="player-caption-text"], .im-custom-subtitle-overlay'
      ) as HTMLElement | null

      let sentence = ''
      if (sentenceElement && this.activeSource) {
        const parsedSubtitle = this.activeSource.parseSubtitleContent(sentenceElement)
        sentence = parsedSubtitle.displayHTML
      }

      // 获取媒体信息
      const mediaInfo = this.activeSource.extractMediaInfo()

      // 获取时间戳
      let timestamp = 0
      const videoElement = document.querySelector<HTMLVideoElement>('video')
      if (videoElement) {
        timestamp = Math.floor(videoElement.currentTime)
      }

      // 截图（如果启用）
      let screenshot = ''
      if (this.enableScreenshot) {
        screenshot = await this.captureVideoFrame(videoElement)
      }

      // 获取词汇详细信息
      const selectedLibrary = this.vocabLibraryManager.getSelectedLibrary()
      const vocabEntry = selectedLibrary?.data.find(entry => entry.VocabKanji === lemma)

      // 创建卡片数据
      const cardData: FlashCard = {
        id: Date.now(),
        word: lemma,
        sentence: sentence,
        timestamp: timestamp,
        screenshot: screenshot,
        sourceTitle: mediaInfo.fullTitle,
        createdAt: new Date().toISOString(),
        level: vocabEntry?.Level,
        definition: vocabEntry?.VocabDefCN,
        reading: vocabEntry?.VocabFurigana,
        showTitle: mediaInfo.showTitle,
        seasonNumber: mediaInfo.seasonNumber,
        episodeNumber: mediaInfo.episodeNumber,
        episodeTitle: mediaInfo.episodeTitle,
      }

      // 保存卡片
      const result = (await chrome.storage.local.get(['savedCards'])) as Partial<ExtensionSettings>
      const savedCards = result.savedCards || []
      savedCards.push(cardData)

      await chrome.storage.local.set({ savedCards: savedCards })

      // 更新已学词汇
      this.learnedWords.add(lemma)
      this.subtitleProcessor?.setLearnedWords(this.learnedWords)

      // 更新进度
      await this.vocabLibraryManager.updateProgressFromCards()

      this.showNotification(`${word.word} ( ${lemma} ) 已学习`)

      // 清除高亮并寻找下一个词汇
      this.clearAllHighlights()
      this.currentTargetWord = null
      this.currentTargetElement = null

      setTimeout(() => {
        this.refreshCurrentSubtitles()
      }, 100)
    } catch (error) {
      console.error('[ImmersiveMemorizeV2] 捕获数据失败:', error)
      this.showNotification('保存失败: ' + (error as Error).message, 'error')
    }
  }

  /**
   * 捕获视频帧（截图）
   */
  private async captureVideoFrame(videoElement: HTMLVideoElement | null): Promise<string> {
    if (!videoElement) return ''

    try {
      const response = await chrome.runtime.sendMessage({ action: 'captureVisibleTab' })
      return response?.data || ''
    } catch (error) {
      console.error('[ImmersiveMemorizeV2] 截图失败:', error)
      return ''
    }
  }

  /**
   * 清除所有高亮
   */
  private clearAllHighlights(): void {
    const highlights = document.querySelectorAll<HTMLElement>('.im-highlight')
    highlights.forEach(highlight => {
      const parent = highlight.parentNode
      if (parent) {
        parent.replaceChild(document.createTextNode(highlight.textContent || ''), highlight)
        parent.normalize()
      }
    })
  }

  /**
   * 显示通知
   */
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
    `

    notification.textContent = `${icon} ${message}`

    const appendTarget = document.fullscreenElement || document.body
    appendTarget.appendChild(notification)

    const duration = type === 'error' ? 4000 : type === 'warning' ? 3000 : 2000
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, duration)
  }

  /**
   * 记录当前状态（调试用）
   */
  private logCurrentState(): void {
    if (!this.debugMode) return

    const selectedLibrary = this.vocabLibraryManager.getSelectedLibrary()
    const settings = this.vocabLibraryManager.getSettings()
    const enabledLevels = Object.entries(settings.levelSettings)
      .filter(([_, progress]) => progress.enabled)
      .map(([level]) => level)

    console.log(`[ImmersiveMemorizeV2] 当前词库: ${selectedLibrary?.name || '未选择'}`)
    console.log(`[ImmersiveMemorizeV2] 激活等级: ${enabledLevels.join(', ')}`)
    console.log(`[ImmersiveMemorizeV2] 已学词汇: ${this.learnedWords.size} 个`)
    console.log(`[ImmersiveMemorizeV2] 当前字幕源: ${this.activeSource?.name || '无'}`)
    console.log(`[ImmersiveMemorizeV2] 捕获快捷键: ${this.captureHotkey.toUpperCase()}`)
  }

  /**
   * 获取当前状态信息
   */
  getStatus(): {
    activeSource: string | null
    isReady: boolean
    learnedWordsCount: number
    availableSources: string[]
  } {
    const context = PageContextBuilder.create()
    const availableSources = this.sourceRegistry.getAvailableSources(context)

    return {
      activeSource: this.activeSource?.name || null,
      isReady: this.activeSource?.isReady() || false,
      learnedWordsCount: this.learnedWords.size,
      availableSources: availableSources.map(s => s.name),
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.activeSource) {
      this.activeSource.cleanup()
    }

    if (this.pageContextObserver) {
      this.pageContextObserver.disconnect()
    }

    this.sourceRegistry.cleanup()
    this.clearAllHighlights()

    if (this.debugMode) {
      console.log('[ImmersiveMemorizeV2] 清理完成')
    }
  }
}
