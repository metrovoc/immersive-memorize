import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { FlashCardDB, ScreenshotDB, SettingDB, VocabCacheDB } from './types'
import { DB_NAME, DB_VERSION, STORES, INDEXES } from './types'

// 数据库 Schema 定义
interface ImmersiveMemorizeDB extends DBSchema {
  [STORES.FLASHCARDS]: {
    key: number
    value: FlashCardDB
    indexes: {
      [INDEXES.FLASHCARDS.BY_WORD]: string
      [INDEXES.FLASHCARDS.BY_LEVEL]: string
      [INDEXES.FLASHCARDS.BY_CREATED_AT]: string
    }
  }
  [STORES.SCREENSHOTS]: {
    key: number
    value: ScreenshotDB
    indexes: {
      [INDEXES.SCREENSHOTS.BY_CARD_ID]: number
    }
  }
  [STORES.SETTINGS]: {
    key: string
    value: SettingDB
    indexes: {
      [INDEXES.SETTINGS.BY_KEY]: string
    }
  }
  [STORES.VOCAB_CACHE]: {
    key: string
    value: VocabCacheDB
    indexes: {
      [INDEXES.VOCAB_CACHE.BY_LEVEL]: string
    }
  }
}

class IDBClient {
  private db: IDBPDatabase<ImmersiveMemorizeDB> | null = null
  private initPromise: Promise<void> | null = null

  async initDB(): Promise<void> {
    if (this.db) return
    
    if (!this.initPromise) {
      this.initPromise = this._initDB()
    }
    
    await this.initPromise
  }

  private async _initDB(): Promise<void> {
    try {
      this.db = await openDB<ImmersiveMemorizeDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // 创建 flashcards store
          if (!db.objectStoreNames.contains(STORES.FLASHCARDS)) {
            const flashcardsStore = db.createObjectStore(STORES.FLASHCARDS, { keyPath: 'id' })
            flashcardsStore.createIndex(INDEXES.FLASHCARDS.BY_WORD, 'word')
            flashcardsStore.createIndex(INDEXES.FLASHCARDS.BY_LEVEL, 'level')
            flashcardsStore.createIndex(INDEXES.FLASHCARDS.BY_CREATED_AT, 'createdAt')
          }

          // 创建 screenshots store
          if (!db.objectStoreNames.contains(STORES.SCREENSHOTS)) {
            const screenshotsStore = db.createObjectStore(STORES.SCREENSHOTS, { keyPath: 'cardId' })
            screenshotsStore.createIndex(INDEXES.SCREENSHOTS.BY_CARD_ID, 'cardId')
          }

          // 创建 settings store
          if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
            const settingsStore = db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' })
            settingsStore.createIndex(INDEXES.SETTINGS.BY_KEY, 'key')
          }

          // 创建 vocab_cache store
          if (!db.objectStoreNames.contains(STORES.VOCAB_CACHE)) {
            const vocabStore = db.createObjectStore(STORES.VOCAB_CACHE, { keyPath: 'word' })
            vocabStore.createIndex(INDEXES.VOCAB_CACHE.BY_LEVEL, 'level')
          }
        }
      })
      
      console.log('[IDBClient] 数据库初始化成功')
    } catch (error) {
      console.error('[IDBClient] 数据库初始化失败:', error)
      throw new Error(`IndexedDB 初始化失败: ${error}`)
    }
  }

  // ===== FlashCard 操作 =====
  async addCard(card: FlashCardDB): Promise<void> {
    await this.initDB()
    if (!this.db) throw new Error('数据库未初始化')
    
    await this.db.add(STORES.FLASHCARDS, card)
    console.log('[IDBClient] 添加卡片成功:', card.id)
  }

  async getCard(id: number): Promise<FlashCardDB | undefined> {
    await this.initDB()
    if (!this.db) throw new Error('数据库未初始化')
    
    return await this.db.get(STORES.FLASHCARDS, id)
  }

  async getAllCards(): Promise<FlashCardDB[]> {
    await this.initDB()
    if (!this.db) throw new Error('数据库未初始化')
    
    return await this.db.getAll(STORES.FLASHCARDS)
  }

  async getCardsByLevel(level: string): Promise<FlashCardDB[]> {
    await this.initDB()
    if (!this.db) throw new Error('数据库未初始化')
    
    return await this.db.getAllFromIndex(STORES.FLASHCARDS, INDEXES.FLASHCARDS.BY_LEVEL, level)
  }

  async getCardsByWord(word: string): Promise<FlashCardDB[]> {
    await this.initDB()
    if (!this.db) throw new Error('数据库未初始化')
    
    return await this.db.getAllFromIndex(STORES.FLASHCARDS, INDEXES.FLASHCARDS.BY_WORD, word)
  }

  async deleteCard(id: number): Promise<void> {
    await this.initDB()
    if (!this.db) throw new Error('数据库未初始化')
    
    const tx = this.db.transaction([STORES.FLASHCARDS, STORES.SCREENSHOTS], 'readwrite')
    
    await Promise.all([
      tx.objectStore(STORES.FLASHCARDS).delete(id),
      tx.objectStore(STORES.SCREENSHOTS).delete(id)
    ])
    
    await tx.done
    console.log('[IDBClient] 删除卡片成功:', id)
  }

  async batchAddCards(cards: FlashCardDB[]): Promise<void> {
    await this.initDB()
    if (!this.db) throw new Error('数据库未初始化')
    
    const tx = this.db.transaction(STORES.FLASHCARDS, 'readwrite')
    const store = tx.objectStore(STORES.FLASHCARDS)
    
    await Promise.all(cards.map(card => store.add(card)))
    await tx.done
    
    console.log('[IDBClient] 批量添加卡片成功:', cards.length)
  }

  // ===== Screenshot 操作 =====
  async addScreenshot(screenshot: ScreenshotDB): Promise<void> {
    await this.initDB()
    if (!this.db) throw new Error('数据库未初始化')
    
    await this.db.put(STORES.SCREENSHOTS, screenshot)
    console.log('[IDBClient] 添加截图成功:', screenshot.cardId)
  }

  async getScreenshot(cardId: number): Promise<ScreenshotDB | undefined> {
    await this.initDB()
    if (!this.db) throw new Error('数据库未初始化')
    
    return await this.db.get(STORES.SCREENSHOTS, cardId)
  }

  async batchAddScreenshots(screenshots: ScreenshotDB[]): Promise<void> {
    await this.initDB()
    if (!this.db) throw new Error('数据库未初始化')
    
    const tx = this.db.transaction(STORES.SCREENSHOTS, 'readwrite')
    const store = tx.objectStore(STORES.SCREENSHOTS)
    
    await Promise.all(screenshots.map(screenshot => store.put(screenshot)))
    await tx.done
    
    console.log('[IDBClient] 批量添加截图成功:', screenshots.length)
  }

  // ===== Settings 操作 =====
  async setSetting(key: string, value: any): Promise<void> {
    await this.initDB()
    if (!this.db) throw new Error('数据库未初始化')
    
    const setting: SettingDB = {
      key,
      value,
      updatedAt: new Date().toISOString()
    }
    
    await this.db.put(STORES.SETTINGS, setting)
  }

  async getSetting(key: string): Promise<any> {
    await this.initDB()
    if (!this.db) throw new Error('数据库未初始化')
    
    const result = await this.db.get(STORES.SETTINGS, key)
    return result?.value
  }

  // ===== Vocab Cache 操作 =====
  async cacheVocab(vocab: VocabCacheDB): Promise<void> {
    await this.initDB()
    if (!this.db) throw new Error('数据库未初始化')
    
    await this.db.put(STORES.VOCAB_CACHE, vocab)
  }

  async getCachedVocab(word: string): Promise<VocabCacheDB | undefined> {
    await this.initDB()
    if (!this.db) throw new Error('数据库未初始化')
    
    return await this.db.get(STORES.VOCAB_CACHE, word)
  }

  // ===== 管理操作 =====
  async clearAllData(): Promise<void> {
    await this.initDB()
    if (!this.db) throw new Error('数据库未初始化')
    
    const tx = this.db.transaction([STORES.FLASHCARDS, STORES.SCREENSHOTS, STORES.VOCAB_CACHE], 'readwrite')
    
    await Promise.all([
      tx.objectStore(STORES.FLASHCARDS).clear(),
      tx.objectStore(STORES.SCREENSHOTS).clear(),
      tx.objectStore(STORES.VOCAB_CACHE).clear()
    ])
    
    await tx.done
    console.log('[IDBClient] 清空所有数据完成')
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
      console.log('[IDBClient] 数据库连接已关闭')
    }
  }
}

// 导出单例实例
export const idbClient = new IDBClient()