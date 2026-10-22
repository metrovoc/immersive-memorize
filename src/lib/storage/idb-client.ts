import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { DB_NAME, DB_VERSION, STORES, type FlashCardRecord, type ScreenshotRecord } from './types'

interface ImmersiveMemorizeDB extends DBSchema {
  [STORES.FLASHCARDS]: {
    key: number
    value: FlashCardRecord
    indexes: { 'by-word': string; 'by-level': string; 'by-created-at': string }
  }
  [STORES.SCREENSHOTS]: {
    key: number
    value: ScreenshotRecord
    indexes: { 'by-card-id': number }
  }
  [STORES.SETTINGS]: {
    key: string
    value: { key: string; value: unknown; updatedAt: string }
    indexes: { 'by-key': string }
  }
  [STORES.VOCAB_CACHE]: {
    key: string
    value: { word: string; level: string }
    indexes: { 'by-level': string }
  }
}

let database: Promise<IDBPDatabase<ImmersiveMemorizeDB>> | null = null

function db(): Promise<IDBPDatabase<ImmersiveMemorizeDB>> {
  database ??= openDB<ImmersiveMemorizeDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORES.FLASHCARDS)) {
        const cards = db.createObjectStore(STORES.FLASHCARDS, { keyPath: 'id' })
        cards.createIndex('by-word', 'word')
        cards.createIndex('by-level', 'level')
        cards.createIndex('by-created-at', 'createdAt')
      }
      if (!db.objectStoreNames.contains(STORES.SCREENSHOTS)) {
        const screenshots = db.createObjectStore(STORES.SCREENSHOTS, { keyPath: 'cardId' })
        screenshots.createIndex('by-card-id', 'cardId')
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' }).createIndex('by-key', 'key')
      }
      if (!db.objectStoreNames.contains(STORES.VOCAB_CACHE)) {
        db.createObjectStore(STORES.VOCAB_CACHE, { keyPath: 'word' }).createIndex(
          'by-level',
          'level'
        )
      }
    },
    blocking() {
      // Another context needs a newer schema; let it upgrade and reconnect on next use.
      void database?.then(connection => connection.close())
      database = null
    },
  }).catch(error => {
    database = null
    throw error
  })
  return database
}

export const idbClient = {
  async getCards(): Promise<FlashCardRecord[]> {
    return (await db()).getAll(STORES.FLASHCARDS)
  },

  async getScreenshotIds(): Promise<Set<number>> {
    return new Set(await (await db()).getAllKeys(STORES.SCREENSHOTS))
  },

  async getScreenshot(cardId: number): Promise<ScreenshotRecord | undefined> {
    return (await db()).get(STORES.SCREENSHOTS, cardId)
  },

  async getScreenshots(): Promise<ScreenshotRecord[]> {
    return (await db()).getAll(STORES.SCREENSHOTS)
  },

  async putCards(cards: FlashCardRecord[], screenshots: ScreenshotRecord[]): Promise<void> {
    const tx = (await db()).transaction([STORES.FLASHCARDS, STORES.SCREENSHOTS], 'readwrite')
    await Promise.all([
      ...cards.map(card => tx.objectStore(STORES.FLASHCARDS).put(card)),
      ...screenshots.map(screenshot => tx.objectStore(STORES.SCREENSHOTS).put(screenshot)),
      tx.done,
    ])
  },

  async deleteCard(id: number): Promise<void> {
    const tx = (await db()).transaction([STORES.FLASHCARDS, STORES.SCREENSHOTS], 'readwrite')
    await Promise.all([
      tx.objectStore(STORES.FLASHCARDS).delete(id),
      tx.objectStore(STORES.SCREENSHOTS).delete(id),
      tx.done,
    ])
  },

  async clear(): Promise<void> {
    const tx = (await db()).transaction(
      [STORES.FLASHCARDS, STORES.SCREENSHOTS, STORES.VOCAB_CACHE],
      'readwrite'
    )
    await Promise.all([
      tx.objectStore(STORES.FLASHCARDS).clear(),
      tx.objectStore(STORES.SCREENSHOTS).clear(),
      tx.objectStore(STORES.VOCAB_CACHE).clear(),
      tx.done,
    ])
  },
}
