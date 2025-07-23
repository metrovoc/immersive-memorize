import '../globals.css'
import type { ExtensionSettings, VocabLibrary, LevelProgress, ViewState, VocabEntry } from '@/types'
import { VocabLibraryManager } from '@/lib/vocab-library'

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
    if (view === 'learned-words') {
      this.viewState = {
        mode: 'learned-words',
        breadcrumb: ['设置', '已学词汇'],
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
      const result = (await chrome.storage.local.get([
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

      await chrome.storage.local.set({
        debugMode: debugMode,
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
      item.addEventListener('click', e => {
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

    // 设置当前值
    const result = chrome.storage.local.get(['captureHotkey', 'debugMode']).then(result => {
      const hotkey = result.captureHotkey || 's'
      const debugMode = result.debugMode !== false

      if (this.hotkeyInput) {
        this.hotkeyInput.value = hotkey.toUpperCase()
      }
      if (this.debugCheckbox) {
        this.debugCheckbox.checked = debugMode
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

    // 添加词汇库卡片点击事件
    document.getElementById('vocab-library-card')?.addEventListener('click', () => {
      this.viewState = {
        mode: 'library-detail',
        breadcrumb: ['设置', '词汇库管理'],
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
      card.addEventListener('click', async e => {
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
      checkbox.addEventListener('change', async e => {
        const target = e.target as HTMLInputElement
        const level = target.dataset.level!
        const enabled = target.checked
        await this.vocabLibraryManager.toggleLevel(level, enabled)
        this.renderLevelDetail() // 重新渲染以更新所有相关的复选框
      })
    })

    this.mainContent.querySelectorAll('.view-vocab-btn').forEach(btn => {
      btn.addEventListener('click', e => {
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
      const wordsByLevel: Record<string, any[]> = {}

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
                    .map(
                      item => `
                    <div class="vocab-card bg-card rounded-lg border p-4 hover:bg-accent/50 transition-colors group">
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
                    )
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
        btn.addEventListener('click', async (e) => {
          e.stopPropagation()
          const cardId = parseInt((e.currentTarget as HTMLElement).dataset.cardId!)
          await this.deleteLearnedCard(cardId)
        })
      })
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
      const result = await chrome.storage.local.get(['savedCards'])
      const savedCards = result.savedCards || []

      if (savedCards.length === 0) {
        this.showNotification('没有卡片可导出', 'error')
        return
      }

      const csvHeader = 'Word;Sentence;Screenshot;Timestamp;Source'
      const csvRows = savedCards.map((card: any) => {
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
      this.showNotification(`已导出 ${savedCards.length} 张卡片`, 'success')
    } catch (error) {
      console.error('导出失败:', error)
      this.showNotification('导出失败', 'error')
    }
  }

  private async clearAllCards(): Promise<void> {
    if (confirm('确定要删除所有卡片吗？此操作不可撤销。')) {
      try {
        await chrome.storage.local.set({ savedCards: [] })
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
        const result = await chrome.storage.local.get(['savedCards'])
        const savedCards = result.savedCards || []
        
        const updatedCards = savedCards.filter((card: any) => card.id !== cardId)
        await chrome.storage.local.set({ savedCards: updatedCards })
        
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
    </style>
  `

  const optionsManager = new OptionsManager()
  await optionsManager.init()
})
