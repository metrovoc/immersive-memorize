import '../globals.css'
import './popup-styles.css'
import type { FlashCard } from '@/types'
import { VocabLibraryManager } from '@/lib/vocab-library'
import { storageService } from '@/lib/storage'

class PopupManager {
  // UI Elements
  private totalCardsSpan: HTMLElement
  private cardsList: HTMLElement
  private prevPageBtn: HTMLButtonElement
  private nextPageBtn: HTMLButtonElement
  private pageInfo: HTMLElement
  private notification: HTMLElement
  private settingsButton: HTMLButtonElement
  private customSubtitleButton: HTMLButtonElement
  private vocabLibraryManager: VocabLibraryManager

  // Tab System Elements
  private cardsTab: HTMLButtonElement
  private subtitleTab: HTMLButtonElement
  private cardsView: HTMLElement
  private subtitleView: HTMLElement
  private cardsStatsButton: HTMLButtonElement

  // Subtitle Style Elements
  private fontSizeSlider: HTMLInputElement
  private fontSizeValue: HTMLElement
  private verticalPositionSlider: HTMLInputElement
  private verticalPositionValue: HTMLElement
  private backgroundOpacitySlider: HTMLInputElement
  private backgroundOpacityValue: HTMLElement
  private timeOffsetSlider: HTMLInputElement
  private timeOffsetInput: HTMLInputElement
  private resetStylesButton: HTMLButtonElement
  private forceFullscreenCheckbox: HTMLInputElement

  // State
  private savedCards: FlashCard[] = []
  private currentPage = 1
  private readonly cardsPerPage = 10

  // Subtitle Style State
  private subtitleStyles = {
    fontSize: 16,
    verticalPosition: 60,
    backgroundOpacity: 50,
    timeOffset: 0.0,
  }

  private forceFullscreenMode = false

  constructor() {
    // Initialize existing elements
    this.totalCardsSpan = document.getElementById('total-cards')!
    this.cardsList = document.getElementById('cards-list')!
    this.prevPageBtn = document.getElementById('prev-page') as HTMLButtonElement
    this.nextPageBtn = document.getElementById('next-page') as HTMLButtonElement
    this.pageInfo = document.getElementById('page-info')!
    this.notification = document.getElementById('notification')!
    this.settingsButton = document.getElementById('settings-button') as HTMLButtonElement
    this.customSubtitleButton = document.getElementById(
      'custom-subtitle-button'
    ) as HTMLButtonElement

    // Initialize new Tab system elements
    this.cardsTab = document.getElementById('cards-tab') as HTMLButtonElement
    this.subtitleTab = document.getElementById('subtitle-tab') as HTMLButtonElement
    this.cardsView = document.getElementById('cards-view')!
    this.subtitleView = document.getElementById('subtitle-view')!
    this.cardsStatsButton = document.getElementById('cards-stats-button') as HTMLButtonElement

    // Initialize subtitle style elements
    this.fontSizeSlider = document.getElementById('font-size-slider') as HTMLInputElement
    this.fontSizeValue = document.getElementById('font-size-value')!
    this.verticalPositionSlider = document.getElementById(
      'vertical-position-slider'
    ) as HTMLInputElement
    this.verticalPositionValue = document.getElementById('vertical-position-value')!
    this.backgroundOpacitySlider = document.getElementById(
      'background-opacity-slider'
    ) as HTMLInputElement
    this.backgroundOpacityValue = document.getElementById('background-opacity-value')!
    this.timeOffsetSlider = document.getElementById('time-offset-slider') as HTMLInputElement
    this.timeOffsetInput = document.getElementById('time-offset-input') as HTMLInputElement
    this.resetStylesButton = document.getElementById('reset-subtitle-styles') as HTMLButtonElement
    this.forceFullscreenCheckbox = document.getElementById(
      'force-fullscreen-checkbox'
    ) as HTMLInputElement

    this.vocabLibraryManager = new VocabLibraryManager()
  }

  async init(): Promise<void> {
    await this.vocabLibraryManager.init()
    await this.loadCards()
    await this.loadSubtitleStyles()
    await this.loadForceFullscreenSetting()
    this.setupEventListeners()
    this.setupSubtitleStyleListeners()
  }

  private setupEventListeners(): void {
    // Existing pagination and action listeners
    this.prevPageBtn.addEventListener('click', () => this.changePage(-1))
    this.nextPageBtn.addEventListener('click', () => this.changePage(1))
    this.settingsButton.addEventListener('click', () => this.openOptions())
    this.customSubtitleButton.addEventListener('click', () => this.initiateVideoSelection())

    // New Tab system listeners
    this.cardsTab.addEventListener('click', () => this.switchTab('cards'))
    this.subtitleTab.addEventListener('click', () => this.switchTab('subtitle'))

    // New cards stats button listener
    this.cardsStatsButton.addEventListener('click', () => this.openLearnedWordsFromStats())
  }

  private async loadCards(): Promise<void> {
    try {
      this.savedCards = await storageService.getAllCards()

      this.updateStats()
      this.renderCards()
      this.updatePagination()
    } catch (error) {
      console.error('加载卡片失败:', error)
      this.showNotification('加载卡片失败', 'error')
    }
  }

  private updateStats(): void {
    this.totalCardsSpan.textContent = this.savedCards.length.toString()
  }

  private renderCards(): void {
    if (this.savedCards.length === 0) {
      this.cardsList.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <div class="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p class="text-lg font-medium mb-2">还没有保存任何卡片</p>
          <p class="text-sm">在 Netflix 上观看日语内容时</p>
          <p class="text-sm">按 <kbd class="px-2 py-1 bg-muted rounded text-xs font-mono">S</kbd> 键保存高亮词汇</p>
        </div>
      `
      return
    }

    const startIndex = (this.currentPage - 1) * this.cardsPerPage
    const endIndex = startIndex + this.cardsPerPage
    const pageCards = this.savedCards.slice(startIndex, endIndex)

    this.cardsList.innerHTML = pageCards
      .map(
        card => `
      <div class="card border rounded-lg p-4 mb-3 bg-card hover:bg-accent/50 transition-colors group cursor-pointer" data-id="${card.id}">
        <div class="flex justify-between items-start gap-3">
          <div class="flex-1 min-w-0 card-content" data-card-word="${this.escapeHtml(card.word)}">
            <div class="flex items-center gap-3 mb-2">
              <div class="font-bold text-lg text-primary">${this.escapeHtml(card.word)}</div>
              ${card.level ? `<div class="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">${card.level}</div>` : ''}
            </div>
            
            ${
              card.reading && card.reading !== card.word
                ? `<div class="text-sm text-muted-foreground mb-1">读音: ${this.escapeHtml(card.reading)}</div>`
                : ''
            }
            
            ${
              card.definition
                ? `<div class="text-sm text-foreground mb-2">${this.escapeHtml(card.definition)}</div>`
                : ''
            }
            
            <div class="text-xs text-muted-foreground mb-2 flex items-center gap-2">
              <span>${this.escapeHtml(card.sourceTitle)}</span>
              <span>•</span>
              <span>${this.formatTimestamp(card.timestamp)}</span>
              <span>•</span>
              <span>${new Date(card.createdAt).toLocaleDateString()}</span>
            </div>
            
            <div class="text-sm text-foreground/80 leading-relaxed break-words border-l-2 border-muted pl-3">${card.sentence}</div>
          </div>
          <button 
            class="delete-card-btn opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-destructive/10 text-destructive h-8 w-8" 
            data-card-id="${card.id}"
            title="删除卡片"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    `
      )
      .join('')

    // 为所有删除按钮添加事件监听器
    this.cardsList.querySelectorAll('.delete-card-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation()
        const cardId = parseInt((e.currentTarget as HTMLElement).dataset.cardId!)
        await this.deleteCard(cardId)
      })
    })

    // 为卡片内容添加点击事件监听器（跳转到已学词汇页面）
    this.cardsList.querySelectorAll('.card-content').forEach(content => {
      content.addEventListener('click', e => {
        e.stopPropagation()
        const word = (e.currentTarget as HTMLElement).dataset.cardWord!
        this.openLearnedWordsWithHighlight(word)
      })
    })
  }

  private updatePagination(): void {
    const totalPages = Math.ceil(this.savedCards.length / this.cardsPerPage)

    this.prevPageBtn.disabled = this.currentPage <= 1
    this.nextPageBtn.disabled = this.currentPage >= totalPages

    if (this.savedCards.length === 0) {
      this.pageInfo.textContent = ''
      this.prevPageBtn.style.display = 'none'
      this.nextPageBtn.style.display = 'none'
    } else {
      this.pageInfo.textContent = `第 ${this.currentPage} / ${totalPages} 页`
      this.prevPageBtn.style.display = 'inline-flex'
      this.nextPageBtn.style.display = 'inline-flex'
    }
  }

  private changePage(direction: number): void {
    const totalPages = Math.ceil(this.savedCards.length / this.cardsPerPage)
    const newPage = this.currentPage + direction

    if (newPage >= 1 && newPage <= totalPages) {
      this.currentPage = newPage
      this.renderCards()
      this.updatePagination()
    }
  }

  async deleteCard(cardId: number): Promise<void> {
    if (confirm('确定要删除这张卡片吗？')) {
      try {
        await storageService.deleteCard(cardId)
        this.savedCards = this.savedCards.filter(card => card.id !== cardId)

        // 更新学习进度（从记忆卡片推导）
        await this.vocabLibraryManager.updateProgressFromCards()

        const totalPages = Math.ceil(this.savedCards.length / this.cardsPerPage)
        if (this.currentPage > totalPages && totalPages > 0) {
          this.currentPage = totalPages
        }

        this.updateStats()
        this.renderCards()
        this.updatePagination()

        this.showNotification('卡片已删除', 'success')
      } catch (error) {
        console.error('删除卡片失败:', error)
        this.showNotification('删除失败', 'error')
      }
    }
  }

  private openOptions(): void {
    chrome.runtime.openOptionsPage()
  }

  /**
   * Switch between tabs
   */
  private switchTab(tab: 'cards' | 'subtitle'): void {
    // Update tab button styles
    if (tab === 'cards') {
      this.cardsTab.className =
        'tab-button active inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors bg-background text-foreground shadow-sm'
      this.subtitleTab.className =
        'tab-button inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent/50 text-muted-foreground'

      // Show/hide views
      this.cardsView.classList.remove('hidden')
      this.subtitleView.classList.add('hidden')
    } else {
      this.subtitleTab.className =
        'tab-button active inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors bg-background text-foreground shadow-sm'
      this.cardsTab.className =
        'tab-button inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent/50 text-muted-foreground'

      // Show/hide views
      this.subtitleView.classList.remove('hidden')
      this.cardsView.classList.add('hidden')
    }
  }

  /**
   * Open learned words from stats button (replaces old learnedWordsButton)
   */
  private openLearnedWordsFromStats(): void {
    // 在新标签页中打开已学词汇页面
    chrome.tabs.create({
      url: chrome.runtime.getURL('options/options.html') + '?view=learned-words',
    })
  }

  /**
   * Open learned words with specific word highlighted
   */
  private openLearnedWordsWithHighlight(word: string): void {
    // 在新标签页中打开已学词汇页面并高亮显示特定词汇
    chrome.tabs.create({
      url:
        chrome.runtime.getURL('options/options.html') +
        `?view=learned-words&highlight=${encodeURIComponent(word)}`,
    })
  }

  private async initiateVideoSelection(): Promise<void> {
    try {
      // 发送消息到background script，然后转发给content script
      const response = await chrome.runtime.sendMessage({
        type: 'INITIATE_VIDEO_SELECTION',
      })

      if (response?.success) {
        this.showNotification('正在启动视频选择...', 'info')
        // 关闭popup，让用户专注于页面上的操作
        window.close()
      } else {
        this.showNotification('启动失败：' + (response?.error || '未知错误'), 'error')
      }
    } catch (error) {
      console.error('Failed to initiate video selection:', error)
      this.showNotification('启动失败：请确保在视频页面上使用', 'error')
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  private formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  private showNotification(
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'success'
  ): void {
    let bgColor: string
    switch (type) {
      case 'error':
        bgColor = 'bg-destructive text-destructive-foreground'
        break
      case 'warning':
        bgColor = 'bg-yellow-500 text-white'
        break
      case 'info':
        bgColor = 'bg-blue-500 text-white'
        break
      default:
        bgColor = 'bg-green-500 text-white'
    }

    this.notification.textContent = message
    this.notification.className = `fixed top-4 right-4 px-4 py-2 rounded-md text-sm font-medium z-50 transition-all duration-300 ${bgColor} opacity-100 translate-x-0`

    setTimeout(() => {
      this.notification.className = `fixed top-4 right-4 px-4 py-2 rounded-md text-sm font-medium z-50 transition-all duration-300 ${bgColor} opacity-0 translate-x-full`
    }, 3000)
  }

  /**
   * Load subtitle styles from storage
   */
  private async loadSubtitleStyles(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['subtitleStyles'])
      if (result.subtitleStyles) {
        this.subtitleStyles = { ...this.subtitleStyles, ...result.subtitleStyles }
      }
      this.updateStyleUI()
    } catch (error) {
      console.error('Failed to load subtitle styles:', error)
    }
  }

  /**
   * Save subtitle styles to storage
   */
  private async saveSubtitleStyles(): Promise<void> {
    try {
      await chrome.storage.local.set({ subtitleStyles: this.subtitleStyles })
    } catch (error) {
      console.error('Failed to save subtitle styles:', error)
    }
  }

  /**
   * Setup subtitle style event listeners
   */
  private setupSubtitleStyleListeners(): void {
    // Font size slider
    this.fontSizeSlider.addEventListener('input', () => {
      this.subtitleStyles.fontSize = parseInt(this.fontSizeSlider.value)
      this.updateStyleUI()
      this.saveSubtitleStyles()
      this.applySubtitleStyles()
    })

    // Vertical position slider
    this.verticalPositionSlider.addEventListener('input', () => {
      this.subtitleStyles.verticalPosition = parseInt(this.verticalPositionSlider.value)
      this.updateStyleUI()
      this.saveSubtitleStyles()
      this.applySubtitleStyles()
    })

    // Background opacity slider
    this.backgroundOpacitySlider.addEventListener('input', () => {
      this.subtitleStyles.backgroundOpacity = parseInt(this.backgroundOpacitySlider.value)
      this.updateStyleUI()
      this.saveSubtitleStyles()
      this.applySubtitleStyles()
    })

    // Time offset slider
    this.timeOffsetSlider.addEventListener('input', () => {
      this.subtitleStyles.timeOffset = parseFloat(this.timeOffsetSlider.value)
      this.updateStyleUI()
      this.saveSubtitleStyles()
      this.applySubtitleStyles()
    })

    // Time offset input
    this.timeOffsetInput.addEventListener('input', () => {
      const value = parseFloat(this.timeOffsetInput.value) || 0
      this.subtitleStyles.timeOffset = value

      // Update slider if value is within range
      if (value >= -15 && value <= 15) {
        this.timeOffsetSlider.value = value.toString()
      } else if (value < -15) {
        this.timeOffsetSlider.value = '-15'
      } else {
        this.timeOffsetSlider.value = '15'
      }

      this.saveSubtitleStyles()
      this.applySubtitleStyles()
    })

    // Reset button
    this.resetStylesButton.addEventListener('click', () => {
      this.resetSubtitleStyles()
    })

    // Force fullscreen checkbox
    this.forceFullscreenCheckbox.addEventListener('change', () => {
      this.handleForceFullscreenChange()
    })
  }

  /**
   * Update style UI elements with current values
   */
  private updateStyleUI(): void {
    this.fontSizeSlider.value = this.subtitleStyles.fontSize.toString()
    this.fontSizeValue.textContent = `${this.subtitleStyles.fontSize}px`

    this.verticalPositionSlider.value = this.subtitleStyles.verticalPosition.toString()
    this.verticalPositionValue.textContent = `${this.subtitleStyles.verticalPosition}px`

    this.backgroundOpacitySlider.value = this.subtitleStyles.backgroundOpacity.toString()
    this.backgroundOpacityValue.textContent = `${this.subtitleStyles.backgroundOpacity}%`

    this.timeOffsetSlider.value = this.subtitleStyles.timeOffset.toString()
    this.timeOffsetInput.value = this.subtitleStyles.timeOffset.toFixed(1)
  }

  /**
   * Apply subtitle styles to the active custom subtitle
   */
  private async applySubtitleStyles(): Promise<void> {
    try {
      // Get the currently active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })

      if (activeTab?.id && activeTab.url && !activeTab.url.startsWith('chrome://')) {
        try {
          await chrome.tabs.sendMessage(activeTab.id, {
            type: 'UPDATE_SUBTITLE_STYLES',
            styles: this.subtitleStyles,
          })

          console.log('Subtitle styles sent to active tab:', this.subtitleStyles)
        } catch (error) {
          // Content script might not be available in this tab
          console.log('Content script not available for style update:', error)
        }
      }
    } catch (error) {
      console.log('Failed to apply subtitle styles:', error)
    }
  }

  /**
   * Reset subtitle styles to default values
   */
  private async resetSubtitleStyles(): Promise<void> {
    this.subtitleStyles = {
      fontSize: 16,
      verticalPosition: 60,
      backgroundOpacity: 50,
      timeOffset: 0.0,
    }
    this.updateStyleUI()
    await this.saveSubtitleStyles()
    this.applySubtitleStyles()
    this.showNotification('字幕样式已重置', 'success')
  }

  /**
   * 加载全屏模式设置
   */
  private async loadForceFullscreenSetting(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['forceFullscreenMode'])
      this.forceFullscreenMode = result.forceFullscreenMode || false
      this.forceFullscreenCheckbox.checked = this.forceFullscreenMode
    } catch (error) {
      console.error('Failed to load force fullscreen setting:', error)
    }
  }

  /**
   * 保存全屏模式设置
   */
  private async saveForceFullscreenSetting(): Promise<void> {
    try {
      await chrome.storage.sync.set({ forceFullscreenMode: this.forceFullscreenMode })
    } catch (error) {
      console.error('Failed to save force fullscreen setting:', error)
    }
  }

  /**
   * 处理全屏模式切换
   */
  private async handleForceFullscreenChange(): Promise<void> {
    this.forceFullscreenMode = this.forceFullscreenCheckbox.checked
    await this.saveForceFullscreenSetting()

    // 通知content script更新设置
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab.id) {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'setForceFullscreenMode',
          enabled: this.forceFullscreenMode,
        })
      }
    } catch (error) {
      console.error('Failed to send force fullscreen setting to content script:', error)
    }

    this.showNotification(
      this.forceFullscreenMode ? '已启用全屏字幕模式' : '已禁用全屏字幕模式',
      'success'
    )
  }
}

// 删除全局声明，不再需要

document.addEventListener('DOMContentLoaded', async () => {
  // Send activation message to background script to enable on the current tab.
  chrome.runtime.sendMessage({ type: 'ACTIVATE_ON_CURRENT_TAB' }).catch(err => {
    console.error('Error sending activation message:', err)
  })

  // 创建新的NavBar + Tab架构UI
  const container = document.querySelector('.container')!
  container.innerHTML = `
    <div class="space-y-3">
      <!-- Global Header -->
      <header class="text-center py-2">
        <h1 class="text-lg font-bold text-foreground">Immersive Memorize</h1>
      </header>
      
      <!-- NavBar with Tabs -->
      <nav class="flex items-center justify-between pb-3 border-b">
        <!-- Tab Navigation -->
        <div class="flex bg-muted rounded-lg p-1">
          <button id="cards-tab" class="tab-button active inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors bg-background text-foreground shadow-sm">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            记忆卡片
          </button>
          <button id="subtitle-tab" class="tab-button inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent/50 text-muted-foreground">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            字幕设置
          </button>
        </div>
        
        <!-- Settings Button -->
        <button id="settings-button" class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9" title="设置">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </nav>
      
      <!-- Tab Content Areas -->
      <div id="tab-content" class="min-h-[400px]">
        <!-- Cards View -->
        <div id="cards-view" class="tab-view space-y-4">
          <!-- Cards Stats Header -->
          <div class="text-center">
            <button id="cards-stats-button" class="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors cursor-pointer" title="查看详细统计">
              <span id="total-cards">0</span> 张记忆卡片
              <svg class="h-3 w-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          <!-- Cards List -->
          <div class="max-h-80 overflow-y-auto">
            <div id="cards-list"></div>
          </div>
          
          <!-- Pagination -->
          <div class="flex items-center justify-center gap-4 pt-4 border-t">
            <button id="prev-page" class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8" disabled>
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span id="page-info" class="text-sm text-muted-foreground min-w-[80px] text-center"></span>
            <button id="next-page" class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8" disabled>
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        
        <!-- Subtitle View -->
        <div id="subtitle-view" class="tab-view space-y-4 hidden">
          <!-- Custom Subtitle Loading -->
          <div class="space-y-4">
            <div class="border rounded-lg p-4">
              <h3 class="font-medium mb-3">自定义字幕</h3>
              <button id="custom-subtitle-button" class="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 w-full">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                加载自定义字幕
              </button>
            </div>
            
            <!-- Subtitle Style Settings -->
            <div id="subtitle-style-settings" class="relative border rounded-lg p-4">
              <h3 class="font-medium mb-4">样式设置</h3>
              
              <div class="space-y-4">
                <!-- Font Size -->
                <div>
                  <label class="text-sm font-medium mb-2 block">字体大小</label>
                  <div class="flex items-center gap-3">
                    <span class="text-xs text-muted-foreground">12px</span>
                    <input type="range" id="font-size-slider" min="12" max="36" value="16" 
                           class="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer slider">
                    <span class="text-xs text-muted-foreground">36px</span>
                    <span id="font-size-value" class="text-sm font-medium w-10 text-center">16px</span>
                  </div>
                </div>
                
                <!-- Vertical Position -->
                <div>
                  <label class="text-sm font-medium mb-2 block">垂直位置</label>
                  <div class="flex items-center gap-3">
                    <span class="text-xs text-muted-foreground">上</span>
                    <input type="range" id="vertical-position-slider" min="20" max="200" value="60" 
                           class="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer slider">
                    <span class="text-xs text-muted-foreground">下</span>
                    <span id="vertical-position-value" class="text-sm font-medium w-12 text-center">60px</span>
                  </div>
                </div>
                
                <!-- Background Opacity -->
                <div>
                  <label class="text-sm font-medium mb-2 block">背景透明度</label>
                  <div class="flex items-center gap-3">
                    <span class="text-xs text-muted-foreground">透明</span>
                    <input type="range" id="background-opacity-slider" min="0" max="100" value="50" 
                           class="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer slider">
                    <span class="text-xs text-muted-foreground">不透明</span>
                    <span id="background-opacity-value" class="text-sm font-medium w-10 text-center">50%</span>
                  </div>
                </div>
                
                <!-- Time Offset -->
                <div>
                  <label class="text-sm font-medium mb-2 block">时间偏移</label>
                  <div class="flex items-center gap-3">
                    <span class="text-xs text-muted-foreground">-15s</span>
                    <input type="range" id="time-offset-slider" min="-15" max="15" step="0.1" value="0" 
                           class="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer slider">
                    <span class="text-xs text-muted-foreground">+15s</span>
                    <input type="number" id="time-offset-input" step="0.1" value="0.0"
                           class="text-sm font-medium w-16 text-center border rounded px-1">
                  </div>
                </div>
                
                <!-- Force Fullscreen Mode -->
                <div class="pt-2 border-t">
                  <label class="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" id="force-fullscreen-checkbox" class="rounded border-input text-primary focus:ring-ring focus:ring-offset-background">
                    <div class="flex items-center gap-1.5">
                      <span class="text-sm font-medium">强制全屏字幕定位</span>
                      <div class="relative group/tooltip">
                        <svg class="h-4 w-4 text-muted-foreground hover:text-foreground cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-900 rounded-md whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                          如果字幕位置不正确或无法显示，<br>可尝试启用此选项，字幕将显示在屏幕底部
                        </div>
                      </div>
                    </div>
                  </label>
                </div>
                
                <!-- Reset Button -->
                <div class="pt-2">
                  <button id="reset-subtitle-styles" class="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input hover:bg-accent hover:text-accent-foreground h-9 px-3 w-full">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    重置为默认值
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div id="notification" class="fixed top-4 right-4 px-4 py-2 rounded-md text-sm font-medium z-50 transition-all duration-300 opacity-0 translate-x-full"></div>
  `

  const popupManager = new PopupManager()
  await popupManager.init()
})
