import { createLogger } from '@/lib/logger'
import type { FlashCard } from '@/types'
import { idbClient } from './idb-client'
import { markCardsChanged } from './revision'

const log = createLogger('migration')

/** Moves cards saved by versions before 0.10 from chrome.storage.local into IndexedDB. */
export async function migrateLegacyCards(): Promise<void> {
  const { savedCards } = await chrome.storage.local.get('savedCards')
  if (!Array.isArray(savedCards) || savedCards.length === 0) return

  const cards = savedCards as FlashCard[]
  await idbClient.putCards(
    cards.map(({ screenshot: _screenshot, ...card }) => card),
    cards
      .filter(card => card.screenshot)
      .map(card => ({ cardId: card.id, data: card.screenshot, createdAt: card.createdAt }))
  )
  await chrome.storage.local.remove('savedCards')
  await markCardsChanged()
  log.debug(`Moved ${cards.length} cards to IndexedDB`)
}
