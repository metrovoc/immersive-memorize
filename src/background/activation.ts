import { createLogger, errorMessage } from '@/lib/logger'
import { matchesPattern, originPattern } from '@/lib/match-pattern'
import type { ContentMessage } from '@/lib/messages'
import { getSettings, type Settings } from '@/lib/settings'

const log = createLogger('activation')

const ACTIVE_ICON = { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' }
const INACTIVE_ICON = {
  16: 'icons/gray-icon16.png',
  48: 'icons/gray-icon48.png',
  128: 'icons/gray-icon128.png',
}

// Tabs the user activated from the popup, kept for the browser session so reloads stay active.
const ACTIVATED_TABS_KEY = 'activatedTabs'

function setIcon(tabId: number, active: boolean): void {
  chrome.action.setIcon({ tabId, path: active ? ACTIVE_ICON : INACTIVE_ICON }).catch(() => {
    // The tab was closed in the meantime.
  })
}

function isInjectable(url: string | undefined): url is string {
  return !!url && /^(https?|file):/.test(url)
}

export function shouldAutoEnable(url: string, settings: Settings): boolean {
  return (
    settings.autoEnableEverywhere ||
    settings.autoEnabledSites.some(pattern => matchesPattern(url, pattern))
  )
}

async function hasHostAccess(url: string): Promise<boolean> {
  const origin = originPattern(url)
  return !!origin && chrome.permissions.contains({ origins: [origin] })
}

async function isRunning(tabId: number): Promise<boolean> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'ping' } satisfies ContentMessage)
    return response?.pong === true
  } catch {
    return false
  }
}

async function inject(tabId: number): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['content-script.js'],
    })
    return true
  } catch (error) {
    log.debug(`Injecting into all frames of tab ${tabId} failed:`, errorMessage(error))
  }
  // Frames from other origins need host access; the top frame is covered by activeTab.
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content-script.js'] })
    return true
  } catch (error) {
    log.debug(`Injecting into tab ${tabId} failed:`, errorMessage(error))
    return false
  }
}

async function activatedTabs(): Promise<number[]> {
  const stored = await chrome.storage.session.get({ [ACTIVATED_TABS_KEY]: [] })
  return stored[ACTIVATED_TABS_KEY] as number[]
}

export async function forgetTab(tabId: number): Promise<void> {
  const tabs = await activatedTabs()
  if (tabs.includes(tabId)) {
    await chrome.storage.session.set({ [ACTIVATED_TABS_KEY]: tabs.filter(id => id !== tabId) })
  }
}

/** Starts the extension in a tab at the user's request (the popup grants activeTab). */
export async function activateTab(tabId: number): Promise<boolean> {
  const tab = await chrome.tabs.get(tabId)
  if (!isInjectable(tab.url)) {
    setIcon(tabId, false)
    return false
  }
  const tabs = await activatedTabs()
  if (!tabs.includes(tabId)) {
    await chrome.storage.session.set({ [ACTIVATED_TABS_KEY]: [...tabs, tabId] })
  }
  // Inject even if the script is already running: newly granted access may reach more frames,
  // and the script ignores repeated injection.
  const active = await inject(tabId)
  setIcon(tabId, active)
  return active
}

/** Starts the extension where settings or an earlier activation ask for it, and updates the icon. */
export async function refreshTab(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined) return
  if (!isInjectable(tab.url)) {
    setIcon(tab.id, false)
    return
  }
  let active = await isRunning(tab.id)
  if (!active) {
    const wanted =
      shouldAutoEnable(tab.url, await getSettings()) || (await activatedTabs()).includes(tab.id)
    active = wanted && (await hasHostAccess(tab.url)) && (await inject(tab.id))
  }
  setIcon(tab.id, active)
}

export async function refreshAllTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({})
  await Promise.all(tabs.map(refreshTab))
}
