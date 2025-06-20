(function() {
    'use strict';
    
    let jlptWordlist = [];
    let learnedWords = new Set(); // 已学过的单词集合
    let currentTargetWord = null; // 当前目标单词
    let currentTargetElement = null; // 当前目标元素
    let observer = null;
    let captureHotkey = 's';
    let debugMode = true;
    
    async function init() {
        try {
            const result = await chrome.storage.local.get(['jlptWordlist', 'captureHotkey', 'debugMode', 'savedCards']);
            jlptWordlist = result.jlptWordlist || [];
            captureHotkey = result.captureHotkey || 's';
            debugMode = result.debugMode !== false;
            
            // 加载已学词汇
            const savedCards = result.savedCards || [];
            learnedWords = new Set(savedCards.map(card => card.word));
            
            if (debugMode) {
                console.log(`[Immersive Memorize] 已加载 ${jlptWordlist.length} 个词汇`);
                console.log(`[Immersive Memorize] 已学 ${learnedWords.size} 个词汇`);
                console.log(`[Immersive Memorize] 捕获快捷键: ${captureHotkey.toUpperCase()}`);
                console.log(`[Immersive Memorize] 顺序学习模式：每次仅显示一个生词`);
            }
            
            startSubtitleObserver();
            setupEventListeners();
        } catch (error) {
            console.error('[Immersive Memorize] 初始化失败:', error);
        }
    }
    
    function startSubtitleObserver() {
        const targetNode = document.body;
        
        observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'subtree') {
                    const subtitleContainers = document.querySelectorAll(
                        '.player-timedtext-text-container, ' +
                        '.ltr-1472gpj, ' +
                        '[data-uia="player-caption-text"]'
                    );
                    
                    subtitleContainers.forEach(container => {
                        if (!container.dataset.imProcessed) {
                            highlightFirstUnlearnedWord(container);
                            container.dataset.imProcessed = 'true';
                        }
                    });
                }
            });
        });
        
        observer.observe(targetNode, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }
    
    function highlightFirstUnlearnedWord(container) {
        if (!container || jlptWordlist.length === 0) return;
        
        // 清除之前的高亮
        clearAllHighlights();
        
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        const textNodes = [];
        let node;
        
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }
        
        // 查找第一个未学的词汇
        for (let textNode of textNodes) {
            const text = textNode.textContent;
            
            for (let word of jlptWordlist) {
                if (word && text.includes(word) && !learnedWords.has(word)) {
                    // 找到第一个未学词汇，高亮它
                    highlightSingleWord(textNode, word);
                    currentTargetWord = word;
                    
                    if (debugMode) {
                        console.log(`[Immersive Memorize] 当前目标词汇: ${word}`);
                    }
                    
                    return; // 只高亮第一个找到的词汇
                }
            }
        }
        
        // 如果没有找到未学词汇
        currentTargetWord = null;
        currentTargetElement = null;
        
        if (debugMode) {
            console.log('[Immersive Memorize] 当前字幕无未学词汇');
        }
    }
    
    function highlightSingleWord(textNode, word) {
        const text = textNode.textContent;
        const wordIndex = text.indexOf(word);
        
        if (wordIndex === -1) return;
        
        // 分割文本节点
        const beforeText = text.substring(0, wordIndex);
        const afterText = text.substring(wordIndex + word.length);
        
        // 创建高亮元素
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'im-highlight im-current-target';
        highlightSpan.textContent = word;
        highlightSpan.style.cssText = `
            background-color: #ff9800 !important;
            color: #000 !important;
            padding: 2px 4px !important;
            border-radius: 4px !important;
            font-weight: bold !important;
            border: 2px solid #f57c00 !important;
            box-shadow: 0 0 8px rgba(255, 152, 0, 0.6) !important;
            animation: pulse 2s infinite !important;
        `;
        
        // 添加脉冲动画
        if (!document.getElementById('im-target-styles')) {
            const style = document.createElement('style');
            style.id = 'im-target-styles';
            style.textContent = `
                @keyframes pulse {
                    0% { box-shadow: 0 0 8px rgba(255, 152, 0, 0.6); }
                    50% { box-shadow: 0 0 15px rgba(255, 152, 0, 0.9); }
                    100% { box-shadow: 0 0 8px rgba(255, 152, 0, 0.6); }
                }
            `;
            document.head.appendChild(style);
        }
        
        const parent = textNode.parentNode;
        
        // 插入分割后的内容
        if (beforeText) {
            parent.insertBefore(document.createTextNode(beforeText), textNode);
        }
        
        parent.insertBefore(highlightSpan, textNode);
        
        if (afterText) {
            parent.insertBefore(document.createTextNode(afterText), textNode);
        }
        
        // 移除原始文本节点
        parent.removeChild(textNode);
        
        // 设置当前目标元素
        currentTargetElement = highlightSpan;
    }
    
    function clearAllHighlights() {
        const highlights = document.querySelectorAll('.im-highlight');
        highlights.forEach(highlight => {
            const parent = highlight.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
                parent.normalize();
            }
        });
        
        currentTargetElement = null;
    }
    
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    function setupEventListeners() {
        const keyHandler = async (e) => {
            if (e.key.toLowerCase() === captureHotkey.toLowerCase()) {
                if (!currentTargetWord) {
                    if (debugMode) {
                        console.log('[Immersive Memorize] 当前无目标词汇，忽略按键');
                    }
                    showNotification('当前无生词可学习', 'info');
                    return;
                }
                
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                if (debugMode) {
                    console.log(`[Immersive Memorize] 开始学习: ${currentTargetWord}`);
                }
                
                await captureData();
            }
        };
        
        // 简化的事件监听
        document.addEventListener('keydown', keyHandler, true);
        window.addEventListener('keydown', keyHandler, true);
        
        if (debugMode) {
            console.log('[Immersive Memorize] 按键监听器已设置（顺序学习模式）');
        }
    }
    
    async function captureData() {
        if (!currentTargetWord || !currentTargetElement) return;
        
        try {
            const word = currentTargetWord;
            
            // 检查是否已经学过这个词
            if (learnedWords.has(word)) {
                showNotification(`${word} 已存在`, 'warning');
                return;
            }
            
            const sentenceElement = currentTargetElement.closest(
                '.player-timedtext-text-container, .ltr-1472gpj, [data-uia="player-caption-text"]'
            );
            const sentence = sentenceElement ? sentenceElement.innerText : '';
            
            const videoElement = document.querySelector('video');
            const timestamp = videoElement ? Math.floor(videoElement.currentTime) : 0;
            
            const screenshot = await captureVideoFrame(videoElement);
            
            const sourceTitle = document.title.replace(' - Netflix', '') || 'Unknown';
            
            const cardData = {
                id: Date.now(),
                word: word,
                sentence: sentence,
                timestamp: timestamp,
                screenshot: screenshot,
                sourceTitle: sourceTitle,
                createdAt: new Date().toISOString()
            };
            
            const result = await chrome.storage.local.get(['savedCards']);
            const savedCards = result.savedCards || [];
            savedCards.push(cardData);
            
            await chrome.storage.local.set({ savedCards: savedCards });
            
            // 立即添加到已学词汇集合
            learnedWords.add(word);
            
            // 清除当前高亮并寻找下一个词汇
            clearAllHighlights();
            currentTargetWord = null;
            currentTargetElement = null;
            
            // 重新扫描当前字幕寻找下一个生词
            setTimeout(() => {
                const subtitleContainers = document.querySelectorAll(
                    '.player-timedtext-text-container, ' +
                    '.ltr-1472gpj, ' +
                    '[data-uia="player-caption-text"]'
                );
                
                subtitleContainers.forEach(container => {
                    container.dataset.imProcessed = '';
                    highlightFirstUnlearnedWord(container);
                });
            }, 100);
            
            if (debugMode) {
                console.log(`[Immersive Memorize] 已保存卡片:`, cardData);
            }
            
            showNotification(`✓ ${word} 已学习`);
            
        } catch (error) {
            console.error('[Immersive Memorize] 捕获数据失败:', error);
            showNotification('保存失败: ' + error.message, 'error');
        }
    }
    
    async function captureVideoFrame(videoElement) {
        if (!videoElement) return '';
        
        try {
            const canvas = document.createElement('canvas');
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoElement, 0, 0);
            
            return canvas.toDataURL('image/png');
        } catch (error) {
            console.error('[Immersive Memorize] 截图失败:', error);
            return '';
        }
    }
    
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        let bgColor, icon;
        
        switch(type) {
            case 'error':
                bgColor = '#f44336';
                icon = '✗';
                break;
            case 'warning':
                bgColor = '#ff9800';
                icon = '⚠';
                break;
            case 'info':
                bgColor = '#2196f3';
                icon = 'ℹ';
                break;
            default:
                bgColor = '#4caf50';
                icon = '✓';
        }
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 999999;
            font-family: Arial, sans-serif;
            font-size: 16px;
            font-weight: bold;
            box-shadow: 0 4px 16px rgba(0,0,0,0.3);
            border: 2px solid rgba(255,255,255,0.2);
            max-width: 350px;
            word-wrap: break-word;
            animation: slideIn 0.3s ease-out;
        `;
        
        notification.textContent = `${icon} ${message}`;
        
        // 添加CSS动画
        if (!document.getElementById('im-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'im-notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        const duration = type === 'error' ? 4000 : type === 'warning' ? 3000 : 2000;
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.transform = 'translateX(100%)';
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, duration);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();