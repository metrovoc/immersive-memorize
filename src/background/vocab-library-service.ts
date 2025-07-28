/**
 * Background Service Worker 中的中央化词库服务
 * 单例模式，确保整个扩展只有一个词库实例
 */

import type {
  VocabLibrary,
  VocabEntry,
  LevelProgress,
  VocabLibrarySettings,
  FlashCard,
} from '@/types'

export interface VocabRequest {
  requestId: string
  type: 'getActiveWordlist' | 'getSelectedLibrary' | 'getSettings' | 'updateProgress'
  data?: any
}

export interface VocabResponse {
  requestId: string
  success: boolean
  data?: any
  error?: string
}

export class VocabLibraryService {
  private static instance: VocabLibraryService | null = null
  private libraries: VocabLibrary[] = []
  private settings: VocabLibrarySettings = {
    selectedLibraryId: 'jlpt',
    levelSettings: {},
  }
  private isInitialized: boolean = false
  private initializationPromise: Promise<void> | null = null

  private constructor() {}

  static getInstance(): VocabLibraryService {
    if (!VocabLibraryService.instance) {
      VocabLibraryService.instance = new VocabLibraryService()
    }
    return VocabLibraryService.instance
  }

  /**
   * 初始化词库服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this.doInitialize()
    return this.initializationPromise
  }

  private async doInitialize(): Promise<void> {
    try {
      console.log('[VocabLibraryService] 开始初始化中央化词库服务...')
      
      await this.loadLibraries()
      await this.loadSettings()

      this.isInitialized = true
      console.log('[VocabLibraryService] 中央化词库服务初始化完成')
    } catch (error) {
      console.error('[VocabLibraryService] 初始化失败:', error)
      this.initializationPromise = null
      throw error
    }
  }

  private async loadLibraries(): Promise<void> {
    try {
      // 加载JLPT词库
      const jlptUrl = chrome.runtime.getURL('dict/jlpt.json')
      const jlptResponse = await fetch(jlptUrl)

      if (!jlptResponse.ok) {
        throw new Error(`HTTP error! status: ${jlptResponse.status}`)
      }

      const jlptData: VocabEntry[] = await jlptResponse.json()

      if (!Array.isArray(jlptData) || jlptData.length === 0) {
        throw new Error('JLPT数据格式无效或为空')
      }

      const jlptLevels = ['N5', 'N4', 'N3', 'N2', 'N1']

      const jlptLibrary: VocabLibrary = {
        id: 'jlpt',
        name: 'JLPT 日语能力考试',
        description: '包含 N5 到 N1 的全部词汇',
        icon: '📚',
        data: jlptData,
        totalWords: jlptData.length,
        levels: jlptLevels,
      }

      this.libraries = [jlptLibrary]
      console.log(`[VocabLibraryService] 成功加载JLPT词库: ${jlptData.length}个词汇`)
    } catch (error) {
      console.error('加载词库失败:', error)
      // 创建空的库以避免后续错误
      this.libraries = [
        {
          id: 'jlpt',
          name: 'JLPT 日语能力考试',
          description: '词库加载失败，请刷新页面重试',
          icon: '⚠️',
          data: [],
          totalWords: 0,
          levels: [],
        },
      ]
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['vocabLibrarySettings'])
      if (result.vocabLibrarySettings) {
        this.settings = result.vocabLibrarySettings
      } else {
        // 初始化默认设置
        await this.initializeDefaultSettings()
      }
    } catch (error) {
      console.error('加载词库设置失败:', error)
    }
  }

  private async initializeDefaultSettings(): Promise<void> {
    const jlptLibrary = this.libraries.find((lib) => lib.id === 'jlpt')
    if (!jlptLibrary) return

    const levelSettings: Record<string, LevelProgress> = {}

    for (const level of jlptLibrary.levels) {
      const wordsInLevel = jlptLibrary.data.filter((word) => word.Level === level)
      levelSettings[level] = {
        level,
        enabled: true,
        totalWords: wordsInLevel.length,
        progress: 0,
      }
    }

    this.settings = {
      selectedLibraryId: 'jlpt',
      levelSettings,
    }

    await this.saveSettings()
  }

  async saveSettings(): Promise<void> {
    await chrome.storage.local.set({ vocabLibrarySettings: this.settings })
  }

  /**
   * 处理来自内容脚本的请求
   */
  async handleRequest(request: VocabRequest): Promise<VocabResponse> {
    try {
      await this.initialize()

      let data: any

      switch (request.type) {
        case 'getActiveWordlist':
          data = await this.getActiveWordlist()
          break
        case 'getSelectedLibrary':
          data = this.getSelectedLibrary()
          break
        case 'getSettings':
          data = this.getSettings()
          break
        case 'updateProgress':
          await this.updateProgressFromCards()
          data = { success: true }
          break
        default:
          throw new Error(`未知请求类型: ${request.type}`)
      }

      return {
        requestId: request.requestId,
        success: true,
        data,
      }
    } catch (error) {
      console.error(`[VocabLibraryService] 处理请求失败:`, error)
      return {
        requestId: request.requestId,
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      }
    }
  }

  /**
   * 获取当前激活的词汇列表
   */
  private async getActiveWordlist(): Promise<string[]> {
    const selectedLibrary = this.getSelectedLibrary()
    if (!selectedLibrary) return []

    const enabledLevels = Object.entries(this.settings.levelSettings)
      .filter(([_, progress]) => progress.enabled)
      .map(([level]) => level)

    if (enabledLevels.length === 0) return []

    const activeWords = selectedLibrary.data
      .filter((word) => enabledLevels.includes(word.Level))
      .map((word) => word.VocabKanji)

    return activeWords
  }

  /**
   * 获取选中的词库
   */
  private getSelectedLibrary(): VocabLibrary | null {
    return this.libraries.find((lib) => lib.id === this.settings.selectedLibraryId) || null
  }

  /**
   * 获取设置
   */
  private getSettings(): VocabLibrarySettings {
    return this.settings
  }

  /**
   * 从已保存的卡片更新进度
   */
  private async updateProgressFromCards(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['savedCards'])
      const savedCards: FlashCard[] = result.savedCards || []

      const learnedWordsCount: Record<string, number> = {}

      for (const card of savedCards) {
        if (card.level) {
          learnedWordsCount[card.level] = (learnedWordsCount[card.level] || 0) + 1
        }
      }

      let updated = false
      for (const [level, count] of Object.entries(learnedWordsCount)) {
        if (this.settings.levelSettings[level]) {
          const oldProgress = this.settings.levelSettings[level].progress
          this.settings.levelSettings[level].progress = count
          if (oldProgress !== count) {
            updated = true
          }
        }
      }

      if (updated) {
        await this.saveSettings()
      }
    } catch (error) {
      console.error('[VocabLibraryService] 更新进度失败:', error)
    }
  }

  /**
   * 获取服务状态
   */
  getStatus(): { initialized: boolean; libraryCount: number; activeWords: number } {
    const selectedLibrary = this.getSelectedLibrary()
    const enabledLevels = Object.entries(this.settings.levelSettings)
      .filter(([_, progress]) => progress.enabled)
      .map(([level]) => level)

    const activeWordsCount = selectedLibrary
      ? selectedLibrary.data.filter((word) => enabledLevels.includes(word.Level)).length
      : 0

    return {
      initialized: this.isInitialized,
      libraryCount: this.libraries.length,
      activeWords: activeWordsCount,
    }
  }

  /**
   * 重置服务（用于调试）
   */
  reset(): void {
    this.isInitialized = false
    this.initializationPromise = null
    this.libraries = []
    this.settings = {
      selectedLibraryId: 'jlpt',
      levelSettings: {},
    }
    console.log('[VocabLibraryService] 服务已重置')
  }
}