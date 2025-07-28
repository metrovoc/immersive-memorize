import type { FlashCard } from '@/types'
import type { FlashCardDB, ScreenshotDB, StorageMessage, StorageResponse } from './types'
import { idbClient } from './idb-client'

class StorageService {
  private isContentScript: boolean = false
  private isBackgroundScript: boolean = false

  constructor() {
    // 检测运行环境
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        if (typeof window === 'undefined') {
          // Background script (service worker) - 直接访问 IndexedDB
          this.isBackgroundScript = true
          this.isContentScript = false
        } else {
          // 所有有 window 对象的环境（popup/options/content script）都通过消息传递访问数据
          this.isContentScript = true
          this.isBackgroundScript = false
        }
      }
    } catch (error) {
      console.warn('[StorageService] 环境检测失败:', error)
    }

    console.log('[StorageService] 初始化完成', {
      isContentScript: this.isContentScript,
      isBackgroundScript: this.isBackgroundScript,
    })
  }

  // ===== 主要的存储 API =====

  async getAllCards(): Promise<FlashCard[]> {
    console.log('[StorageService] getAllCards 调用，环境:', {
      isContentScript: this.isContentScript,
      isBackgroundScript: this.isBackgroundScript,
    })

    if (this.isContentScript) {
      console.log('[StorageService] 通过消息传递获取卡片')
      return this.sendMessageToBackground('GET_CARDS')
    }

    try {
      console.log('[StorageService] 直接从 IndexedDB 获取卡片')
      const cards = await idbClient.getAllCards()
      const cardsWithScreenshots = await this.attachScreenshotsToCards(cards)

      console.log('[StorageService] 获取到卡片数量:', cardsWithScreenshots.length)
      return cardsWithScreenshots
    } catch (error) {
      console.error('[StorageService] 获取卡片失败:', error)
      throw new Error(`获取卡片失败: ${error}`)
    }
  }

  async addCard(card: FlashCard): Promise<void> {
    if (this.isContentScript) {
      return this.sendMessageToBackground('ADD_CARD', card)
    }

    try {
      const { screenshot, ...cardData } = card
      const cardDB: FlashCardDB = cardData as FlashCardDB

      // 添加卡片（不包含截图）
      await idbClient.addCard(cardDB)

      // 如果有截图，单独存储
      if (screenshot) {
        const screenshotDB: ScreenshotDB = {
          cardId: card.id,
          data: screenshot,
          createdAt: card.createdAt,
        }
        await idbClient.addScreenshot(screenshotDB)
      }

      console.log('[StorageService] 添加卡片成功:', card.id)
    } catch (error) {
      console.error('[StorageService] 添加卡片失败:', error)
      throw new Error(`添加卡片失败: ${error}`)
    }
  }

  async deleteCard(id: number): Promise<void> {
    if (this.isContentScript) {
      return this.sendMessageToBackground('DELETE_CARD', id)
    }

    try {
      await idbClient.deleteCard(id)
      console.log('[StorageService] 删除卡片成功:', id)
    } catch (error) {
      console.error('[StorageService] 删除卡片失败:', error)
      throw new Error(`删除卡片失败: ${error}`)
    }
  }

  async getCardsByLevel(level: string): Promise<FlashCard[]> {
    if (this.isContentScript) {
      return this.sendMessageToBackground('GET_CARDS_BY_LEVEL', level)
    }

    try {
      const cards = await idbClient.getCardsByLevel(level)
      return await this.attachScreenshotsToCards(cards)
    } catch (error) {
      console.error('[StorageService] 按等级获取卡片失败:', error)
      throw new Error(`按等级获取卡片失败: ${error}`)
    }
  }

  async getLearnedWords(): Promise<string[]> {
    if (this.isContentScript) {
      return this.sendMessageToBackground('GET_LEARNED_WORDS')
    }

    try {
      const cards = await idbClient.getAllCards()
      return cards.map(card => card.word)
    } catch (error) {
      console.error('[StorageService] 获取已学词汇失败:', error)
      throw new Error(`获取已学词汇失败: ${error}`)
    }
  }

  // ===== 辅助方法 =====

  private async attachScreenshotsToCards(cards: FlashCardDB[]): Promise<FlashCard[]> {
    const result: FlashCard[] = []

    for (const card of cards) {
      const screenshot = await idbClient.getScreenshot(card.id)
      const fullCard: FlashCard = {
        ...card,
        screenshot: screenshot?.data || '',
      }
      result.push(fullCard)
    }

    return result
  }

  private async sendMessageToBackground(type: string, payload?: any): Promise<any> {
    try {
      const response = await chrome.runtime.sendMessage({ type, payload })
      if (!response.success) {
        throw new Error(response.error || '未知错误')
      }
      return response.data
    } catch (error) {
      console.error('[StorageService] 消息发送失败:', error)
      throw new Error(`消息发送失败: ${error}`)
    }
  }

  // ===== Background Script 消息处理 =====

  async handleStorageMessage(message: StorageMessage): Promise<StorageResponse> {
    try {
      let data: any

      switch (message.type) {
        case 'GET_CARDS':
          data = await this.getAllCards()
          break

        case 'ADD_CARD':
          await this.addCard(message.payload)
          data = true
          break

        case 'DELETE_CARD':
          await this.deleteCard(message.payload)
          data = true
          break

        case 'GET_CARDS_BY_LEVEL':
          data = await this.getCardsByLevel(message.payload)
          break

        case 'GET_LEARNED_WORDS':
          data = await this.getLearnedWords()
          break

        case 'GET_SCREENSHOT':
          const screenshot = await idbClient.getScreenshot(message.payload)
          data = screenshot?.data || ''
          break

        case 'CLEAR_ALL_DATA':
          await this.clearAllData()
          data = true
          break

        case 'MIGRATE_DATA':
          // 迁移逻辑会在 migration-manager 中处理
          data = true
          break

        default:
          throw new Error(`未知的消息类型: ${message.type}`)
      }

      return { success: true, data }
    } catch (error) {
      console.error('[StorageService] 处理存储消息失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      }
    }
  }

  async clearAllData(): Promise<void> {
    if (this.isContentScript) {
      return this.sendMessageToBackground('CLEAR_ALL_DATA')
    }

    try {
      await idbClient.clearAllData()
      console.log('[StorageService] 清空所有数据完成')
    } catch (error) {
      console.error('[StorageService] 清空数据失败:', error)
      throw new Error(`清空数据失败: ${error}`)
    }
  }
}

// 导出单例实例
export const storageService = new StorageService()
