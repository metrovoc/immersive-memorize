/**
 * 缓存远程词库管理器
 * 提供与原有 VocabLibraryManager 相同的同步接口，但内部使用远程调用和缓存
 */

import type {
  VocabLibrary,
  VocabLibrarySettings,
} from '@/types'
import { RemoteVocabLibraryManager } from './remote-vocab-library'

export class CachedRemoteVocabLibraryManager {
  private remote: RemoteVocabLibraryManager
  private cache: {
    selectedLibrary: VocabLibrary | null
    settings: VocabLibrarySettings | null
    activeWordlist: string[] | null
    lastUpdated: number
  }
  private readonly CACHE_TTL = 30000 // 30秒缓存
  private initPromise: Promise<void> | null = null

  constructor() {
    this.remote = new RemoteVocabLibraryManager()
    this.cache = {
      selectedLibrary: null,
      settings: null,
      activeWordlist: null,
      lastUpdated: 0
    }
  }

  /**
   * 初始化并预缓存数据
   */
  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this.doInit()
    return this.initPromise
  }

  private async doInit(): Promise<void> {
    try {
      console.log('[CachedRemoteVocabLibrary] 开始初始化并预缓存数据...')
      
      // 并行获取所有数据
      const [selectedLibrary, settings, activeWordlist] = await Promise.all([
        this.remote.getSelectedLibraryAsync(),
        this.remote.getSettingsAsync(),
        this.remote.getActiveWordlist()
      ])

      // 更新缓存
      this.cache = {
        selectedLibrary,
        settings,
        activeWordlist,
        lastUpdated: Date.now()
      }

      console.log('[CachedRemoteVocabLibrary] 数据预缓存完成')
    } catch (error) {
      console.error('[CachedRemoteVocabLibrary] 初始化失败:', error)
      // 即使失败也不阻塞，后续会按需重试
    }
  }

  /**
   * 检查缓存是否过期
   */
  private isCacheExpired(): boolean {
    return Date.now() - this.cache.lastUpdated > this.CACHE_TTL
  }

  /**
   * 刷新缓存
   */
  private async refreshCache(): Promise<void> {
    if (this.isCacheExpired()) {
      try {
        const [selectedLibrary, settings, activeWordlist] = await Promise.all([
          this.remote.getSelectedLibraryAsync(),
          this.remote.getSettingsAsync(),
          this.remote.getActiveWordlist()
        ])

        this.cache = {
          selectedLibrary,
          settings,
          activeWordlist,
          lastUpdated: Date.now()
        }
      } catch (error) {
        console.error('[CachedRemoteVocabLibrary] 刷新缓存失败:', error)
        // 保持旧缓存
      }
    }
  }

  /**
   * 获取当前激活的词汇列表（同步接口）
   */
  async getActiveWordlist(): Promise<string[]> {
    await this.refreshCache()
    return this.cache.activeWordlist || []
  }

  /**
   * 获取选中的词库（同步接口）
   */
  getSelectedLibrary(): VocabLibrary | null {
    // 如果缓存过期，后台刷新但立即返回缓存值
    if (this.isCacheExpired()) {
      this.refreshCache().catch(error => {
        console.error('[CachedRemoteVocabLibrary] 后台刷新失败:', error)
      })
    }
    
    return this.cache.selectedLibrary
  }

  /**
   * 获取设置（同步接口）
   */
  getSettings(): VocabLibrarySettings {
    // 如果缓存过期，后台刷新但立即返回缓存值
    if (this.isCacheExpired()) {
      this.refreshCache().catch(error => {
        console.error('[CachedRemoteVocabLibrary] 后台刷新失败:', error)
      })
    }

    return this.cache.settings || {
      selectedLibraryId: 'jlpt',
      levelSettings: {}
    }
  }

  /**
   * 更新进度
   */
  async updateProgressFromCards(): Promise<void> {
    try {
      await this.remote.updateProgressFromCards()
      // 清除缓存以强制下次刷新
      this.cache.lastUpdated = 0
    } catch (error) {
      console.error('[CachedRemoteVocabLibrary] 更新进度失败:', error)
    }
  }

  /**
   * 强制刷新缓存
   */
  async forceRefresh(): Promise<void> {
    this.cache.lastUpdated = 0
    await this.refreshCache()
  }

  /**
   * 获取服务状态
   */
  async getStatus(): Promise<{ initialized: boolean; libraryCount: number; activeWords: number }> {
    return this.remote.getStatus()
  }
}