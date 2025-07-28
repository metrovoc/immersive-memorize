// src/background.ts

import {
  JapaneseAnalyzerService,
  type AnalyzeRequest,
} from './background/japanese-analyzer-service'
import { VocabLibraryService, type VocabRequest } from './background/vocab-library-service'
import { storageService, migrationManager } from './lib/storage'

// --- New State and Configuration ---
// Tracks which tabs have been manually activated by the user clicking the icon.
const manuallyActivatedTabs = new Set<number>()

// Tracks which tabs already have the content script injected to prevent duplicate injection.
const injectedTabs = new Set<number>()

// Configuration loaded from user settings
let activationSettings = {
  globalAutoEnable: false,
  autoEnabledSites: ['*://*.netflix.com/*'],
}

// Track if settings have been loaded to prevent race conditions
let settingsLoaded = false

// --- Service Initialization ---
const analyzerService = JapaneseAnalyzerService.getInstance()
const vocabService = VocabLibraryService.getInstance()

// Load settings immediately when background script starts
loadActivationSettings().then(() => {
  console.log('[Background] Initial settings load completed')
})

// 启动数据迁移检查
console.log('[Background] 开始启动迁移检查...')
migrationManager.migrate().then(() => {
  console.log('[Background] Data migration check completed')
}).catch(error => {
  console.error('[Background] Data migration failed:', error)
})

/**
 * Pre-warms services to ensure they are ready when needed.
 */
async function warmupServices(): Promise<void> {
  console.log('[Background] Warming up services...')
  try {
    await Promise.all([analyzerService.initialize(), vocabService.initialize()])
    console.log('[Background] Services warmed up successfully.')
  } catch (error) {
    console.error('[Background] Failed to warm up services:', error)
  }
}

/**
 * Loads activation settings from storage.
 */
async function loadActivationSettings(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(['activationSettings'])
    if (result.activationSettings) {
      activationSettings = { ...activationSettings, ...result.activationSettings }
    }
    settingsLoaded = true
    console.log('[Background] Activation settings loaded:', activationSettings)
  } catch (error) {
    console.error('[Background] Failed to load activation settings:', error)
    settingsLoaded = true // Mark as loaded even on error to prevent infinite waiting
  }
}

// --- Icon and Activation Logic ---

/**
 * Sets the extension icon.
 * @param {boolean} active - Whether to show the active (blue) or inactive (grey) icon.
 * @param {number} tabId - The ID of the tab to change the icon for.
 */
function setIcon(active: boolean, tabId: number): void {
  const path = active
    ? {
        '16': 'icons/icon16.png',
        '48': 'icons/icon48.png',
        '128': 'icons/icon128.png',
      }
    : {
        '16': 'icons/gray-icon16.png',
        '48': 'icons/gray-icon48.png',
        '128': 'icons/gray-icon128.png',
      }
  chrome.action.setIcon({ path, tabId })
}

/**
 * Checks if the content script is already running in the specified tab.
 * @param {number} tabId - The ID of the tab to check.
 * @returns {Promise<boolean>} - True if script is already running.
 */
async function isScriptAlreadyInjected(tabId: number): Promise<boolean> {
  try {
    // Try to send a ping message to the content script
    const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' })
    return response && response.pong === true
  } catch (error) {
    // If sendMessage fails, the script is not injected
    return false
  }
}

/**
 * Injects the content script into the specified tab and activates the extension.
 * @param {number} tabId - The ID of the tab to activate on.
 */
async function activateOnTab(tabId: number): Promise<void> {
  try {
    // Check if script is already running by sending a ping
    const alreadyInjected = await isScriptAlreadyInjected(tabId)
    if (alreadyInjected) {
      console.log(`[Background] Script already running on tab ${tabId}, skipping injection`)
      injectedTabs.add(tabId) // Ensure it's tracked
      setIcon(true, tabId)
      return
    }

    console.log(`[Background] Activating on tab ${tabId}`)
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true }, // Enable injection into all frames (including iframes)
      files: ['content-script.js'],
    })

    // Mark tab as injected and set active icon
    injectedTabs.add(tabId)
    setIcon(true, tabId)
    console.log(
      `[Background] Successfully injected script on tab ${tabId} (including all frames)`,
      injectionResults
    )
  } catch (error) {
    console.error(`[Background] Failed to inject script on tab ${tabId}:`, error)
    // If injection fails, show the inactive icon and remove from injected set
    injectedTabs.delete(tabId)
    setIcon(false, tabId)
  }
}

/**
 * Checks a tab's URL against enabled sites and its manual activation status,
 * then updates the icon and injects scripts if necessary.
 * @param {chrome.tabs.Tab} tab - The tab to check.
 */
async function updateTabState(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id || !tab.url) {
    return
  }

  // Wait for settings to be loaded before processing
  if (!settingsLoaded) {
    console.log(`[Background] Settings not loaded yet, waiting for tab ${tab.id}`)
    // Wait for settings to load, then retry
    setTimeout(() => updateTabState(tab), 100)
    return
  }

  // Ignore chrome-specific URLs
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    setIcon(false, tab.id)
    return
  }

  const isAutoEnabled =
    activationSettings.globalAutoEnable ||
    activationSettings.autoEnabledSites.some((pattern: string) =>
      new URL(tab.url!).href.match(new RegExp(pattern.replace(/\*/g, '.*')))
    )

  console.log(
    `[Background] Tab ${tab.id} (${tab.url}): globalAutoEnable=${activationSettings.globalAutoEnable}, isAutoEnabled=${isAutoEnabled}`
  )

  if (isAutoEnabled) {
    await activateOnTab(tab.id)
  } else if (manuallyActivatedTabs.has(tab.id)) {
    // If it was manually activated, keep it active (e.g., on reload)
    await activateOnTab(tab.id)
  } else {
    setIcon(false, tab.id)
  }
}

// --- Event Listeners ---

// Initialize when extension starts up (browser restart)
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Background] Extension startup.')
  await loadActivationSettings()
  warmupServices()
})

// Warm up services when the extension is installed or updated.
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Background] Extension installed/updated.')
  await loadActivationSettings()
  warmupServices()
})

// Update icon and activation state when a tab is updated (e.g., reloaded).
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Clear injection state when tab starts loading (page navigation/refresh)
  if (changeInfo.status === 'loading') {
    if (injectedTabs.has(tabId)) {
      injectedTabs.delete(tabId)
      console.log(`[Background] Tab ${tabId} is loading, cleared injection state`)
    }
  }

  // Wait for the tab to finish loading before checking its state.
  if (changeInfo.status === 'complete' && tab.url) {
    console.log(`[Background] Tab updated: ${tabId}, status: ${changeInfo.status}`)
    updateTabState(tab)
  }
})

// Update icon when the user switches to a different tab.
chrome.tabs.onActivated.addListener(activeInfo => {
  console.log(`[Background] Tab activated: ${activeInfo.tabId}`)
  chrome.tabs.get(activeInfo.tabId, tab => {
    if (!chrome.runtime.lastError) {
      updateTabState(tab)
    }
  })
})

// Handle new tab creation for auto-activation
chrome.tabs.onCreated.addListener(tab => {
  console.log(`[Background] New tab created: ${tab.id}`)
  // New tabs don't have URL immediately, wait for them to load
  // The onUpdated listener will handle the actual activation when the page loads
})

// Clean up tabs from the manually activated and injected sets when they are closed.
chrome.tabs.onRemoved.addListener(tabId => {
  if (manuallyActivatedTabs.has(tabId)) {
    manuallyActivatedTabs.delete(tabId)
    console.log(`[Background] Removed manually activated tab from set: ${tabId}`)
  }
  if (injectedTabs.has(tabId)) {
    injectedTabs.delete(tabId)
    console.log(`[Background] Removed injected tab from set: ${tabId}`)
  }
})

/**
 * Handle video selection request from popup
 */
async function handleVideoSelectionRequest(sendResponse: (response?: any) => void): Promise<void> {
  try {
    // Get the current active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })

    if (tabs.length === 0) {
      sendResponse({ success: false, error: '无法找到当前标签页' })
      return
    }

    const activeTab = tabs[0]

    if (!activeTab.id) {
      sendResponse({ success: false, error: '标签页ID无效' })
      return
    }

    // Check if the tab has a valid URL (not chrome:// or extension pages)
    if (
      !activeTab.url ||
      activeTab.url.startsWith('chrome://') ||
      activeTab.url.startsWith('chrome-extension://')
    ) {
      sendResponse({ success: false, error: '当前页面不支持此功能' })
      return
    }

    // Send message to content script
    chrome.tabs.sendMessage(activeTab.id, { type: 'INITIATE_VIDEO_SELECTION' }, response => {
      if (chrome.runtime.lastError) {
        console.error('Failed to send message to content script:', chrome.runtime.lastError)
        sendResponse({
          success: false,
          error: '内容脚本未响应，请刷新页面后重试',
        })
      } else {
        sendResponse({ success: true, data: response })
      }
    })
  } catch (error) {
    console.error('Error in handleVideoSelectionRequest:', error)
    sendResponse({
      success: false,
      error: '启动失败：' + (error instanceof Error ? error.message : '未知错误'),
    })
  }
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // New handler for activating the extension on the current tab.
  if (request.type === 'ACTIVATE_ON_CURRENT_TAB') {
    // Get the current active tab since popup messages don't have sender.tab
    chrome.tabs.query({ active: true, currentWindow: true }, async tabs => {
      if (tabs.length === 0 || !tabs[0].id) {
        console.error('[Background] No active tab found for activation.')
        sendResponse({ success: false, error: 'No active tab found.' })
        return
      }

      const tabId = tabs[0].id
      console.log(`[Background] Received activation request for tab ${tabId}`)
      manuallyActivatedTabs.add(tabId)

      try {
        await activateOnTab(tabId)
        sendResponse({ success: true })
      } catch (error) {
        console.error(`[Background] Failed to activate on tab ${tabId}:`, error)
        sendResponse({ success: false, error: 'Activation failed.' })
      }
    })
    return true // Keep channel open for async response.
  }

  // Handle activation settings update from options page
  if (request.type === 'UPDATE_ACTIVATION_SETTINGS') {
    activationSettings = { ...activationSettings, ...request.settings }
    console.log('[Background] Activation settings updated:', activationSettings)

    // Update all existing tabs' icons based on new settings
    chrome.tabs.query({}, tabs => {
      tabs.forEach(tab => {
        if (tab.id && tab.url) {
          updateTabState(tab)
        }
      })
    })

    sendResponse({ success: true })
    return true
  }

  // Handle video selection initiation from popup
  if (request.type === 'INITIATE_VIDEO_SELECTION') {
    handleVideoSelectionRequest(sendResponse)
    return true // Keep sendResponse alive for async response
  }

  // Handle Japanese text analysis requests
  if (request.type === 'ANALYZE_TEXT') {
    const analyzeRequest = request as AnalyzeRequest
    analyzerService.handleAnalyzeRequest(analyzeRequest, sendResponse)
    return true // Keep sendResponse alive for async response
  }

  // Handle analyzer service status requests
  if (request.type === 'GET_ANALYZER_STATUS') {
    const status = analyzerService.getStatus()
    sendResponse({ success: true, status })
    return true
  }

  // Handle vocab library requests
  if (request.type === 'VOCAB_REQUEST') {
    const vocabRequest: VocabRequest = {
      requestId: request.requestId,
      type: request.requestType,
      data: request.data,
    }
    vocabService
      .handleRequest(vocabRequest)
      .then(response => sendResponse(response))
      .catch(error => {
        console.error('[Background] 词库请求处理失败:', error)
        sendResponse({
          requestId: vocabRequest.requestId,
          success: false,
          error: error instanceof Error ? error.message : '服务器内部错误',
        })
      })
    return true // Keep sendResponse alive for async response
  }

  // Handle vocab service status requests
  if (request.type === 'GET_VOCAB_STATUS') {
    const status = vocabService.getStatus()
    sendResponse({ success: true, status })
    return true
  }

  // Handle storage requests
  if (request.type && ['GET_CARDS', 'ADD_CARD', 'DELETE_CARD', 'GET_CARDS_BY_LEVEL', 'GET_LEARNED_WORDS', 'GET_SCREENSHOT', 'CLEAR_ALL_DATA', 'MIGRATE_DATA'].includes(request.type)) {
    console.log('[Background] 收到存储请求:', request.type, request.payload ? 'with payload' : 'no payload')
    
    const storageMessage = {
      type: request.type,
      payload: request.payload
    }
    
    storageService.handleStorageMessage(storageMessage)
      .then(response => {
        console.log('[Background] 存储请求处理完成:', request.type, response.success ? 'success' : 'failed')
        sendResponse(response)
      })
      .catch(error => {
        console.error('[Background] Storage request failed:', error)
        sendResponse({ success: false, error: error.message })
      })
    
    return true // Keep sendResponse alive for async response
  }

  // Check if it's a screenshot request
  if (request.action === 'captureVisibleTab') {
    // Ensure we have sender.tab object and tab.id
    if (sender.tab && sender.tab.id) {
      chrome.tabs.captureVisibleTab(
        sender.tab.windowId,
        { format: 'jpeg', quality: 90 }, // Use lossy JPEG format with high quality
        dataUrl => {
          if (chrome.runtime.lastError) {
            // If there's an error (e.g., user denies permission), log it and send back null
            console.error('Screenshot failed:', chrome.runtime.lastError.message)
            sendResponse({ data: null, error: chrome.runtime.lastError.message })
          } else {
            // Success, send back the Base64 encoded image data
            sendResponse({ data: dataUrl })
          }
        }
      )
    } else {
      console.error('Could not get sender tab information.')
      sendResponse({ data: null, error: 'Could not get sender tab information.' })
    }
    // Return true to indicate that we will send a response asynchronously
    return true
  }
})
