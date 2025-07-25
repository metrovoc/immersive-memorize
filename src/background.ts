// src/background.ts

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
