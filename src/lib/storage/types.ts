import type { FlashCard } from '@/types'

/** A flashcard as stored; screenshots live in their own store. */
export type FlashCardRecord = Omit<FlashCard, 'screenshot' | 'hasScreenshot'>

export interface ScreenshotRecord {
  cardId: number
  /** JPEG data URL. */
  data: string
  createdAt: string
}

export const DB_NAME = 'immersive-memorize-v2'
export const DB_VERSION = 1

export const STORES = {
  FLASHCARDS: 'flashcards',
  SCREENSHOTS: 'screenshots',
  // Created by version 1 of the schema and kept so existing databases stay valid.
  SETTINGS: 'settings',
  VOCAB_CACHE: 'vocab_cache',
} as const
