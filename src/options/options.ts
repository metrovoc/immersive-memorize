import '../globals.css'
import type { ExtensionSettings, VocabLibrary, LevelProgress } from '@/types'
import { VocabLibraryManager } from '@/lib/vocab-library'

class OptionsManager {
  private vocabLibraryManager: VocabLibraryManager
  private hotkeyInput: HTMLInputElement
  private debugCheckbox: HTMLInputElement
  private notification: HTMLElement
  private libraryCardsContainer: HTMLElement
  private levelManagementContainer: HTMLElement
  private selectedLibrary: VocabLibrary | null = null

  constructor() {
    this.vocabLibraryManager = new VocabLibraryManager()
    this.hotkeyInput = document.getElementById('hotkey-input') as HTMLInputElement
    this.debugCheckbox = document.getElementById('debug-checkbox') as HTMLInputElement
    this.notification = document.getElementById('notification')!
    this.libraryCardsContainer = document.getElementById('library-cards')!
    this.levelManagementContainer = document.getElementById('level-management')!
  }

  async init(): Promise<void> {
    await this.vocabLibraryManager.init()
    await this.loadSettings()
    this.setupEventListeners()
    this.renderLibraryCards()
    this.renderLevelManagement()
  }

  private setupEventListeners(): void {
    this.hotkeyInput.addEventListener('keydown', (e) => this.handleHotkeyInput(e))
    this.debugCheckbox.addEventListener('change', () => this.saveSettings())
  }

  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['captureHotkey', 'debugMode']) as Partial<ExtensionSettings>
      const hotkey = result.captureHotkey || 's'
      const debugMode = result.debugMode !== false

      this.hotkeyInput.value = hotkey.toUpperCase()
      this.debugCheckbox.checked = debugMode

      this.selectedLibrary = this.vocabLibraryManager.getSelectedLibrary() || null
    } catch (error) {
      console.error('加载设置失败:', error)
      this.showNotification('加载设置失败', 'error')
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      const hotkey = this.hotkeyInput.value.toLowerCase() || 's'
      const debugMode = this.debugCheckbox.checked

      await chrome.storage.local.set({
        captureHotkey: hotkey,
        debugMode: debugMode
      })

      this.showNotification(`设置已保存，快捷键: ${hotkey.toUpperCase()}`, 'success')
    } catch (error) {
      console.error('保存设置失败:', error)
      this.showNotification('保存失败', 'error')
    }
  }

  private renderLibraryCards(): void {
    const libraries = this.vocabLibraryManager.getLibraries()
    const selectedId = this.vocabLibraryManager.getSettings().selectedLibraryId

    this.libraryCardsContainer.innerHTML = libraries.map(library => `
      <div class="library-card ${library.id === selectedId ? 'selected' : ''}" data-library-id="${library.id}">
        <div class="flex items-center space-x-4">
          <div class="text-4xl">${library.icon}</div>
          <div class="flex-1">
            <h3 class="text-lg font-semibold">${library.name}</h3>
            <p class="text-sm text-muted-foreground">${library.description}</p>
            <div class="text-xs text-muted-foreground mt-1">
              ${library.totalWords} 个词汇 • ${library.levels.join(', ')}
            </div>
          </div>
          ${library.id === selectedId ? '<div class="text-primary">✓ 已选择</div>' : ''}
        </div>
      </div>
    `).join('')

    // 添加点击事件
    this.libraryCardsContainer.querySelectorAll('.library-card').forEach(card => {
      card.addEventListener('click', async (e) => {
        const libraryId = (e.currentTarget as HTMLElement).dataset.libraryId!
        await this.selectLibrary(libraryId)
      })
    })
  }

  private async selectLibrary(libraryId: string): Promise<void> {
    await this.vocabLibraryManager.selectLibrary(libraryId)
    this.selectedLibrary = this.vocabLibraryManager.getSelectedLibrary() || null
    this.renderLibraryCards()
    this.renderLevelManagement()
    this.showNotification(`已选择 ${this.selectedLibrary?.name}`, 'success')
  }

  private renderLevelManagement(): void {
    if (!this.selectedLibrary) {
      this.levelManagementContainer.innerHTML = '<div class="text-center text-muted-foreground py-8">请先选择一个词库</div>'
      return
    }

    const levelsProgress = this.vocabLibraryManager.getAllLevelsProgress()
    
    this.levelManagementContainer.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-semibold">等级管理</h3>
          <div class="text-sm text-muted-foreground">
            ${this.selectedLibrary.name}
          </div>
        </div>
        
        <div class="grid gap-4">
          ${levelsProgress.map(level => `
            <div class="level-card border rounded-lg p-4 ${level.enabled ? 'bg-card' : 'bg-muted/50'}">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <label class="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      ${level.enabled ? 'checked' : ''}
                      class="level-checkbox h-4 w-4 rounded border border-primary text-primary"
                      data-level="${level.level}"
                    >
                    <span class="font-medium text-lg">${level.level}</span>
                  </label>
                  <div class="text-sm text-muted-foreground">
                    ${level.totalWords} 个词汇
                  </div>
                </div>
                
                <div class="text-right">
                  <div class="text-sm font-medium">${level.learnedWords.length}/${level.totalWords}</div>
                  <div class="text-xs text-muted-foreground">${Math.round(level.progress)}% 完成</div>
                </div>
              </div>
              
              <div class="mt-3">
                <div class="w-full bg-muted rounded-full h-2">
                  <div 
                    class="bg-primary h-2 rounded-full transition-all duration-300" 
                    style="width: ${level.progress}%"
                  ></div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="text-center">
          <button id="save-level-settings" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
            保存等级设置
          </button>
        </div>
      </div>
    `

    // 添加事件监听器
    this.levelManagementContainer.querySelectorAll('.level-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
        const target = e.target as HTMLInputElement
        const level = target.dataset.level!
        const enabled = target.checked
        await this.vocabLibraryManager.toggleLevel(level, enabled)
        this.renderLevelManagement()
      })
    })

    const saveButton = document.getElementById('save-level-settings')
    if (saveButton) {
      saveButton.addEventListener('click', () => {
        this.showNotification('等级设置已保存', 'success')
      })
    }
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
        <p class="text-muted-foreground">配置您的词汇库，体验专注的顺序学习模式</p>
      </header>
      
      <main class="space-y-8">
        <!-- 词库选择 -->
        <section>
          <h2 class="text-2xl font-semibold mb-4 flex items-center space-x-2">
            <span>📚</span>
            <span>词汇库选择</span>
          </h2>
          <div id="library-cards" class="space-y-4"></div>
        </section>

        <!-- 等级管理 -->
        <section>
          <div id="level-management" class="min-h-[200px]"></div>
        </section>

        <!-- 其他设置 -->
        <section class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- 快捷键设置 -->
          <div class="rounded-lg border bg-card p-6">
            <h2 class="text-xl font-semibold mb-4 flex items-center space-x-2">
              <span>⚙️</span>
              <span>快捷键设置</span>
            </h2>
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
          
          <!-- 调试选项 -->
          <div class="rounded-lg border bg-card p-6">
            <h2 class="text-xl font-semibold mb-4 flex items-center space-x-2">
              <span>🔧</span>
              <span>调试选项</span>
            </h2>
            <div class="flex items-center space-x-2">
              <input type="checkbox" id="debug-checkbox" checked class="h-4 w-4 rounded border border-primary text-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
              <label for="debug-checkbox" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">启用调试模式（在控制台显示详细日志）</label>
            </div>
          </div>
        </section>

        <!-- 使用说明 -->
        <section class="rounded-lg border bg-card p-6">
          <h3 class="text-lg font-semibold mb-3 flex items-center space-x-2">
            <span>💡</span>
            <span>使用说明（顺序学习模式）</span>
          </h3>
          <ul class="space-y-2 text-sm text-muted-foreground">
            <li class="flex items-start space-x-2">
              <span class="inline-block w-1.5 h-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0"></span>
              <span>选择想要学习的词汇库和等级</span>
            </li>
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
          </ul>
        </section>
      </main>
    </div>
    
    <div id="notification" class="fixed top-4 right-4 px-4 py-2 rounded-md text-sm font-medium z-50 transition-all duration-300 opacity-0 translate-x-full"></div>
    
    <style>
      .library-card {
        @apply p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md bg-card;
      }
      
      .library-card.selected {
        @apply border-primary bg-primary/5 shadow-md;
      }
      
      .library-card:hover {
        @apply border-primary/50;
      }
      
      .level-card {
        transition: all 0.2s ease;
      }
      
      .level-card:hover {
        @apply shadow-md;
      }
    </style>
  `

  const optionsManager = new OptionsManager()
  await optionsManager.init()
})