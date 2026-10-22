import type { FlashCard } from '@/types'
import { idbClient } from './idb-client'
import { markCardsChanged } from './revision'
import type { FlashCardRecord, ScreenshotRecord } from './types'

export { migrateLegacyCards } from './legacy-cards'
export { onCardsChanged } from './revision'

/** Flashcard storage for extension pages and the service worker, which share one IndexedDB. */
export const cardStore = {
  /** All cards, newest first. Screenshot data is only attached when requested. */
  async getCards({ withScreenshots = false } = {}): Promise<FlashCard[]> {
    const cards = await idbClient.getCards()
    const screenshots = withScreenshots
      ? new Map((await idbClient.getScreenshots()).map(shot => [shot.cardId, shot.data]))
      : null
    const screenshotIds = screenshots ? null : await idbClient.getScreenshotIds()
    return cards
      .map(card => ({
        ...card,
        screenshot: screenshots?.get(card.id) ?? '',
        hasScreenshot: screenshots ? screenshots.has(card.id) : screenshotIds!.has(card.id),
      }))
      .sort((a, b) => b.id - a.id)
  },

  async getScreenshot(cardId: number): Promise<string> {
    return (await idbClient.getScreenshot(cardId))?.data ?? ''
  },

  async getLearnedWords(): Promise<string[]> {
    return (await idbClient.getCards()).map(card => card.word)
  },

  /** Adds or replaces cards, keeping screenshots in their own store. */
  async putCards(cards: FlashCard[]): Promise<void> {
    const records: FlashCardRecord[] = []
    const screenshots: ScreenshotRecord[] = []
    for (const { screenshot, hasScreenshot: _hasScreenshot, ...record } of cards) {
      records.push(record)
      if (screenshot)
        screenshots.push({ cardId: record.id, data: screenshot, createdAt: record.createdAt })
    }
    await idbClient.putCards(records, screenshots)
    await markCardsChanged()
  },

  async deleteCard(cardId: number): Promise<void> {
    await idbClient.deleteCard(cardId)
    await markCardsChanged()
  },

  async clear(): Promise<void> {
    await idbClient.clear()
    await markCardsChanged()
  },
}
