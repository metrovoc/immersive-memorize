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

  private readonly REQUEST_TIMEOUT = 10000 // 10秒超时

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
   * 分析文本
   */
  async analyze(text: string): Promise<Word[]> {
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
          // 清理请求
          clearTimeout(timeout)
          this.pendingRequests.delete(requestId)
          reject(new Error(`通信错误: ${chrome.runtime.lastError.message}`))
          return
        }

        // 直接处理响应（不使用消息监听器）
        this.handleAnalyzeResponse(response)
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