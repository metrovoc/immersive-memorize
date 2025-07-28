import type { FlashCard } from '@/types'
import type { FlashCardDB, ScreenshotDB } from './types'
import { idbClient } from './idb-client'

class MigrationManager {
  private migrationKey = 'storage_migration_completed'

  /**
   * 检查是否需要数据迁移
   */
  async checkMigrationNeeded(): Promise<boolean> {
    try {
      // 检查迁移标记
      const migrationStatus = await chrome.storage.local.get([this.migrationKey])
      if (migrationStatus[this.migrationKey]) {
        console.log('[MigrationManager] 数据迁移已完成，跳过')
        return false
      }

      // 检查是否存在旧版本数据
      const result = await chrome.storage.local.get(['savedCards'])
      const hasOldData = result.savedCards && Array.isArray(result.savedCards) && result.savedCards.length > 0

      console.log('[MigrationManager] 迁移检查结果:', {
        hasOldData,
        cardCount: result.savedCards?.length || 0
      })

      return hasOldData
    } catch (error) {
      console.error('[MigrationManager] 迁移检查失败:', error)
      return false
    }
  }

  /**
   * 执行数据迁移
   */
  async migrate(): Promise<void> {
    try {
      console.log('[MigrationManager] 开始数据迁移检查...')

      const needsMigration = await this.checkMigrationNeeded()
      console.log('[MigrationManager] 迁移需求检查结果:', needsMigration)

      if (!needsMigration) {
        console.log('[MigrationManager] 无需迁移，退出')
        return
      }

      // 读取旧数据
      const result = await chrome.storage.local.get(['savedCards'])
      const oldCards: FlashCard[] = result.savedCards || []

      if (oldCards.length === 0) {
        console.log('[MigrationManager] 没有数据需要迁移')
        await this.markMigrationCompleted()
        return
      }

      console.log(`[MigrationManager] 开始迁移 ${oldCards.length} 张卡片...`)

      // 分离卡片数据和截图数据
      const cards: FlashCardDB[] = []
      const screenshots: ScreenshotDB[] = []

      for (const card of oldCards) {
        const { screenshot, ...cardData } = card
        cards.push(cardData as FlashCardDB)

        if (screenshot) {
          screenshots.push({
            cardId: card.id,
            data: screenshot,
            createdAt: card.createdAt
          })
        }
      }

      // 批量迁移数据
      await this.batchMigrateData(cards, screenshots)

      // 清理旧数据
      await this.cleanupOldData()

      // 标记迁移完成
      await this.markMigrationCompleted()

      console.log('[MigrationManager] 数据迁移完成!', {
        cards: cards.length,
        screenshots: screenshots.length
      })
    } catch (error) {
      console.error('[MigrationManager] 数据迁移失败:', error)
      throw new Error(`数据迁移失败: ${error}`)
    }
  }

  /**
   * 批量迁移数据到 IndexedDB
   */
  private async batchMigrateData(cards: FlashCardDB[], screenshots: ScreenshotDB[]): Promise<void> {
    try {
      const batchSize = 50 // 批量处理大小

      // 批量添加卡片
      for (let i = 0; i < cards.length; i += batchSize) {
        const batch = cards.slice(i, i + batchSize)
        await idbClient.batchAddCards(batch)
        console.log(`[MigrationManager] 已迁移卡片 ${Math.min(i + batchSize, cards.length)}/${cards.length}`)
      }

      // 批量添加截图
      for (let i = 0; i < screenshots.length; i += batchSize) {
        const batch = screenshots.slice(i, i + batchSize)
        await idbClient.batchAddScreenshots(batch)
        console.log(`[MigrationManager] 已迁移截图 ${Math.min(i + batchSize, screenshots.length)}/${screenshots.length}`)
      }
    } catch (error) {
      console.error('[MigrationManager] 批量迁移数据失败:', error)
      throw error
    }
  }

  /**
   * 清理旧数据
   */
  private async cleanupOldData(): Promise<void> {
    try {
      await chrome.storage.local.remove(['savedCards'])
      console.log('[MigrationManager] 旧数据清理完成')
    } catch (error) {
      console.error('[MigrationManager] 清理旧数据失败:', error)
      // 清理失败不应该阻止迁移流程
    }
  }

  /**
   * 标记迁移已完成
   */
  private async markMigrationCompleted(): Promise<void> {
    try {
      await chrome.storage.local.set({
        [this.migrationKey]: {
          completed: true,
          timestamp: new Date().toISOString(),
          version: 'v2.0'
        }
      })
      console.log('[MigrationManager] 迁移状态已标记完成')
    } catch (error) {
      console.error('[MigrationManager] 标记迁移完成失败:', error)
      throw error
    }
  }

  /**
   * 强制重新迁移（仅用于开发和调试）
   */
  async forceMigration(): Promise<void> {
    try {
      console.log('[MigrationManager] 强制重新迁移...')

      // 清除迁移标记
      await chrome.storage.local.remove([this.migrationKey])

      // 清空新数据库
      await idbClient.clearAllData()

      // 重新执行迁移
      await this.migrate()

      console.log('[MigrationManager] 强制迁移完成')
    } catch (error) {
      console.error('[MigrationManager] 强制迁移失败:', error)
      throw error
    }
  }

  /**
   * 获取迁移状态信息
   */
  async getMigrationStatus(): Promise<{
    completed: boolean
    timestamp?: string
    version?: string
    oldDataExists: boolean
    newDataCount: number
  }> {
    try {
      const [migrationResult, oldDataResult] = await Promise.all([
        chrome.storage.local.get([this.migrationKey]),
        chrome.storage.local.get(['savedCards'])
      ])

      const migrationInfo = migrationResult[this.migrationKey]
      const oldDataExists = oldDataResult.savedCards && 
                           Array.isArray(oldDataResult.savedCards) && 
                           oldDataResult.savedCards.length > 0

      // 尝试获取新数据计数
      let newDataCount = 0
      try {
        const newCards = await idbClient.getAllCards()
        newDataCount = newCards.length
      } catch (error) {
        console.warn('[MigrationManager] 获取新数据计数失败:', error)
      }

      return {
        completed: !!migrationInfo?.completed,
        timestamp: migrationInfo?.timestamp,
        version: migrationInfo?.version,
        oldDataExists,
        newDataCount
      }
    } catch (error) {
      console.error('[MigrationManager] 获取迁移状态失败:', error)
      return {
        completed: false,
        oldDataExists: false,
        newDataCount: 0
      }
    }
  }
}

// 导出单例实例
export const migrationManager = new MigrationManager()