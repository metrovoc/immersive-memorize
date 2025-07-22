import type { VocabLibrary, VocabEntry, LevelProgress, VocabLibrarySettings } from '@/types'

export class VocabLibraryManager {
  private libraries: VocabLibrary[] = []
  private settings: VocabLibrarySettings = {
    selectedLibraryId: 'jlpt',
    levelSettings: {}
  }

  async init(): Promise<void> {
    await this.loadLibraries()
    await this.loadSettings()
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
        levels: jlptLevels
      }

      this.libraries = [jlptLibrary]
      console.log(`[VocabLibrary] 成功加载JLPT词库: ${jlptData.length}个词汇`)
    } catch (error) {
      console.error('加载词库失败:', error)
      // 创建空的库以避免后续错误
      this.libraries = [{
        id: 'jlpt',
        name: 'JLPT 日语能力考试',
        description: '词库加载失败，请刷新页面重试',
        icon: '⚠️',
        data: [],
        totalWords: 0,
        levels: []
      }]
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
    const jlptLibrary = this.libraries.find(lib => lib.id === 'jlpt')
    if (!jlptLibrary) return

    const levelSettings: Record<string, LevelProgress> = {}
    
    for (const level of jlptLibrary.levels) {
      const wordsInLevel = jlptLibrary.data.filter(word => word.Level === level)
      levelSettings[level] = {
        level,
        enabled: true,
        totalWords: wordsInLevel.length,
        learnedWords: [],
        progress: 0
      }
    }

    this.settings = {
      selectedLibraryId: 'jlpt',
      levelSettings
    }

    await this.saveSettings()
  }

  async saveSettings(): Promise<void> {
    await chrome.storage.local.set({ vocabLibrarySettings: this.settings })
  }

  getLibraries(): VocabLibrary[] {
    return this.libraries
  }

  getSelectedLibrary(): VocabLibrary | undefined {
    return this.libraries.find(lib => lib.id === this.settings.selectedLibraryId)
  }

  async selectLibrary(libraryId: string): Promise<void> {
    this.settings.selectedLibraryId = libraryId
    await this.saveSettings()
  }

  getLevelProgress(level: string): LevelProgress | undefined {
    return this.settings.levelSettings[level]
  }

  async toggleLevel(level: string, enabled: boolean): Promise<void> {
    if (this.settings.levelSettings[level]) {
      this.settings.levelSettings[level].enabled = enabled
      await this.saveSettings()
    }
  }

  async markWordAsLearned(word: string, level: string): Promise<void> {
    const levelProgress = this.settings.levelSettings[level]
    if (levelProgress && !levelProgress.learnedWords.includes(word)) {
      levelProgress.learnedWords.push(word)
      levelProgress.progress = (levelProgress.learnedWords.length / levelProgress.totalWords) * 100
      await this.saveSettings()
    }
  }

  getActiveWordlist(): string[] {
    const selectedLibrary = this.getSelectedLibrary()
    if (!selectedLibrary) return []

    const activeWords: string[] = []
    
    for (const [level, progress] of Object.entries(this.settings.levelSettings)) {
      if (progress.enabled) {
        const wordsInLevel = selectedLibrary.data
          .filter(word => word.Level === level)
          .filter(word => !progress.learnedWords.includes(word.VocabKanji))
          .map(word => word.VocabKanji)
        
        activeWords.push(...wordsInLevel)
      }
    }

    return activeWords
  }

  getSettings(): VocabLibrarySettings {
    return this.settings
  }

  getAllLevelsProgress(): LevelProgress[] {
    return Object.values(this.settings.levelSettings)
  }
}