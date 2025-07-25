import '../globals.css'
import type { FlashCard, ExtensionSettings } from '@/types'
import { VocabLibraryManager } from '@/lib/vocab-library'

class PopupManager {
  private totalCardsSpan: HTMLElement
  private cardsList: HTMLElement
  private prevPageBtn: HTMLButtonElement
  private nextPageBtn: HTMLButtonElement
  private pageInfo: HTMLElement
  private notification: HTMLElement
  private settingsButton: HTMLButtonElement
  private learnedWordsButton: HTMLButtonElement
  private customSubtitleButton: HTMLButtonElement
  private vocabLibraryManager: VocabLibraryManager

  private savedCards: FlashCard[] = []
  private currentPage = 1
  private readonly cardsPerPage = 10

  constructor() {
    this.totalCardsSpan = document.getElementById('total-cards')!
    this.cardsList = document.getElementById('cards-list')!
    this.prevPageBtn = document.getElementById('prev-page') as HTMLButtonElement
    this.nextPageBtn = document.getElementById('next-page') as HTMLButtonElement
    this.pageInfo = document.getElementById('page-info')!
    this.notification = document.getElementById('notification')!
    this.settingsButton = document.getElementById('settings-button') as HTMLButtonElement
    this.learnedWordsButton = document.getElementById('learned-words-button') as HTMLButtonElement
    this.customSubtitleButton = document.getElementById(
      'custom-subtitle-button'
    ) as HTMLButtonElement
    this.vocabLibraryManager = new VocabLibraryManager()
  }

  async init(): Promise<void> {
    await this.vocabLibraryManager.init()
    await this.loadCards()
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    this.prevPageBtn.addEventListener('click', () => this.changePage(-1))
    this.nextPageBtn.addEventListener('click', () => this.changePage(1))
    this.settingsButton.addEventListener('click', () => this.openOptions())
    this.learnedWordsButton.addEventListener('click', () => this.openLearnedWords())
    this.customSubtitleButton.addEventListener('click', () => this.initiateVideoSelection())
  }

  private async loadCards(): Promise<void> {
    try {
      const result = (await chrome.storage.local.get(['savedCards'])) as Partial<ExtensionSettings>
      this.savedCards = result.savedCards || []

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
      <div class="card border rounded-lg p-4 mb-3 bg-card hover:bg-accent/50 transition-colors group" data-id="${card.id}">
        <div class="flex justify-between items-start gap-3">
          <div class="flex-1 min-w-0">
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
        this.savedCards = this.savedCards.filter(card => card.id !== cardId)
        await chrome.storage.local.set({ savedCards: this.savedCards })

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

  private openLearnedWords(): void {
    // 在新标签页中打开已学词汇页面
    chrome.tabs.create({
      url: chrome.runtime.getURL('options/options.html') + '?view=learned-words',
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
}

// 删除全局声明，不再需要

document.addEventListener('DOMContentLoaded', async () => {
  // 创建现代化UI
  const container = document.querySelector('.container')!
  container.innerHTML = `
    <div class="space-y-4">
      <header class="flex items-center justify-between pb-4 border-b">
        <div class="flex items-center gap-2">
          <button id="learned-words-button" class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10" title="已学词汇">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          
          <button id="custom-subtitle-button" class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10" title="关联本地字幕">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4V2C7 1.44772 7.44772 1 8 1H16C16.5523 1 17 1.44772 17 2V4H20C20.5523 4 21 4.44772 21 5C21 5.55228 20.5523 6 20 6H19V18C19 19.1046 18.1046 20 17 20H7C5.89543 20 5 19.1046 5 18V6H4C3.44772 6 3 5.55228 3 5C3 4.44772 3.44772 4 4 4H7ZM9 3V4H15V3H9ZM7 6V18H17V6H7Z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 8H15M9 12H15M9 16H12" />
            </svg>
          </button>
        </div>
        
        <div class="text-center flex-1">
          <h1 class="text-xl font-bold mb-1">Immersive Memorize</h1>
          <div class="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <span id="total-cards">0</span> 张记忆卡片
          </div>
        </div>
        
        <button id="settings-button" class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10" title="设置">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>
      
      <div class="max-h-80 overflow-y-auto">
        <div id="cards-list"></div>
      </div>
      
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
    
    <div id="notification" class="fixed top-4 right-4 px-4 py-2 rounded-md text-sm font-medium z-50 transition-all duration-300 opacity-0 translate-x-full"></div>
  `

  const popupManager = new PopupManager()
  await popupManager.init()
})
