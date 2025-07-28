/**
 * 远程词库管理器客户端
 * 将词库请求转发给 Background Service Worker 中的中央化词库服务
 */

import type {
  VocabLibrary,
  VocabLibrarySettings,
} from '@/types'
import type { VocabRequest, VocabResponse } from '../../background/vocab-library-service'

export class RemoteVocabLibraryManager {
  private requestIdCounter: number = 0
  private readonly REQUEST_TIMEOUT = 5000 // 5秒超时

  constructor() {}

  /**
   * 初始化（空实现，兼容性）
   */
  async init(): Promise<void> {
    // 远程模式下不需要本地初始化，Background Service Worker 会自动预热
    return Promise.resolve()
  }

  /**
   * 发送请求到 Background Service Worker
   */
  private async sendRequest(type: string, data?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = `vocab_${Date.now()}_${++this.requestIdCounter}`
      
      const timeout = setTimeout(() => {
        reject(new Error(`词库请求超时 (${this.REQUEST_TIMEOUT}ms)`))
      }, this.REQUEST_TIMEOUT)

      const request: VocabRequest = {
        requestId,
        type: type as VocabRequest['type'],
        data
      }

      chrome.runtime.sendMessage({
        type: 'VOCAB_REQUEST',
        requestId: request.requestId,
        requestType: request.type,
        data: request.data
      }, (response: VocabResponse) => {
        clearTimeout(timeout)

        if (chrome.runtime.lastError) {
          reject(new Error(`通信错误: ${chrome.runtime.lastError.message}`))
          return
        }

        if (response?.success) {
          resolve(response.data)
        } else {
          reject(new Error(response?.error || '词库请求失败'))
        }
      })
    })
  }

  /**
   * 获取当前激活的词汇列表
   */
  async getActiveWordlist(): Promise<string[]> {
    try {
      return await this.sendRequest('getActiveWordlist')
    } catch (error) {
      console.error('[RemoteVocabLibrary] 获取激活词汇列表失败:', error)
      return []
    }
  }

  /**
   * 获取选中的词库
   */
  getSelectedLibrary(): VocabLibrary | null {
    // 这是一个同步方法，但远程调用是异步的
    // 我们需要缓存数据或修改为异步
    console.warn('[RemoteVocabLibrary] getSelectedLibrary 需要异步调用，请使用 getSelectedLibraryAsync')
    return null
  }

  /**
   * 异步获取选中的词库
   */
  async getSelectedLibraryAsync(): Promise<VocabLibrary | null> {
    try {
      return await this.sendRequest('getSelectedLibrary')
    } catch (error) {
      console.error('[RemoteVocabLibrary] 获取选中词库失败:', error)
      return null
    }
  }

  /**
   * 获取设置
   */
  getSettings(): VocabLibrarySettings {
    // 同步方法，同样的问题
    console.warn('[RemoteVocabLibrary] getSettings 需要异步调用，请使用 getSettingsAsync')
    return {
      selectedLibraryId: 'jlpt',
      levelSettings: {}
    }
  }

  /**
   * 异步获取设置
   */
  async getSettingsAsync(): Promise<VocabLibrarySettings> {
    try {
      return await this.sendRequest('getSettings')
    } catch (error) {
      console.error('[RemoteVocabLibrary] 获取设置失败:', error)
      return {
        selectedLibraryId: 'jlpt',
        levelSettings: {}
      }
    }
  }

  /**
   * 更新进度
   */
  async updateProgressFromCards(): Promise<void> {
    try {
      await this.sendRequest('updateProgress')
    } catch (error) {
      console.error('[RemoteVocabLibrary] 更新进度失败:', error)
    }
  }

  /**
   * 检查服务状态
   */
  async getStatus(): Promise<{ initialized: boolean; libraryCount: number; activeWords: number }> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'GET_VOCAB_STATUS'
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`获取状态失败: ${chrome.runtime.lastError.message}`))
          return
        }

        if (response?.success) {
          resolve(response.status)
        } else {
          reject(new Error('获取词库服务状态失败'))
        }
      })
    })
  }
}