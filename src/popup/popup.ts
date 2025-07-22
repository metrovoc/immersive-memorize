import '../globals.css'
import type { FlashCard, ExtensionSettings } from '@/types'

class PopupManager {
  private totalCardsSpan: HTMLElement
  private cardsList: HTMLElement
  private prevPageBtn: HTMLButtonElement
  private nextPageBtn: HTMLButtonElement
  private pageInfo: HTMLElement
  private notification: HTMLElement
  private settingsDropdown: HTMLElement
  private settingsToggle: HTMLButtonElement

  private savedCards: FlashCard[] = []
  private currentPage = 1
  private readonly cardsPerPage = 10
  private isSettingsOpen = false

  constructor() {
    this.totalCardsSpan = document.getElementById('total-cards')!
    this.cardsList = document.getElementById('cards-list')!
    this.prevPageBtn = document.getElementById('prev-page') as HTMLButtonElement
    this.nextPageBtn = document.getElementById('next-page') as HTMLButtonElement
    this.pageInfo = document.getElementById('page-info')!
    this.notification = document.getElementById('notification')!
    this.settingsDropdown = document.getElementById('settings-dropdown')!
    this.settingsToggle = document.getElementById('settings-toggle') as HTMLButtonElement
  }

  async init(): Promise<void> {
    await this.loadCards()
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    this.prevPageBtn.addEventListener('click', () => this.changePage(-1))
    this.nextPageBtn.addEventListener('click', () => this.changePage(1))
    this.settingsToggle.addEventListener('click', () => this.toggleSettingsDropdown())
    
    // 点击外部关闭设置菜单
    document.addEventListener('click', (e) => {
      if (!this.settingsToggle.contains(e.target as Node) && !this.settingsDropdown.contains(e.target as Node)) {
        this.closeSettingsDropdown()
      }
    })

    // 设置菜单项事件
    document.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement
      
      if (target.id === 'export-button') {
        await this.exportToAnki()
        this.closeSettingsDropdown()
      } else if (target.id === 'clear-all-button') {
        await this.clearAllCards()
        this.closeSettingsDropdown()
      } else if (target.id === 'open-options') {
        this.openOptions()
        this.closeSettingsDropdown()
      }
    })
  }

  private toggleSettingsDropdown(): void {
    this.isSettingsOpen = !this.isSettingsOpen
    if (this.isSettingsOpen) {
      this.settingsDropdown.classList.remove('hidden')
      this.settingsDropdown.classList.add('animate-in', 'fade-in-0', 'zoom-in-95')
    } else {
      this.closeSettingsDropdown()
    }
  }

  private closeSettingsDropdown(): void {
    this.isSettingsOpen = false
    this.settingsDropdown.classList.add('hidden')
    this.settingsDropdown.classList.remove('animate-in', 'fade-in-0', 'zoom-in-95')
  }

  private async loadCards(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['savedCards']) as Partial<ExtensionSettings>
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
            <span class="text-2xl">📚</span>
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

    this.cardsList.innerHTML = pageCards.map(card => `
      <div class="card border rounded-lg p-4 mb-3 bg-card hover:bg-accent/50 transition-colors group" data-id="${card.id}">
        <div class="flex justify-between items-start gap-3">
          <div class="flex-1 min-w-0">
            <div class="font-bold text-lg mb-1 text-primary">${this.escapeHtml(card.word)}</div>
            <div class="text-xs text-muted-foreground mb-2 flex items-center gap-2">
              <span>${this.escapeHtml(card.sourceTitle)}</span>
              <span>•</span>
              <span>${this.formatTimestamp(card.timestamp)}</span>
            </div>
            <div class="text-sm text-foreground leading-relaxed break-words">${this.escapeHtml(card.sentence)}</div>
          </div>
          <button 
            class="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-destructive/10 text-destructive h-8 w-8" 
            onclick="window.deleteCard(${card.id})"
            title="删除卡片"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    `).join('')
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

  private async exportToAnki(): Promise<void> {
    if (this.savedCards.length === 0) {
      this.showNotification('没有卡片可导出', 'error')
      return
    }

    try {
      const csvHeader = 'Word;Sentence;Screenshot;Timestamp;Source'
      const csvRows = this.savedCards.map(card => {
        const word = this.escapeCsvField(card.word)
        const sentence = this.escapeCsvField(card.sentence)
        const screenshot = card.screenshot ? `<img src="${card.screenshot}">` : ''
        const timestamp = this.formatTimestamp(card.timestamp)
        const source = this.escapeCsvField(card.sourceTitle)

        return `${word};${sentence};${screenshot};${timestamp};${source}`
      })

      const csvContent = [csvHeader, ...csvRows].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `immersive-memorize-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()

      URL.revokeObjectURL(url)
      this.showNotification(`已导出 ${this.savedCards.length} 张卡片`, 'success')
    } catch (error) {
      console.error('导出失败:', error)
      this.showNotification('导出失败', 'error')
    }
  }

  private async clearAllCards(): Promise<void> {
    if (confirm('确定要删除所有卡片吗？此操作不可撤销。')) {
      try {
        await chrome.storage.local.set({ savedCards: [] })
        this.savedCards = []
        this.currentPage = 1

        this.updateStats()
        this.renderCards()
        this.updatePagination()

        this.showNotification('所有卡片已清空', 'success')
      } catch (error) {
        console.error('清空失败:', error)
        this.showNotification('清空失败', 'error')
      }
    }
  }

  private openOptions(): void {
    chrome.runtime.openOptionsPage()
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  private escapeCsvField(field: string): string {
    if (typeof field !== 'string') return ''

    if (field.includes(';') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`
    }
    return field
  }

  private formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  private showNotification(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success'): void {
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

// 使 deleteCard 全局可用
declare global {
  interface Window {
    deleteCard: (cardId: number) => Promise<void>
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // 创建现代化UI
  const container = document.querySelector('.container')!
  container.innerHTML = `
    <div class="space-y-4">
      <header class="flex items-center justify-between pb-4 border-b">
        <div class="text-center flex-1">
          <h1 class="text-xl font-bold mb-1">Immersive Memorize</h1>
          <div class="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <span id="total-cards">0</span> 张卡片
          </div>
        </div>
        
        <div class="relative">
          <button id="settings-toggle" class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10" title="设置">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          
          <div id="settings-dropdown" class="hidden absolute right-0 top-12 w-48 bg-popover border rounded-md shadow-md z-10 py-1">
            <button id="export-button" class="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground">
              <svg class="h-4 w-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              导出 Anki CSV
            </button>
            <button id="clear-all-button" class="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground text-destructive">
              <svg class="h-4 w-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              清空所有卡片
            </button>
            <div class="border-t my-1"></div>
            <button id="open-options" class="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground">
              <svg class="h-4 w-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              词汇库设置
            </button>
          </div>
        </div>
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

  // 将 deleteCard 方法暴露给全局
  window.deleteCard = (cardId: number) => popupManager.deleteCard(cardId)
})