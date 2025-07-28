/**
 * Background Service Worker 中的中央化日语分析服务
 * 单例模式，确保整个扩展只有一个 kuromoji 实例
 */

import { analyze, type Word } from '@/lib/japanese-analyzer'

export interface AnalyzeRequest {
  requestId: string
  text: string
}

export interface AnalyzeResponse {
  requestId: string
  success: boolean
  words?: Word[]
  error?: string
}

export class JapaneseAnalyzerService {
  private static instance: JapaneseAnalyzerService | null = null
  private isInitialized: boolean = false
  private initializationPromise: Promise<void> | null = null
  private requestQueue: Map<string, (response: AnalyzeResponse) => void> = new Map()

  private constructor() {}

  static getInstance(): JapaneseAnalyzerService {
    if (!JapaneseAnalyzerService.instance) {
      JapaneseAnalyzerService.instance = new JapaneseAnalyzerService()
    }
    return JapaneseAnalyzerService.instance
  }

  /**
   * 初始化分析器（延迟加载）
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
      console.log('[JapaneseAnalyzerService] 开始初始化中央化分析器...')
      
      // 通过调用 analyze 函数触发 kuromoji 的初始化
      // 这会创建并缓存 tokenizer 实例
      await analyze('テスト') // 使用简单文本进行初始化测试

      this.isInitialized = true
      console.log('[JapaneseAnalyzerService] 中央化分析器初始化完成')
    } catch (error) {
      console.error('[JapaneseAnalyzerService] 初始化失败:', error)
      this.initializationPromise = null
      throw error
    }
  }

  /**
   * 分析文本
   */
  async analyzeText(request: AnalyzeRequest): Promise<AnalyzeResponse> {
    try {
      // 确保分析器已初始化
      await this.initialize()

      console.log(`[JapaneseAnalyzerService] 分析文本: "${request.text}" (请求ID: ${request.requestId})`)

      const words = await analyze(request.text)

      const response: AnalyzeResponse = {
        requestId: request.requestId,
        success: true,
        words: words
      }

      console.log(`[JapaneseAnalyzerService] 分析完成，找到 ${words.length} 个词汇 (请求ID: ${request.requestId})`)
      return response
    } catch (error) {
      console.error(`[JapaneseAnalyzerService] 分析失败 (请求ID: ${request.requestId}):`, error)
      
      return {
        requestId: request.requestId,
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 处理来自内容脚本的分析请求
   */
  async handleAnalyzeRequest(request: AnalyzeRequest, sendResponse: (response: AnalyzeResponse) => void): Promise<void> {
    try {
      const response = await this.analyzeText(request)
      sendResponse(response)
    } catch (error) {
      console.error('[JapaneseAnalyzerService] 处理请求失败:', error)
      sendResponse({
        requestId: request.requestId,
        success: false,
        error: error instanceof Error ? error.message : '服务器内部错误'
      })
    }
  }

  /**
   * 获取服务状态
   */
  getStatus(): { initialized: boolean; ready: boolean } {
    return {
      initialized: this.isInitialized,
      ready: this.isInitialized && this.initializationPromise === null
    }
  }

  /**
   * 重置服务（用于调试）
   */
  reset(): void {
    this.isInitialized = false
    this.initializationPromise = null
    this.requestQueue.clear()
    console.log('[JapaneseAnalyzerService] 服务已重置')
  }
}