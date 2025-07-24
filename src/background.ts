
// src/background.ts

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Check if it's a screenshot request
  if (request.action === 'captureVisibleTab') {
    // Ensure we have sender.tab object and tab.id
    if (sender.tab && sender.tab.id) {
      chrome.tabs.captureVisibleTab(
        sender.tab.windowId,
        { format: 'jpeg', quality: 90 }, // Use lossy JPEG format with high quality
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            // If there's an error (e.g., user denies permission), log it and send back null
            console.error('Screenshot failed:', chrome.runtime.lastError.message);
            sendResponse({ data: null, error: chrome.runtime.lastError.message });
          } else {
            // Success, send back the Base64 encoded image data
            sendResponse({ data: dataUrl });
          }
        }
      );
    } else {
      console.error('Could not get sender tab information.');
      sendResponse({ data: null, error: 'Could not get sender tab information.' });
    }
    // Return true to indicate that we will send a response asynchronously
    return true;
  }
});
