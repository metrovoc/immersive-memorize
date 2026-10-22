import { activateTab, forgetTab, refreshAllTabs, refreshTab } from './background/activation'
import { captureScreenshot } from './background/screenshot'
import { definitionLanguage } from './lib/i18n'
import { analyze } from './lib/japanese-analyzer'
import { getTokenizer } from './lib/japanese-analyzer/kuromoji-loader'
import { createLogger, errorMessage, setDebugLogging } from './lib/logger'
import type { BackgroundApi, BackgroundRequest } from './lib/messages'
import { getSettings, migrateLegacySettings, onSettingsChanged } from './lib/settings'
import { cardStore, migrateLegacyCards } from './lib/storage'
import { Vocabulary } from './lib/vocab'

const log = createLogger('background')

// Data from earlier versions is migrated on every start, so an interrupted run finishes later.
const migrated = (async () => {
  try {
    await migrateLegacySettings()
    await migrateLegacyCards()
  } catch (error) {
    log.error('Migrating data from an earlier version failed:', error)
  }
})()

let vocabulary: Promise<Vocabulary> | null = null

function loadVocabulary(): Promise<Vocabulary> {
  vocabulary ??= Vocabulary.load().catch(error => {
    vocabulary = null
    throw error
  })
  return vocabulary
}

type Handlers = {
  [K in keyof BackgroundApi]: (
    params: BackgroundApi[K]['params'],
    sender: chrome.runtime.MessageSender
  ) => Promise<BackgroundApi[K]['result']>
}

const handlers: Handlers = {
  activateTab: ({ tabId }) => activateTab(tabId),
  analyzeText: ({ text }) => analyze(text),
  async getActiveWords() {
    // A page is about to analyze subtitles, so start building the tokenizer now.
    void getTokenizer()
    const [words, settings] = await Promise.all([loadVocabulary(), getSettings()])
    return words.activeWords(settings.enabledLevels)
  },
  async lookupWord({ word }) {
    return (await loadVocabulary()).lookup(word, definitionLanguage())
  },
  async captureScreenshot({ crop }, sender) {
    if (!sender.tab) throw new Error('Screenshots can only be taken from a tab')
    return captureScreenshot(sender.tab, crop)
  },
  async addCard({ card }) {
    await cardStore.putCards([card])
    return null
  },
  getLearnedWords: () => cardStore.getLearnedWords(),
}

chrome.runtime.onMessage.addListener((message: BackgroundRequest, sender, sendResponse) => {
  const handler = handlers[message?.type] as
    ((params: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown>) | undefined
  if (!handler) return false
  migrated
    .then(() => handler(message, sender))
    .then(
      result => sendResponse({ ok: true, result }),
      error => {
        log.error(`${message.type} failed:`, error)
        sendResponse({ ok: false, error: errorMessage(error) })
      }
    )
  return true
})

chrome.runtime.onInstalled.addListener(() => void migrated.then(refreshAllTabs))

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') void refreshTab(tab)
})

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId).then(refreshTab, () => {
    // The tab was closed before it could be inspected.
  })
})

chrome.tabs.onRemoved.addListener(tabId => void forgetTab(tabId))

chrome.permissions.onAdded.addListener(() => void refreshAllTabs())

void migrated.then(getSettings).then(settings => setDebugLogging(settings.debugMode))

onSettingsChanged(patch => {
  if (patch.debugMode !== undefined) setDebugLogging(patch.debugMode)
  if (patch.autoEnableEverywhere !== undefined || patch.autoEnabledSites !== undefined) {
    void refreshAllTabs()
  }
})
