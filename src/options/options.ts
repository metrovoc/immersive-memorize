import '../globals.css'
import type { ExtensionSettings } from '@/types'

class OptionsManager {
  private textarea: HTMLTextAreaElement
  private saveButton: HTMLButtonElement
  private clearButton: HTMLButtonElement
  private wordCountSpan: HTMLElement
  private hotkeyInput: HTMLInputElement
  private debugCheckbox: HTMLInputElement
  private notification: HTMLElement

  constructor() {
    this.textarea = document.getElementById('wordlist-textarea') as HTMLTextAreaElement
    this.saveButton = document.getElementById('save-button') as HTMLButtonElement
    this.clearButton = document.getElementById('clear-button') as HTMLButtonElement
    this.wordCountSpan = document.getElementById('word-count')!
    this.hotkeyInput = document.getElementById('hotkey-input') as HTMLInputElement
    this.debugCheckbox = document.getElementById('debug-checkbox') as HTMLInputElement
    this.notification = document.getElementById('notification')!
  }

  async init(): Promise<void> {
    await this.loadSettings()
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    this.textarea.addEventListener('input', () => this.updateWordCount())
    this.saveButton.addEventListener('click', () => this.saveSettings())
    this.clearButton.addEventListener('click', () => this.clearWordlist())
    this.hotkeyInput.addEventListener('keydown', (e) => this.handleHotkeyInput(e))
    this.debugCheckbox.addEventListener('change', () => this.saveSettings())
  }

  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['jlptWordlist', 'captureHotkey', 'debugMode']) as Partial<ExtensionSettings>
      const wordlist = result.jlptWordlist || []
      const hotkey = result.captureHotkey || 's'
      const debugMode = result.debugMode !== false

      this.textarea.value = wordlist.join('\n')
      this.hotkeyInput.value = hotkey.toUpperCase()
      this.debugCheckbox.checked = debugMode

      this.updateWordCount()
    } catch (error) {
      console.error('加载设置失败:', error)
      this.showNotification('加载设置失败', 'error')
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      const text = this.textarea.value.trim()
      const wordlist = text ? text.split('\n')
        .map(word => word.trim())
        .filter(word => word.length > 0) : []

      const hotkey = this.hotkeyInput.value.toLowerCase() || 's'
      const debugMode = this.debugCheckbox.checked

      await chrome.storage.local.set({
        jlptWordlist: wordlist,
        captureHotkey: hotkey,
        debugMode: debugMode
      })

      this.showNotification(`已保存 ${wordlist.length} 个词汇，快捷键: ${hotkey.toUpperCase()}`, 'success')
      this.updateWordCount()
    } catch (error) {
      console.error('保存设置失败:', error)
      this.showNotification('保存失败', 'error')
    }
  }

  private clearWordlist(): void {
    if (confirm('确定要清空词汇表吗？此操作不可撤销。')) {
      this.textarea.value = ''
      this.updateWordCount()
      this.showNotification('词汇表已清空', 'success')
    }
  }

  private updateWordCount(): void {
    const text = this.textarea.value.trim()
    const wordCount = text ? text.split('\n')
      .map(word => word.trim())
      .filter(word => word.length > 0).length : 0

    this.wordCountSpan.textContent = `${wordCount} 个词汇`
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

  private handleHotkeyInput(e: KeyboardEvent): void {
    e.preventDefault()

    // 只允许字母键
    if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
      this.hotkeyInput.value = e.key.toUpperCase()
      this.hotkeyInput.blur()
      this.saveSettings()
    } else if (e.key === 'Escape') {
      this.hotkeyInput.blur()
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // 创建现代化UI
  const container = document.getElementById('options-root')!
  container.innerHTML = `
    <div class="space-y-8">
      <header class="text-center border-b pb-6">
        <h1 class="text-3xl font-bold mb-2">Immersive Memorize 设置</h1>
        <p class="text-muted-foreground">配置您的 JLPT 词汇表，体验专注的顺序学习模式</p>
      </header>
      
      <main class="space-y-6">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 space-y-6">
            <div class="rounded-lg border bg-card p-6">
              <h2 class="text-xl font-semibold mb-4">JLPT 词汇表</h2>
              <div class="space-y-3">
                <textarea 
                  id="wordlist-textarea" 
                  class="min-h-[300px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                  placeholder="请输入词汇，每行一个单词&#10;例如:&#10;解析&#10;理解&#10;勉強&#10;学習"
                ></textarea>
                <div class="flex items-center justify-between text-sm text-muted-foreground">
                  <span id="word-count">0 个词汇</span>
                  <span>每行输入一个词汇</span>
                </div>
              </div>
            </div>
            
            <div class="rounded-lg border bg-card p-6">
              <h2 class="text-xl font-semibold mb-4">快捷键设置</h2>
              <div class="space-y-3">
                <div class="flex items-center space-x-3">
                  <label for="hotkey-input" class="text-sm font-medium">捕获快捷键:</label>
                  <input 
                    type="text" 
                    id="hotkey-input" 
                    maxlength="1" 
                    placeholder="S"
                    title="单击输入框，然后按下您想要的按键"
                    class="w-16 h-10 text-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono font-bold"
                  >
                </div>
                <p class="text-sm text-muted-foreground">点击输入框，然后按下任意字母键作为快捷键</p>
              </div>
            </div>
            
            <div class="rounded-lg border bg-card p-6">
              <h2 class="text-xl font-semibold mb-4">调试选项</h2>
              <div class="flex items-center space-x-2">
                <input type="checkbox" id="debug-checkbox" checked class="h-4 w-4 rounded border border-primary text-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                <label for="debug-checkbox" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">启用调试模式（在控制台显示详细日志）</label>
              </div>
            </div>
            
            <div class="flex gap-3">
              <button id="save-button" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 flex-1">
                保存设置
              </button>
              <button id="clear-button" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                清空列表
              </button>
            </div>
          </div>
          
          <div class="space-y-6">
            <div class="rounded-lg border bg-card p-6">
              <h3 class="text-lg font-semibold mb-3">使用说明（顺序学习模式）</h3>
              <ul class="space-y-2 text-sm text-muted-foreground">
                <li class="flex items-start space-x-2">
                  <span class="inline-block w-1.5 h-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0"></span>
                  <span>每次仅高亮显示一个生词，避免干扰和困惑</span>
                </li>
                <li class="flex items-start space-x-2">
                  <span class="inline-block w-1.5 h-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0"></span>
                  <span>直接按快捷键学习当前高亮的词汇</span>
                </li>
                <li class="flex items-start space-x-2">
                  <span class="inline-block w-1.5 h-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0"></span>
                  <span>学习后自动显示下一个生词，实现有序学习</span>
                </li>
                <li class="flex items-start space-x-2">
                  <span class="inline-block w-1.5 h-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0"></span>
                  <span>已学词汇不再显示，高效避免重复</span>
                </li>
                <li class="flex items-start space-x-2">
                  <span class="inline-block w-1.5 h-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0"></span>
                  <span>在扩展弹窗中查看和导出学习记录</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
    
    <div id="notification" class="fixed top-4 right-4 px-4 py-2 rounded-md text-sm font-medium z-50 transition-all duration-300 opacity-0 translate-x-full"></div>
  `

  const optionsManager = new OptionsManager()
  await optionsManager.init()
})