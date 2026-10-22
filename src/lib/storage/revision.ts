/** Bumped after every flashcard change so other extension contexts can refresh. */
const REVISION_KEY = 'cardsRevision'

export function markCardsChanged(): Promise<void> {
  return chrome.storage.local.set({ [REVISION_KEY]: Date.now() })
}

export function onCardsChanged(listener: () => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && REVISION_KEY in changes) listener()
  })
}
