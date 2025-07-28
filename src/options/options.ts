import '../globals.css'
import type {
  ExtensionSettings,
  VocabLibrary,
  ViewState,
  VocabEntry,
} from '@/types'
import { VocabLibraryManager } from '@/lib/vocab-library'
import { CSVFormatter } from '@/lib/csv-formatter'
import { storageService } from '@/lib/storage'

class OptionsManager {
  private vocabLibraryManager: VocabLibraryManager
  private hotkeyInput!: HTMLInputElement
  private debugCheckbox!: HTMLInputElement
  private notification!: HTMLElement
  private mainContent!: HTMLElement
  private breadcrumbContainer!: HTMLElement
  private selectedLibrary: VocabLibrary | null = null

  private viewState: ViewState = {
    mode: 'overview',
    breadcrumb: ['设置'],
  }

  constructor() {
    this.vocabLibraryManager = new VocabLibraryManager()
    // DOM元素将在init方法中获取
  }

  async init(): Promise<void> {
    // 首先获取容器元素
    this.notification = document.getElementById('notification')!
    this.mainContent = document.getElementById('main-content')!
    this.breadcrumbContainer = document.getElementById('breadcrumb')!

    // 检查URL参数
    const urlParams = new URLSearchParams(window.location.search)
    const view = urlParams.get('view')
    const highlight = urlParams.get('highlight')
    if (view === 'learned-words') {
      this.viewState = {
        mode: 'learned-words',
        breadcrumb: ['设置', '已学词汇'],
        highlight: highlight || undefined, // 添加highlight参数支持
      }
    }

    // 然后初始化
    await this.vocabLibraryManager.init()
    // 确保从记忆卡片更新学习进度
    await this.vocabLibraryManager.updateProgressFromCards()
    await this.loadSettings()
    this.setupEventListeners()
    await this.renderView()
  }

  private setupEventListeners(): void {
    // 大部分DOM事件监听器现在在各个render方法中设置
    // 这里只处理全局的、不依赖于特定DOM元素的监听器
  }

  private async loadSettings(): Promise<void> {
    try {
      const _result = (await chrome.storage.local.get([
        'captureHotkey',
        'debugMode',
      ])) as Partial<ExtensionSettings>

      // 设置只加载到内存中，DOM操作在render方法中处理
      this.selectedLibrary = this.vocabLibraryManager.getSelectedLibrary() || null
    } catch (error) {
      console.error('加载设置失败:', error)
      if (this.notification) {
        this.showNotification('加载设置失败', 'error')
      }
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      const debugMode = this.debugCheckbox?.checked || false
      const enableScreenshot =
        (document.getElementById('screenshot-checkbox') as HTMLInputElement)?.checked || false
      const csvFormatSelect = document.getElementById('csv-format-select') as HTMLSelectElement
      const csvExportFormat = csvFormatSelect?.value || 'anki-html'

      await chrome.storage.local.set({
        debugMode: debugMode,
        enableScreenshot: enableScreenshot,
        csvExportFormat: csvExportFormat,
      })

      if (this.notification) {
        this.showNotification('设置已保存', 'success')
      }
    } catch (error) {
      console.error('保存设置失败:', error)
      if (this.notification) {
        this.showNotification('保存失败', 'error')
      }
    }
  }

  private initializeTooltip(): void {
    this.setupTooltip('.screenshot-info-tooltip', '.tooltip-content')
    this.setupTooltip('.csv-format-info-tooltip', '.csv-format-tooltip-content')
  }

  private setupTooltip(triggerSelector: string, contentSelector: string): void {
    const tooltipTrigger = document.querySelector(triggerSelector)
    const tooltipContent = document.querySelector(contentSelector)

    if (tooltipTrigger && tooltipContent) {
      let hoverTimeout: NodeJS.Timeout | null = null

      // 鼠标进入时显示提示
      tooltipTrigger.addEventListener('mouseenter', () => {
        if (hoverTimeout) {
          clearTimeout(hoverTimeout)
        }
        tooltipContent.classList.remove('opacity-0', 'invisible')
        tooltipContent.classList.add('opacity-100', 'visible')
      })

      // 鼠标离开时延迟隐藏提示
      tooltipTrigger.addEventListener('mouseleave', () => {
        hoverTimeout = setTimeout(() => {
          tooltipContent.classList.remove('opacity-100', 'visible')
          tooltipContent.classList.add('opacity-0', 'invisible')
        }, 150) // 150ms延迟，提供更好的用户体验
      })

      // 鼠标在提示内容上时保持显示
      tooltipContent.addEventListener('mouseenter', () => {
        if (hoverTimeout) {
          clearTimeout(hoverTimeout)
        }
      })

      tooltipContent.addEventListener('mouseleave', () => {
        tooltipContent.classList.remove('opacity-100', 'visible')
        tooltipContent.classList.add('opacity-0', 'invisible')
      })
    }
  }

  private async renderView(): Promise<void> {
    this.renderBreadcrumb()

    switch (this.viewState.mode) {
      case 'overview':
        this.renderOverview()
        break
      case 'library-detail':
        this.renderLibraryDetail()
        break
      case 'level-detail':
        this.renderLevelDetail()
        break
      case 'vocab-list':
        await this.renderVocabList()
        break
      case 'learned-words':
        await this.renderLearnedWords()
        break
      case 'activation-settings':
        await this.renderActivationSettings()
        break
    }
  }

  private renderBreadcrumb(): void {
    this.breadcrumbContainer.innerHTML = this.viewState.breadcrumb
      .map((item, index) => {
        const isLast = index === this.viewState.breadcrumb.length - 1
        return `
        <span class="${isLast ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground cursor-pointer'}" 
              data-breadcrumb-index="${index}">
          ${item}
        </span>
        ${!isLast ? '<svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>' : ''}
      `
      })
      .join('')

    // 添加面包屑导航点击事件
    this.breadcrumbContainer.querySelectorAll('[data-breadcrumb-index]').forEach(item => {
      item.addEventListener('click', (e: Event) => {
        const index = parseInt((e.target as HTMLElement).dataset.breadcrumbIndex!)
        this.navigateBack(index)
      })
    })
  }

  private navigateBack(targetIndex: number): void {
    if (targetIndex === 0) {
      this.viewState = { mode: 'overview', breadcrumb: ['设置'] }
    } else if (targetIndex === 1 && this.viewState.libraryId) {
      this.viewState = {
        mode: 'library-detail',
        libraryId: this.viewState.libraryId,
        breadcrumb: ['设置', '词汇库管理'],
      }
    }
    this.renderView()
  }

  private renderOverview(): void {
    this.mainContent.innerHTML = `
      <div class="space-y-8">
        <!-- 词汇库管理卡片 -->
        <div class="bg-card rounded-lg border p-6 cursor-pointer hover:shadow-md transition-shadow" id="vocab-library-card">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold mb-2">词汇库管理</h3>
              <p class="text-muted-foreground">选择和配置学习词汇库及等级设置</p>
              ${this.selectedLibrary ? `<p class="text-sm text-primary mt-1">当前: ${this.selectedLibrary.name}</p>` : ''}
            </div>
            <svg class="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        <!-- 插件启动行为卡片 -->
        <div class="bg-card rounded-lg border p-6 cursor-pointer hover:shadow-md transition-shadow" id="activation-behavior-card">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold mb-2">插件启动行为</h3>
              <p class="text-muted-foreground">配置插件在哪些网站自动启用或手动启用</p>
            </div>
            <svg class="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        <!-- 快捷键设置 -->
        <div class="bg-card rounded-lg border p-6">
          <h3 class="text-lg font-semibold mb-4">快捷键设置</h3>
          <div class="space-y-3">
            <div class="flex items-center space-x-3">
              <label for="hotkey-input" class="text-sm font-medium min-w-[80px]">捕获快捷键:</label>
              <input 
                type="text" 
                id="hotkey-input" 
                maxlength="1" 
                placeholder="S"
                readonly
                title="点击输入框，然后按下您想要的字母键"
                class="w-16 h-10 text-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono font-bold cursor-pointer"
              >
            </div>
            <p class="text-sm text-muted-foreground">点击输入框，然后按下任意字母键作为快捷键</p>
          </div>
        </div>

        <!-- 截图功能设置 -->
        <div class="bg-card rounded-lg border p-6">
          <h3 class="text-lg font-semibold mb-4">截图功能</h3>
          <div class="flex items-center space-x-2">
            <input type="checkbox" id="screenshot-checkbox" class="h-4 w-4 rounded border border-primary text-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
            <label for="screenshot-checkbox" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">启用学习卡片自动截图功能</label>
            <div class="screenshot-info-tooltip relative group">
              <svg class="w-4 h-4 text-muted-foreground hover:text-primary cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div class="tooltip-content absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded border shadow-lg w-64 opacity-0 invisible transition-all z-50">
                <div class="space-y-2">
                  <p>在Netflix学习时自动截取当前画面保存到学习卡片中</p>
                  <div class="border-t border-border pt-2">
                    <p class="text-yellow-600 font-medium">⚠️ 兼容性提示：</p>
                    <p>如遇截图黑屏，可尝试在Chrome设置中关闭"硬件加速"功能来解决</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- CSV导出格式设置 -->
        <div class="bg-card rounded-lg border p-6">
          <h3 class="text-lg font-semibold mb-4">CSV导出设置</h3>
          <div class="space-y-3">
            <div class="flex items-center space-x-3">
              <label for="csv-format-select" class="text-sm font-medium min-w-[80px]">导出格式:</label>
              <select 
                id="csv-format-select"
                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="anki-html">Anki HTML格式（推荐）</option>
                <option value="plain-text">纯文本格式</option>
                <option value="rich-text">富文本格式（保留高亮）</option>
              </select>
              <div class="csv-format-info-tooltip relative group">
                <svg class="w-4 h-4 text-muted-foreground hover:text-primary cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <div class="csv-format-tooltip-content absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded border shadow-lg w-72 opacity-0 invisible transition-all z-50">
                  <div class="space-y-2">
                    <p><strong>Anki HTML:</strong> 转换Ruby为汉字[读音]格式，适合Anki导入</p>
                    <p><strong>纯文本:</strong> 移除所有HTML标签，纯文本内容</p>
                    <p><strong>富文本:</strong> 保留Ruby标签和高亮样式，适合支持HTML的系统</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 调试选项 -->
        <div class="bg-card rounded-lg border p-6">
          <h3 class="text-lg font-semibold mb-4">调试选项</h3>
          <div class="flex items-center space-x-2">
            <input type="checkbox" id="debug-checkbox" checked class="h-4 w-4 rounded border border-primary text-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
            <label for="debug-checkbox" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">启用调试模式（在控制台显示详细日志）</label>
          </div>
        </div>
      </div>
    `

    // 重新获取DOM元素并绑定事件监听器
    this.hotkeyInput = document.getElementById('hotkey-input') as HTMLInputElement
    this.debugCheckbox = document.getElementById('debug-checkbox') as HTMLInputElement
    const screenshotCheckbox = document.getElementById('screenshot-checkbox') as HTMLInputElement
    const csvFormatSelect = document.getElementById('csv-format-select') as HTMLSelectElement

    // 设置当前值
    chrome.storage.local
      .get(['captureHotkey', 'debugMode', 'enableScreenshot', 'csvExportFormat'])
      .then(result => {
        const hotkey = result.captureHotkey || 's'
        const debugMode = result.debugMode !== false
        const enableScreenshot = result.enableScreenshot || false // 默认关闭
        const csvFormat = result.csvExportFormat || 'anki-html' // 默认格式

        if (this.hotkeyInput) {
          this.hotkeyInput.value = hotkey.toUpperCase()
        }
        if (this.debugCheckbox) {
          this.debugCheckbox.checked = debugMode
        }
        if (screenshotCheckbox) {
          screenshotCheckbox.checked = enableScreenshot
        }
        if (csvFormatSelect) {
          csvFormatSelect.value = csvFormat
        }
      })

    // 绑定快捷键输入框的事件监听器
    if (this.hotkeyInput) {
      // 移除readonly属性当获得焦点时，添加回来当失去焦点时
      this.hotkeyInput.addEventListener('focus', () => {
        this.hotkeyInput.removeAttribute('readonly')
        this.hotkeyInput.placeholder = '按任意字母键...'
      })

      this.hotkeyInput.addEventListener('blur', () => {
        this.hotkeyInput.setAttribute('readonly', 'true')
        this.hotkeyInput.placeholder = 'S'
      })

      this.hotkeyInput.addEventListener('keydown', e => this.handleHotkeyInput(e))

      // 防止右键菜单和其他输入
      this.hotkeyInput.addEventListener('contextmenu', e => e.preventDefault())
      this.hotkeyInput.addEventListener('input', e => e.preventDefault())
    }

    // 绑定调试选项的事件监听器
    if (this.debugCheckbox) {
      this.debugCheckbox.addEventListener('change', () => this.saveSettings())
    }

    // 绑定截图开关的事件监听器
    if (screenshotCheckbox) {
      screenshotCheckbox.addEventListener('change', () => this.saveSettings())
    }

    // 绑定CSV格式选择的事件监听器
    if (csvFormatSelect) {
      csvFormatSelect.addEventListener('change', () => this.saveSettings())
    }

    // 实现信息icon的悬浮提示功能
    this.initializeTooltip()

    // 添加词汇库卡片点击事件
    document.getElementById('vocab-library-card')?.addEventListener('click', () => {
      this.viewState = {
        mode: 'library-detail',
        breadcrumb: ['设置', '词汇库管理'],
      }
      this.renderView()
    })

    // 添加插件启动行为卡片点击事件
    document.getElementById('activation-behavior-card')?.addEventListener('click', () => {
      this.viewState = {
        mode: 'activation-settings',
        breadcrumb: ['设置', '插件启动行为'],
      }
      this.renderView()
    })
  }

  private renderLibraryDetail(): void {
    const libraries = this.vocabLibraryManager.getLibraries()
    const selectedId = this.vocabLibraryManager.getSettings().selectedLibraryId

    this.mainContent.innerHTML = `
      <div class="space-y-6">
        <div class="text-center py-4">
          <h2 class="text-2xl font-bold mb-2">选择词汇库</h2>
          <p class="text-muted-foreground">选择要学习的词汇库，后续可配置具体等级</p>
        </div>

        <div class="grid gap-4">
          ${libraries
            .map(
              library => `
            <div class="library-card ${library.id === selectedId ? 'selected' : ''}" data-library-id="${library.id}">
              <div class="flex items-center justify-between p-6 bg-card rounded-lg border cursor-pointer hover:shadow-md transition-all">
                <div class="flex-1">
                  <h3 class="text-lg font-semibold mb-2">${library.name}</h3>
                  <p class="text-sm text-muted-foreground mb-2">${library.description}</p>
                  <div class="text-xs text-muted-foreground">
                    ${library.totalWords} 个词汇 • ${library.levels.join(', ')}
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  ${library.id === selectedId ? '<div class="text-primary font-medium">已选择</div>' : ''}
                  <svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `

    // 添加点击事件
    this.mainContent.querySelectorAll('.library-card').forEach(card => {
      card.addEventListener('click', async (e: Event) => {
        const libraryId = (e.currentTarget as HTMLElement).dataset.libraryId!
        await this.selectLibrary(libraryId)

        // 进入等级详情页面
        this.viewState = {
          mode: 'level-detail',
          libraryId: libraryId,
          breadcrumb: ['设置', '词汇库管理', this.selectedLibrary?.name || '词汇库'],
        }
        this.renderView()
      })
    })
  }

  private async selectLibrary(libraryId: string): Promise<void> {
    await this.vocabLibraryManager.selectLibrary(libraryId)
    this.selectedLibrary = this.vocabLibraryManager.getSelectedLibrary() || null
    this.showNotification(`已选择 ${this.selectedLibrary?.name}`, 'success')
  }

  private renderLevelDetail(): void {
    if (!this.selectedLibrary) return

    const levelsProgress = this.vocabLibraryManager.getAllLevelsProgress()

    this.mainContent.innerHTML = `
      <div class="space-y-6">
        <div class="text-center py-4">
          <h2 class="text-2xl font-bold mb-2">${this.selectedLibrary.name}</h2>
          <p class="text-muted-foreground">配置要学习的等级，点击等级可查看词汇详情</p>
        </div>

        <div class="grid gap-4">
          ${levelsProgress
            .map(
              level => `
            <div class="level-card ${level.enabled ? 'enabled' : 'disabled'}" data-level="${level.level}">
              <div class="bg-card rounded-lg border p-6 hover:shadow-md transition-shadow">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center space-x-4">
                    <span class="font-semibold text-xl">${level.level}</span>
                    <div class="text-sm text-muted-foreground">
                      ${level.totalWords} 个词汇
                    </div>
                  </div>
                  
                  <div class="flex items-center gap-4">
                    <div class="text-right">
                      <div class="text-sm font-medium">${Math.round((level.progress * level.totalWords) / 100)}/${level.totalWords}</div>
                      <div class="text-xs text-muted-foreground">${Math.round(level.progress)}% 完成</div>
                    </div>
                    <button class="view-vocab-btn p-2 rounded-md hover:bg-accent transition-colors" data-level="${level.level}">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div class="mb-3">
                  <div class="w-full bg-muted rounded-full h-2">
                    <div 
                      class="bg-primary h-2 rounded-full transition-all duration-300" 
                      style="width: ${level.progress}%"
                    ></div>
                  </div>
                </div>

                <div class="text-xs text-muted-foreground">
                  <label class="flex items-center">
                    <input type="checkbox" ${level.enabled ? 'checked' : ''} class="level-checkbox mr-2 h-3 w-3" data-level="${level.level}">
                    在学习时包含此等级的词汇
                  </label>
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `

    // 添加事件监听器
    this.mainContent.querySelectorAll('.level-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', async (e: Event) => {
        const target = e.target as HTMLInputElement
        const level = target.dataset.level!
        const enabled = target.checked
        await this.vocabLibraryManager.toggleLevel(level, enabled)
        this.renderLevelDetail() // 重新渲染以更新所有相关的复选框
      })
    })

    this.mainContent.querySelectorAll('.view-vocab-btn').forEach(btn => {
      btn.addEventListener('click', (e: Event) => {
        e.stopPropagation()
        const level = (e.currentTarget as HTMLElement).dataset.level!
        this.viewState = {
          mode: 'vocab-list',
          libraryId: this.selectedLibrary!.id,
          level: level,
          breadcrumb: ['设置', '词汇库管理', this.selectedLibrary!.name, level],
        }
        this.renderView()
      })
    })
  }

  private async renderVocabList(): Promise<void> {
    if (!this.selectedLibrary || !this.viewState.level) return

    const levelProgress = this.vocabLibraryManager.getLevelProgress(this.viewState.level)
    if (!levelProgress) return

    const vocabEntries = this.selectedLibrary.data.filter(
      entry => entry.Level === this.viewState.level
    )

    // 获取该等级的已学词汇
    const learnedCards = await this.vocabLibraryManager.getLearnedWordsByLevel(
      this.viewState.level!
    )
    const learnedWords = new Set(learnedCards.map(card => card.word))

    const learnedCount = learnedWords.size

    this.mainContent.innerHTML = `
      <div class="space-y-6">
        <div class="text-center py-4">
          <h2 class="text-2xl font-bold mb-2">${this.viewState.level} 词汇列表</h2>
          <p class="text-muted-foreground">共 ${vocabEntries.length} 个词汇，已学 ${learnedCount} 个</p>
          <div class="w-full bg-muted rounded-full h-2 mt-3 max-w-md mx-auto">
            <div 
              class="bg-primary h-2 rounded-full transition-all duration-300" 
              style="width: ${levelProgress.progress}%"
            ></div>
          </div>
        </div>

        <div class="grid gap-4">
          ${vocabEntries.map(vocab => this.renderVocabCard(vocab, learnedWords.has(vocab.VocabKanji))).join('')}
        </div>
      </div>
    `
  }

  private renderVocabCard(vocab: VocabEntry, isLearned: boolean): string {
    return `
      <div class="vocab-card bg-card rounded-lg border p-4 ${isLearned ? 'learned' : ''}">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <div class="text-xl font-bold text-primary">${this.escapeHtml(vocab.VocabKanji)}</div>
              ${isLearned ? '<div class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">已学会</div>' : ''}
            </div>
            
            ${
              vocab.VocabFurigana && vocab.VocabFurigana !== vocab.VocabKanji
                ? `<div class="text-sm text-muted-foreground mb-1">读音: ${this.escapeHtml(vocab.VocabFurigana)}</div>`
                : ''
            }
            
            <div class="text-sm mb-2">${this.escapeHtml(vocab.VocabDefCN || '暂无释义')}</div>
            
            <div class="flex items-center gap-4 text-xs text-muted-foreground">
              ${vocab.VocabPoS ? `<span>词性: ${this.escapeHtml(vocab.VocabPoS)}</span>` : ''}
              ${vocab.Frequency ? `<span>频率: ${this.escapeHtml(vocab.Frequency)}</span>` : ''}
              ${vocab.VocabPitch ? `<span>音调: ${this.escapeHtml(vocab.VocabPitch)}</span>` : ''}
            </div>
          </div>
        </div>
      </div>
    `
  }

  private async renderLearnedWords(): Promise<void> {
    try {
      // 获取所有已学词汇 (现在直接从记忆卡片获取)
      const allLearnedCards = await this.vocabLibraryManager.getAllLearnedWords()

      // 按等级分组
      const wordsByLevel: Record<string, { vocab: VocabEntry; card: { id: number; createdAt: string; sentence: string; sourceTitle: string; timestamp: number; }; learnedDate: string; }[]> = {}

      if (this.selectedLibrary) {
        for (const card of allLearnedCards) {
          const vocabEntry: VocabEntry | undefined = this.selectedLibrary.data.find(
            entry => entry.VocabKanji === card.word
          )

          // 使用卡片的等级信息，如果没有则从词库查找
          const level = card.level || vocabEntry?.Level

          if (level) {
            if (!wordsByLevel[level]) {
              wordsByLevel[level] = []
            }

            wordsByLevel[level].push({
              vocab: vocabEntry || {
                VocabKanji: card.word,
                VocabFurigana: card.reading || '',
                VocabDefCN: card.definition || '',
                Level: level,
                VocabPitch: '',
                VocabPoS: '',
                Frequency: ''
              },
              card: card,
              learnedDate: card.createdAt || '未知',
            })
          }
        }
      }

      const totalLearnedWords = allLearnedCards.length

      this.mainContent.innerHTML = `
        <div class="space-y-6">
          <div class="text-center py-4">
            <h2 class="text-2xl font-bold mb-2">已学词汇</h2>
            <p class="text-muted-foreground">你已经学会了 ${totalLearnedWords} 个词汇，继续加油！</p>
          </div>

          <!-- 统计信息 -->
          <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            ${Object.keys(wordsByLevel)
              .sort((a, b) => {
                const order = ['N5', 'N4', 'N3', 'N2', 'N1']
                return order.indexOf(a) - order.indexOf(b)
              })
              .map(
                level => `
              <div class="bg-card rounded-lg border p-4 text-center">
                <div class="text-2xl font-bold text-primary">${wordsByLevel[level].length}</div>
                <div class="text-sm text-muted-foreground">${level}</div>
              </div>
            `
              )
              .join('')}
          </div>

          <!-- 导出功能 -->
          <div class="flex justify-center gap-3 mb-6">
            <button id="export-learned-words" class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
              <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              导出 Anki CSV
            </button>
            <button id="clear-learned-words" class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground text-destructive h-10 px-4 py-2">
              <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              清空所有记忆卡片
            </button>
          </div>

          <!-- 按等级显示已学词汇 -->
          <div class="space-y-6">
            ${Object.keys(wordsByLevel)
              .sort((a, b) => {
                const order = ['N5', 'N4', 'N3', 'N2', 'N1']
                return order.indexOf(a) - order.indexOf(b)
              })
              .map(
                level => `
              <div class="bg-card rounded-lg border p-6">
                <h3 class="text-lg font-semibold mb-4">${level} 等级 (${wordsByLevel[level].length} 个词汇)</h3>
                <div class="grid gap-4">
                  ${wordsByLevel[level]
                    .map(item => {
                      const isHighlighted =
                        this.viewState.highlight &&
                        item.vocab.VocabKanji === this.viewState.highlight
                      const highlightClass = isHighlighted ? 'highlighted-vocab' : ''
                      const highlightAttr = isHighlighted ? 'data-highlighted="true"' : ''
                      return `
                    <div class="vocab-card bg-card rounded-lg border p-4 hover:bg-accent/50 transition-colors group ${highlightClass}" ${highlightAttr}>
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <div class="flex items-center gap-3 mb-2">
                            <div class="text-lg font-bold text-primary">${this.escapeHtml(item.vocab.VocabKanji)}</div>
                            <div class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">${level}</div>
                          </div>
                          
                          ${
                            item.vocab.VocabFurigana &&
                            item.vocab.VocabFurigana !== item.vocab.VocabKanji
                              ? `<div class="text-sm text-muted-foreground mb-1">读音: ${this.escapeHtml(item.vocab.VocabFurigana)}</div>`
                              : ''
                          }
                          
                          <div class="text-sm text-foreground mb-2">${this.escapeHtml(item.vocab.VocabDefCN || '暂无释义')}</div>
                          
                          <div class="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                            <span>学习时间: ${new Date(item.learnedDate).toLocaleDateString()}</span>
                            ${item.vocab.VocabPoS ? `<span>•</span><span>词性: ${this.escapeHtml(item.vocab.VocabPoS)}</span>` : ''}
                            ${item.vocab.Frequency ? `<span>•</span><span>频率: ${this.escapeHtml(item.vocab.Frequency)}</span>` : ''}
                          </div>
                          
                          ${
                            item.card && item.card.sentence
                              ? `
                            <div class="text-sm text-foreground/80 leading-relaxed break-words border-l-2 border-muted pl-3 mt-2">
                              ${item.card.sentence}
                            </div>
                            <div class="text-xs text-muted-foreground mt-1">
                              来源: ${this.escapeHtml(item.card.sourceTitle)} • ${this.formatTimestamp(item.card.timestamp)}
                            </div>
                          `
                              : ''
                          }
                        </div>
                        <button 
                          class="delete-learned-card-btn opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-destructive/10 text-destructive h-8 w-8" 
                          data-card-id="${item.card.id}"
                          title="删除卡片"
                        >
                          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  `
                    })
                    .join('')}
                </div>
              </div>
            `
              )
              .join('')}
          </div>

          ${
            totalLearnedWords === 0
              ? `
            <div class="text-center py-12 text-muted-foreground">
              <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p class="text-lg font-medium mb-2">还没有学会任何词汇</p>
              <p class="text-sm">在 Netflix 上观看日语内容时按快捷键开始学习吧！</p>
            </div>
          `
              : ''
          }
        </div>
      `

      // 添加事件监听器
      document
        .getElementById('export-learned-words')
        ?.addEventListener('click', () => this.exportToAnki())
      document
        .getElementById('clear-learned-words')
        ?.addEventListener('click', () => this.clearAllCards())

      // 为所有单个删除按钮添加事件监听器
      this.mainContent.querySelectorAll('.delete-learned-card-btn').forEach(btn => {
        btn.addEventListener('click', async (e: Event) => {
          e.stopPropagation()
          const cardId = parseInt((e.currentTarget as HTMLElement).dataset.cardId!)
          await this.deleteLearnedCard(cardId)
        })
      })

      // 如果有高亮词汇，滚动到该位置
      if (this.viewState.highlight) {
        this.scrollToHighlightedWord()
      }
    } catch (error) {
      console.error('渲染已学词汇失败:', error)
      this.mainContent.innerHTML = `
        <div class="text-center py-12 text-muted-foreground">
          <p class="text-lg font-medium mb-2">加载失败</p>
          <p class="text-sm">请刷新页面重试</p>
        </div>
      `
    }
  }

  private async exportToAnki(): Promise<void> {
    try {
      const [savedCards, csvExportSettings] = await Promise.all([
        storageService.getAllCards(),
        chrome.storage.local.get(['csvExportFormat'])
      ])
      const userFormat = csvExportSettings.csvExportFormat || 'anki-html' // 使用用户设置的格式

      if (savedCards.length === 0) {
        this.showNotification('没有卡片可导出', 'error')
        return
      }

      // 使用新的CSV格式化器
      const csvFormatter = new CSVFormatter()

      // 根据用户设置创建导出选项
      const exportOptions = CSVFormatter.createOptionsFromFormat(userFormat)

      const csvContent = csvFormatter.exportFlashCards(savedCards, exportOptions)

      // 生成包含格式的文件名
      const formatName =
        userFormat === 'plain-text' ? 'plain' : userFormat === 'rich-text' ? 'rich' : 'anki'
      const filename = `immersive-memorize-${formatName}-${new Date().toISOString().slice(0, 10)}.csv`

      // 使用CSV格式化器的下载功能
      csvFormatter.downloadCSV(csvContent, filename)

      this.showNotification(`已导出 ${savedCards.length} 张卡片 (${formatName}格式)`, 'success')
    } catch (error) {
      console.error('导出失败:', error)
      this.showNotification(`导出失败: ${(error as Error).message}`, 'error')
    }
  }

  private async clearAllCards(): Promise<void> {
    if (confirm('确定要删除所有卡片吗？此操作不可撤销。')) {
      try {
        await storageService.clearAllData()
        // 更新学习进度（从记忆卡片推导）
        await this.vocabLibraryManager.updateProgressFromCards()
        // 重新渲染已学词汇页面
        await this.renderLearnedWords()
        this.showNotification('所有卡片已清空', 'success')
      } catch (error) {
        console.error('清空失败:', error)
        this.showNotification('清空失败', 'error')
      }
    }
  }

  private async deleteLearnedCard(cardId: number): Promise<void> {
    if (confirm('确定要删除这张卡片吗？')) {
      try {
        await storageService.deleteCard(cardId)

        // 更新学习进度（从记忆卡片推导）
        await this.vocabLibraryManager.updateProgressFromCards()

        // 重新渲染已学词汇页面
        await this.renderLearnedWords()

        this.showNotification('卡片已删除', 'success')
      } catch (error) {
        console.error('删除卡片失败:', error)
        this.showNotification('删除失败', 'error')
      }
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text || ''
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

  private scrollToHighlightedWord(): void {
    // 使用setTimeout确保DOM已经渲染完成
    setTimeout(() => {
      const highlightedElement = document.querySelector('[data-highlighted="true"]')
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })

        // 2.5秒后自动移除高亮效果
        setTimeout(() => {
          this.clearHighlight()
        }, 2500)

        // 添加键盘监听，按ESC键清除高亮
        const handleKeyPress = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            this.clearHighlight()
            document.removeEventListener('keydown', handleKeyPress)
          }
        }
        document.addEventListener('keydown', handleKeyPress)

        // 点击高亮元素外的地方也清除高亮
        const handleClickOutside = (e: MouseEvent) => {
          if (!highlightedElement.contains(e.target as Node)) {
            this.clearHighlight()
            document.removeEventListener('click', handleClickOutside)
            document.removeEventListener('keydown', handleKeyPress)
          }
        }
        // 延迟添加点击监听，避免立即触发
        setTimeout(() => {
          document.addEventListener('click', handleClickOutside)
        }, 100)
      }
    }, 100)
  }

  private clearHighlight(): void {
    // 添加淡出动画
    const highlightedElements = document.querySelectorAll('.highlighted-vocab')
    highlightedElements.forEach(element => {
      element.classList.add('removing')
    })

    // 600ms后完全移除高亮样式（与CSS transition时间一致）
    setTimeout(() => {
      highlightedElements.forEach(element => {
        element.classList.remove('highlighted-vocab', 'removing')
        element.removeAttribute('data-highlighted')
      })
    }, 600)

    // 清除viewState中的highlight，避免重新渲染时再次高亮
    this.viewState.highlight = undefined

    // 更新URL，移除highlight参数
    const url = new URL(window.location.href)
    url.searchParams.delete('highlight')
    window.history.replaceState({}, '', url.toString())
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

  private handleHotkeyInput(e: KeyboardEvent): void {
    e.preventDefault()
    e.stopPropagation()

    // 只允许字母键
    if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
      const newHotkey = e.key.toUpperCase()
      this.hotkeyInput.value = newHotkey
      this.hotkeyInput.blur()

      // 立即保存设置
      chrome.storage.local
        .set({
          captureHotkey: newHotkey.toLowerCase(),
        })
        .then(() => {
          this.showNotification(`快捷键已设置为: ${newHotkey}`, 'success')
        })
        .catch(error => {
          console.error('保存快捷键失败:', error)
          this.showNotification('保存失败', 'error')
        })
    } else if (e.key === 'Escape') {
      this.hotkeyInput.blur()
    } else {
      // 给用户反馈不支持的按键
      this.showNotification('请按字母键 (A-Z)', 'warning')
    }
  }

  private async renderActivationSettings(): Promise<void> {
    // Load current settings
    const result = await chrome.storage.local.get(['activationSettings'])
    const activationSettings = result.activationSettings || {
      autoEnabledSites: ['*://*.netflix.com/*'],
      globalAutoEnable: false,
    }

    this.mainContent.innerHTML = `
      <div class="space-y-6">
        <div class="text-center py-4">
          <h2 class="text-2xl font-bold mb-2">插件启动行为</h2>
          <p class="text-muted-foreground">配置插件在哪些网站自动启用，或设置全局自动启用</p>
        </div>

        <!-- Global Auto Enable Switch -->
        <div class="bg-card rounded-lg border p-6">
          <h3 class="text-lg font-semibold mb-4">全局设置</h3>
          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium mb-1">在所有网站自动启用</div>
              <div class="text-sm text-muted-foreground">启用后，插件将在所有网站自动加载，无需手动点击</div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="global-auto-enable" ${activationSettings.globalAutoEnable ? 'checked' : ''} class="sr-only peer">
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        <!-- Auto-enabled Sites List -->
        <div class="bg-card rounded-lg border p-6" id="sites-section" ${activationSettings.globalAutoEnable ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold">自动启用的网站</h3>
            <button id="add-site-btn" class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3">
              <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              添加网站
            </button>
          </div>
          
          <p class="text-sm text-muted-foreground mb-4">
            插件将在以下网站自动启用。支持通配符，例如 *://*.example.com/* 匹配 example.com 的所有子域名
          </p>

          <div id="sites-list" class="space-y-3">
            ${activationSettings.autoEnabledSites
              .map(
                (site: string, index: number) => `
              <div class="site-item flex items-center gap-3 p-3 bg-muted rounded-lg" data-index="${index}">
                <input type="checkbox" checked class="site-enabled-checkbox h-4 w-4 rounded border border-primary text-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <input type="text" value="${this.escapeHtml(site)}" class="site-url-input flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <button class="delete-site-btn inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-destructive/10 text-destructive h-8 w-8">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            `
              )
              .join('')}
          </div>

          ${
            activationSettings.autoEnabledSites.length === 0
              ? `
            <div class="text-center py-8 text-muted-foreground">
              <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9l3 3 3-3" />
                </svg>
              </div>
              <p class="text-sm">暂无自动启用的网站</p>
              <p class="text-xs mt-1">点击"添加网站"按钮开始配置</p>
            </div>
          `
              : ''
          }
        </div>

        <!-- Usage Instructions -->
        <div class="bg-card rounded-lg border p-6">
          <h3 class="text-lg font-semibold mb-3">使用说明</h3>
          <div class="space-y-2 text-sm text-muted-foreground">
            <div class="flex items-start gap-2">
              <div class="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
              <div>
                <strong>自动启用：</strong>插件会在指定网站自动加载，图标显示为蓝色
              </div>
            </div>
            <div class="flex items-start gap-2">
              <div class="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
              <div>
                <strong>手动启用：</strong>在其他网站，图标显示为灰色，点击图标即可启用
              </div>
            </div>
            <div class="flex items-start gap-2">
              <div class="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
              <div>
                <strong>URL 模式：</strong>支持通配符 * 匹配任意字符，例如：
                <ul class="ml-4 mt-1 space-y-1">
                  <li>• <code class="bg-muted px-1 rounded">*://*.netflix.com/*</code> - 匹配 Netflix 所有页面</li>
                  <li>• <code class="bg-muted px-1 rounded">https://example.com/*</code> - 匹配 example.com 的所有 HTTPS 页面</li>
                  <li>• <code class="bg-muted px-1 rounded">*://video.*.com/*</code> - 匹配所有 video.xxx.com 域名</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    `

    this.setupActivationSettingsEvents()
  }

  private setupActivationSettingsEvents(): void {
    const globalAutoEnableCheckbox = document.getElementById(
      'global-auto-enable'
    ) as HTMLInputElement
    const sitesSection = document.getElementById('sites-section')!
    const addSiteBtn = document.getElementById('add-site-btn')!
    const sitesList = document.getElementById('sites-list')!

    // Global auto enable toggle
    globalAutoEnableCheckbox?.addEventListener('change', async () => {
      const enabled = globalAutoEnableCheckbox.checked

      // Update UI
      if (enabled) {
        sitesSection.style.opacity = '0.5'
        sitesSection.style.pointerEvents = 'none'
      } else {
        sitesSection.style.opacity = '1'
        sitesSection.style.pointerEvents = 'auto'
      }

      // Save settings
      await this.saveActivationSettings()
      this.showNotification(enabled ? '已启用全局自动启用' : '已禁用全局自动启用', 'success')
    })

    // Add site button
    addSiteBtn.addEventListener('click', () => {
      this.addNewSiteRow()
    })

    // Setup existing site controls
    this.setupSiteControls()
  }

  private addNewSiteRow(): void {
    const sitesList = document.getElementById('sites-list')!
    const newIndex = sitesList.children.length

    const newSiteRow = document.createElement('div')
    newSiteRow.className = 'site-item flex items-center gap-3 p-3 bg-muted rounded-lg'
    newSiteRow.dataset.index = newIndex.toString()
    newSiteRow.innerHTML = `
      <input type="checkbox" checked class="site-enabled-checkbox h-4 w-4 rounded border border-primary text-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <input type="text" placeholder="例如: *://*.example.com/*" class="site-url-input flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <button class="delete-site-btn inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-destructive/10 text-destructive h-8 w-8">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    `

    sitesList.appendChild(newSiteRow)

    // Focus on the new input
    const newInput = newSiteRow.querySelector('.site-url-input') as HTMLInputElement
    newInput.focus()

    // Setup controls for the new row
    this.setupSiteControls()
  }

  private setupSiteControls(): void {
    // Remove existing listeners to avoid duplicates
    document.querySelectorAll('.site-url-input').forEach(input => {
      input.removeEventListener('input', this.handleSiteInputChange)
      input.removeEventListener('blur', this.handleSiteInputBlur)
    })

    document.querySelectorAll('.site-enabled-checkbox').forEach(checkbox => {
      checkbox.removeEventListener('change', this.handleSiteEnabledChange)
    })

    document.querySelectorAll('.delete-site-btn').forEach(btn => {
      btn.removeEventListener('click', this.handleDeleteSite)
    })

    // Add new listeners
    document.querySelectorAll('.site-url-input').forEach(input => {
      input.addEventListener('input', this.handleSiteInputChange.bind(this))
      input.addEventListener('blur', this.handleSiteInputBlur.bind(this))
    })

    document.querySelectorAll('.site-enabled-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', this.handleSiteEnabledChange.bind(this))
    })

    document.querySelectorAll('.delete-site-btn').forEach(btn => {
      btn.addEventListener('click', this.handleDeleteSite.bind(this))
    })
  }

  private handleSiteInputChange = (_e: Event) => {
    // Real-time validation could be added here
  }

  private handleSiteInputBlur = async (_e: Event) => {
    await this.saveActivationSettings()
  }

  private handleSiteEnabledChange = async (_e: Event) => {
    await this.saveActivationSettings()
  }

  private handleDeleteSite = async (e: Event) => {
    const btn = e.target as HTMLElement
    const siteItem = btn.closest('.site-item') as HTMLElement

    if (confirm('确定要删除这个网站配置吗？')) {
      siteItem.remove()
      await this.saveActivationSettings()
      this.showNotification('网站配置已删除', 'success')
    }
  }

  private async saveActivationSettings(): Promise<void> {
    try {
      const globalAutoEnable =
        (document.getElementById('global-auto-enable') as HTMLInputElement)?.checked || false
      const autoEnabledSites: string[] = []

      document.querySelectorAll('.site-item').forEach(item => {
        const checkbox = item.querySelector('.site-enabled-checkbox') as HTMLInputElement
        const input = item.querySelector('.site-url-input') as HTMLInputElement

        if (checkbox?.checked && input?.value.trim()) {
          autoEnabledSites.push(input.value.trim())
        }
      })

      const activationSettings = {
        globalAutoEnable,
        autoEnabledSites,
      }

      await chrome.storage.local.set({ activationSettings })

      // Notify background script to update its configuration
      chrome.runtime
        .sendMessage({
          type: 'UPDATE_ACTIVATION_SETTINGS',
          settings: activationSettings,
        })
        .catch(err => {
          console.error('Failed to notify background script:', err)
        })
    } catch (error) {
      console.error('保存启动设置失败:', error)
      this.showNotification('保存失败', 'error')
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // 创建现代化UI结构
  const container = document.getElementById('options-root')!
  container.innerHTML = `
    <div class="min-h-screen bg-background">
      <header class="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div class="container max-w-6xl mx-auto px-6 py-4">
          <nav id="breadcrumb" class="flex items-center space-x-2 text-sm"></nav>
        </div>
      </header>
      
      <main class="container max-w-6xl mx-auto px-6 py-8">
        <div id="main-content"></div>
      </main>
    </div>
    
    <div id="notification" class="fixed top-4 right-4 px-4 py-2 rounded-md text-sm font-medium z-50 transition-all duration-300 opacity-0 translate-x-full"></div>
    
    <style>
      .library-card.selected {
        border-color: hsl(var(--primary));
        background: hsl(var(--primary) / 0.05);
      }
      
      .level-card.enabled {
        border-color: hsl(var(--primary) / 0.3);
      }
      
      .level-card.disabled {
        opacity: 0.6;
      }
      
      .vocab-card.learned {
        background: hsl(var(--muted) / 0.5);
      }
      
      .vocab-card {
        transition: all 0.2s ease;
      }
      
      .vocab-card:hover {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      }
      
      .highlighted-vocab {
        border: 1px solid hsl(var(--primary)) !important;
        background: hsl(var(--primary) / 0.1) !important;
        box-shadow: 0 0 15px hsl(var(--primary) / 0.2);
        animation: highlightGlow 3s ease-in-out;
        transition: border-color 0.6s ease-out, background-color 0.6s ease-out, box-shadow 0.6s ease-out;
      }
      
      .highlighted-vocab.removing {
        border: 1px solid hsl(var(--border)) !important;
        background: hsl(var(--card)) !important;
        box-shadow: none !important;
      }
      
      @keyframes highlightGlow {
        0%, 100% { box-shadow: 0 0 15px hsl(var(--primary) / 0.2); }
        50% { box-shadow: 0 0 20px hsl(var(--primary) / 0.3); }
      }
    </style>
  `

  const optionsManager = new OptionsManager()
  await optionsManager.init()
})
