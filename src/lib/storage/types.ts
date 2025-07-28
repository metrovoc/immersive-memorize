import type { FlashCard } from '@/types'

// IndexedDB 数据库结构
export interface FlashCardDB extends Omit<FlashCard, 'screenshot'> {
  id: number
  // screenshot 单独存储
}

export interface ScreenshotDB {
  cardId: number  // 关联到 flashcard.id
  data: string    // base64 数据
  createdAt: string
}

export interface SettingDB {
  key: string     // 设置键名
  value: any      // 设置值
  updatedAt: string
}

export interface VocabCacheDB {
  word: string    // 词汇
  level: string   // JLPT等级
  definition: string
  reading: string
  cachedAt: string
}

// 数据库配置
export const DB_NAME = 'immersive-memorize-v2'
export const DB_VERSION = 1

// Object Store 名称
export const STORES = {
  FLASHCARDS: 'flashcards',
  SCREENSHOTS: 'screenshots', 
  SETTINGS: 'settings',
  VOCAB_CACHE: 'vocab_cache'
} as const

// 索引配置
export const INDEXES = {
  FLASHCARDS: {
    BY_WORD: 'by-word',
    BY_LEVEL: 'by-level', 
    BY_CREATED_AT: 'by-created-at'
  },
  SCREENSHOTS: {
    BY_CARD_ID: 'by-card-id'
  },
  SETTINGS: {
    BY_KEY: 'by-key'
  },
  VOCAB_CACHE: {
    BY_LEVEL: 'by-level'
  }
} as const

// 存储服务消息类型
export interface StorageMessage {
  type: 'GET_CARDS' | 'ADD_CARD' | 'DELETE_CARD' | 'GET_CARDS_BY_LEVEL' | 
        'GET_LEARNED_WORDS' | 'GET_SCREENSHOT' | 'CLEAR_ALL_DATA' | 'MIGRATE_DATA'
  payload?: any
}

export interface StorageResponse {
  success: boolean
  data?: any
  error?: string
}