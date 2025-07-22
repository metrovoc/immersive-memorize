import '../globals.css'
import type { FlashCard, ExtensionSettings } from '@/types'

class PopupManager {
  private totalCardsSpan: HTMLElement
  private exportButton: HTMLButtonElement
  private clearAllButton: HTMLButtonElement
  private openOptionsButton: HTMLButtonElement
  private cardsList: HTMLElement
  private prevPageBtn: HTMLButtonElement
  private nextPageBtn: HTMLButtonElement
  private pageInfo: HTMLElement
  private notification: HTMLElement

  private savedCards: FlashCard[] = []
  private currentPage = 1
  private readonly cardsPerPage = 10

  constructor() {
    this.totalCardsSpan = document.getElementById('total-cards')!
    this.exportButton = document.getElementById('export-button') as HTMLButtonElement
    this.clearAllButton = document.getElementById('clear-all-button') as HTMLButtonElement
    this.openOptionsButton = document.getElementById('open-options') as HTMLButtonElement
    this.cardsList = document.getElementById('cards-list')!
    this.prevPageBtn = document.getElementById('prev-page') as HTMLButtonElement
    this.nextPageBtn = document.getElementById('next-page') as HTMLButtonElement
    this.pageInfo = document.getElementById('page-info')!
    this.notification = document.getElementById('notification')!
  }

  async init(): Promise<void> {
    await this.loadCards()
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    this.exportButton.addEventListener('click', () => this.exportToAnki())
    this.clearAllButton.addEventListener('click', () => this.clearAllCards())
    this.openOptionsButton.addEventListener('click', () => this.openOptions())
    this.prevPageBtn.addEventListener('click', () => this.changePage(-1))
    this.nextPageBtn.addEventListener('click', () => this.changePage(1))
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
    this.exportButton.disabled = this.savedCards.length === 0
    this.clearAllButton.disabled = this.savedCards.length === 0
  }

  private renderCards(): void {
    if (this.savedCards.length === 0) {
      this.cardsList.innerHTML = `
        <div class="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <p class="text-lg mb-2">还没有保存任何卡片</p>
          <p class="text-sm">在 Netflix 上观看日语内容时，按 <kbd class="px-2 py-1 bg-muted rounded text-xs">S</kbd> 键保存高亮词汇</p>
        </div>
      `
      return
    }

    const startIndex = (this.currentPage - 1) * this.cardsPerPage
    const endIndex = startIndex + this.cardsPerPage
    const pageCards = this.savedCards.slice(startIndex, endIndex)

    this.cardsList.innerHTML = pageCards.map(card => `
      <div class="card border rounded-lg p-4 mb-3 bg-card hover:bg-accent/50 transition-colors" data-id="${card.id}">
        <div class="flex justify-between items-start gap-3">
          <div class="flex-1 min-w-0">
            <div class="font-bold text-lg mb-1 text-primary">${this.escapeHtml(card.word)}</div>
            <div class="text-sm text-muted-foreground mb-2">${this.escapeHtml(card.sourceTitle)}</div>
            <div class="text-sm text-foreground leading-relaxed break-words">${this.escapeHtml(card.sentence)}</div>
          </div>
          <button 
            class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 text-destructive hover:bg-destructive/10" 
            onclick="window.deleteCard(${card.id})"
          >
            删除
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
      this.pageInfo.textContent = '第 0 页，共 0 页'
    } else {
      this.pageInfo.textContent = `第 ${this.currentPage} 页，共 ${totalPages} 页`
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
      <header class="text-center border-b pb-4">
        <h1 class="text-2xl font-bold mb-2">Immersive Memorize</h1>
        <div class="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <span id="total-cards">0</span> 张卡片
        </div>
      </header>
      
      <div class="flex flex-wrap gap-2">
        <button id="export-button" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 flex-1">
          导出 Anki CSV
        </button>
        <button id="clear-all-button" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
          清空所有
        </button>
        <button id="open-options" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
          设置词汇表
        </button>
      </div>
      
      <div class="max-h-80 overflow-y-auto">
        <div id="cards-list"></div>
      </div>
      
      <div class="flex items-center justify-between pt-4 border-t">
        <button id="prev-page" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3" disabled>
          上一页
        </button>
        <span id="page-info" class="text-sm text-muted-foreground">第 1 页，共 1 页</span>
        <button id="next-page" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3" disabled>
          下一页
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