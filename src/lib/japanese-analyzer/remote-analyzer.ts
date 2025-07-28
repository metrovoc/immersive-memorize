/**
 * 远程日语分析器客户端
 * 将分析请求转发给 Background Service Worker 中的中央化分析服务
 */

import type { Word } from './common'
import type { AnalyzeRequest, AnalyzeResponse } from '../../background/japanese-analyzer-service'

export class RemoteJapaneseAnalyzer {
  private requestIdCounter: number = 0
  private pendingRequests: Map<string, {
    resolve: (words: Word[]) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }> = new Map()

  // 缓存和去重机制
  private analysisCache: Map<string, {
    words: Word[]
    timestamp: number
    promise?: Promise<Word[]>
  }> = new Map()
  
  private readonly REQUEST_TIMEOUT = 10000 // 10秒超时
  private readonly CACHE_TTL = 30000 // 缓存30秒
  private readonly MAX_CACHE_SIZE = 100 // 最大缓存条目数

  constructor() {
    this.setupMessageListener()
  }

  /**
   * 设置消息监听器
   */
  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'ANALYZE_RESPONSE') {
        this.handleAnalyzeResponse(message as AnalyzeResponse)
      }
    })
  }

  /**
   * 处理分析响应
   */
  private handleAnalyzeResponse(response: AnalyzeResponse): void {
    const pendingRequest = this.pendingRequests.get(response.requestId)
    if (!pendingRequest) {
      console.warn('[RemoteAnalyzer] 收到未知请求ID的响应:', response.requestId)
      return
    }

    // 清理超时计时器
    clearTimeout(pendingRequest.timeout)
    this.pendingRequests.delete(response.requestId)

    if (response.success && response.words) {
      pendingRequest.resolve(response.words)
    } else {
      const error = new Error(response.error || '分析失败')
      pendingRequest.reject(error)
    }
  }

  /**
   * 创建缓存键
   */
  private createCacheKey(text: string): string {
    return text.trim().toLowerCase()
  }

  /**
   * 清理过期缓存
   */
  private cleanExpiredCache(): void {
    const now = Date.now()
    for (const [key, entry] of this.analysisCache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.analysisCache.delete(key)
      }
    }

    // 如果缓存过大，删除最旧的条目
    if (this.analysisCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.analysisCache.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
      
      // 删除最旧的25%
      const toDelete = Math.floor(this.MAX_CACHE_SIZE * 0.25)
      for (let i = 0; i < toDelete; i++) {
        this.analysisCache.delete(entries[i][0])
      }
    }
  }

  /**
   * 分析文本
   */
  async analyze(text: string): Promise<Word[]> {
    const cacheKey = this.createCacheKey(text)
    
    // 检查缓存
    const cached = this.analysisCache.get(cacheKey)
    if (cached) {
      const isExpired = Date.now() - cached.timestamp > this.CACHE_TTL
      
      if (!isExpired) {
        // 缓存命中且未过期
        return cached.words
      } else if (cached.promise) {
        // 缓存过期但有正在进行的请求
        return cached.promise
      }
    }

    // 清理过期缓存
    this.cleanExpiredCache()

    // 创建新的分析请求
    const analysisPromise = this.performAnalysis(text, cacheKey)
    
    // 将Promise存储到缓存中（防重复请求）
    this.analysisCache.set(cacheKey, {
      words: [], // 占位符，实际结果将在完成后更新
      timestamp: Date.now(),
      promise: analysisPromise
    })

    return analysisPromise
  }

  /**
   * 执行实际的分析请求
   */
  private async performAnalysis(text: string, cacheKey: string): Promise<Word[]> {
    return new Promise<Word[]>((resolve, reject) => {
      const requestId = `analyze_${Date.now()}_${++this.requestIdCounter}`
      
      // 设置超时处理
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error(`分析请求超时 (${this.REQUEST_TIMEOUT}ms)`))
      }, this.REQUEST_TIMEOUT)

      // 存储请求信息
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout
      })

      // 发送分析请求到 Background Service Worker
      const request: AnalyzeRequest = {
        requestId,
        text
      }

      chrome.runtime.sendMessage({
        type: 'ANALYZE_TEXT',
        ...request
      }, (response: AnalyzeResponse) => {
        if (chrome.runtime.lastError) {
          // 清理请求和缓存
          clearTimeout(timeout)
          this.pendingRequests.delete(requestId)
          this.analysisCache.delete(cacheKey)
          reject(new Error(`通信错误: ${chrome.runtime.lastError.message}`))
          return
        }

        // 处理成功响应
        if (response.success && response.words) {
          // 更新缓存
          this.analysisCache.set(cacheKey, {
            words: response.words,
            timestamp: Date.now()
            // 移除promise引用，表示请求已完成
          })
          
          // 清理请求状态
          clearTimeout(timeout)
          this.pendingRequests.delete(requestId)
          
          resolve(response.words)
        } else {
          // 处理错误响应
          clearTimeout(timeout)
          this.pendingRequests.delete(requestId)
          this.analysisCache.delete(cacheKey)
          reject(new Error(response.error || '分析失败'))
        }
      })
    })
  }

  /**
   * 检查分析器状态
   */
  async getStatus(): Promise<{ initialized: boolean; ready: boolean }> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'GET_ANALYZER_STATUS'
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`获取状态失败: ${chrome.runtime.lastError.message}`))
          return
        }

        if (response?.success) {
          resolve(response.status)
        } else {
          reject(new Error('获取分析器状态失败'))
        }
      })
    })
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // 清理所有待处理的请求
    for (const [requestId, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeout)
      request.reject(new Error('分析器已清理'))
    }
    this.pendingRequests.clear()
    
    // 清理缓存
    this.analysisCache.clear()
  }

  /**
   * 获取缓存统计信息（调试用）
   */
  getCacheStats(): { size: number; totalRequests: number } {
    return {
      size: this.analysisCache.size,
      totalRequests: this.requestIdCounter
    }
  }
}

// 创建单例实例
let remoteAnalyzer: RemoteJapaneseAnalyzer | null = null

/**
 * 获取远程分析器实例
 */
export function getRemoteAnalyzer(): RemoteJapaneseAnalyzer {
  if (!remoteAnalyzer) {
    remoteAnalyzer = new RemoteJapaneseAnalyzer()
  }
  return remoteAnalyzer
}

/**
 * 兼容性函数 - 与原有 analyze 函数保持相同接口
 */
export async function analyze(text: string): Promise<Word[]> {
  const analyzer = getRemoteAnalyzer()
  return analyzer.analyze(text)
}

/**
 * 导出类型
 */
export type { Word } from './common'