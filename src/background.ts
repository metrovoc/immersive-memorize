// src/background.ts

import { JapaneseAnalyzerService, type AnalyzeRequest } from './background/japanese-analyzer-service'
import { VocabLibraryService, type VocabRequest } from './background/vocab-library-service'

// 初始化中央化服务
const analyzerService = JapaneseAnalyzerService.getInstance()
const vocabService = VocabLibraryService.getInstance()

// Service Worker 启动时预热服务
chrome.runtime.onStartup.addListener(() => {
  console.log('[Background] Service Worker 启动，开始预热服务...')
  Promise.all([
    analyzerService.initialize(),
    vocabService.initialize()
  ]).catch(error => {
    console.error('[Background] 预热服务失败:', error)
  })
})

// 扩展安装/更新时也进行预热
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] 扩展安装/更新，开始预热服务...')
  Promise.all([
    analyzerService.initialize(),
    vocabService.initialize()
  ]).catch(error => {
    console.error('[Background] 预热服务失败:', error)
  })
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
      data: request.data
    }
    vocabService.handleRequest(vocabRequest)
      .then(response => sendResponse(response))
      .catch(error => {
        console.error('[Background] 词库请求处理失败:', error)
        sendResponse({
          requestId: vocabRequest.requestId,
          success: false,
          error: error instanceof Error ? error.message : '服务器内部错误'
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
