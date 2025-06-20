(function() {
    'use strict';
    
    let jlptWordlist = [];
    let currentHoveredElement = null;
    let observer = null;
    let captureHotkey = 's';
    let debugMode = true;
    
    async function init() {
        try {
            const result = await chrome.storage.local.get(['jlptWordlist', 'captureHotkey', 'debugMode']);
            jlptWordlist = result.jlptWordlist || [];
            captureHotkey = result.captureHotkey || 's';
            debugMode = result.debugMode !== false;
            
            if (debugMode) {
                console.log(`[Immersive Memorize] 已加载 ${jlptWordlist.length} 个词汇`);
                console.log(`[Immersive Memorize] 捕获快捷键: ${captureHotkey.toUpperCase()}`);
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
                            highlightWords(container);
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
    
    function highlightWords(container) {
        if (!container || jlptWordlist.length === 0) return;
        
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
        
        textNodes.forEach(textNode => {
            let text = textNode.textContent;
            let hasHighlight = false;
            
            jlptWordlist.forEach(word => {
                if (word && text.includes(word)) {
                    const regex = new RegExp(`(${escapeRegExp(word)})`, 'g');
                    text = text.replace(regex, '<span class="im-highlight">$1</span>');
                    hasHighlight = true;
                }
            });
            
            if (hasHighlight) {
                const span = document.createElement('span');
                span.innerHTML = text;
                textNode.parentNode.replaceChild(span, textNode);
            }
        });
        
        const highlights = container.querySelectorAll('.im-highlight');
        highlights.forEach(highlight => {
            highlight.style.backgroundColor = '#ffeb3b';
            highlight.style.color = '#000';
            highlight.style.padding = '1px 2px';
            highlight.style.borderRadius = '2px';
            highlight.style.cursor = 'pointer';
            highlight.style.fontWeight = 'bold';
            
            highlight.addEventListener('mouseenter', (e) => {
                currentHoveredElement = e.target;
                e.target.style.backgroundColor = '#ff9800';
                
                if (debugMode) {
                    console.log('[Immersive Memorize] 鼠标悬停:', e.target.innerText);
                }
            });
            
            highlight.addEventListener('mouseleave', (e) => {
                if (currentHoveredElement === e.target) {
                    currentHoveredElement = null;
                }
                e.target.style.backgroundColor = '#ffeb3b';
                
                if (debugMode) {
                    console.log('[Immersive Memorize] 鼠标离开');
                }
            });
        });
    }
    
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    function setupEventListeners() {
        // 多重按键监听策略
        const keyHandler = async (e) => {
            if (debugMode && e.key.toLowerCase() === captureHotkey.toLowerCase()) {
                console.log('[Immersive Memorize] 按键检测:', {
                    key: e.key,
                    target: e.target,
                    hoveredElement: currentHoveredElement,
                    prevented: e.defaultPrevented
                });
            }
            
            if (e.key.toLowerCase() === captureHotkey.toLowerCase() && currentHoveredElement) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                if (debugMode) {
                    console.log('[Immersive Memorize] 开始捕获数据...');
                }
                
                await captureData();
            }
        };
        
        // 在不同阶段添加事件监听器
        document.addEventListener('keydown', keyHandler, true); // 捕获阶段
        document.addEventListener('keydown', keyHandler, false); // 冒泡阶段
        window.addEventListener('keydown', keyHandler, true);
        
        // 额外的安全措施：直接在 body 上监听
        if (document.body) {
            document.body.addEventListener('keydown', keyHandler, true);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                document.body.addEventListener('keydown', keyHandler, true);
            });
        }
        
        if (debugMode) {
            console.log('[Immersive Memorize] 按键监听器已设置');
        }
    }
    
    async function captureData() {
        if (!currentHoveredElement) return;
        
        try {
            const word = currentHoveredElement.innerText;
            const sentenceElement = currentHoveredElement.closest(
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
            
            if (debugMode) {
                console.log(`[Immersive Memorize] 已保存卡片:`, cardData);
            }
            showNotification(`已保存: ${word}`);
            
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
        const bgColor = type === 'error' ? '#f44336' : '#4caf50';
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            z-index: 999999;
            font-family: Arial, sans-serif;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            border: 2px solid rgba(255,255,255,0.3);
            max-width: 300px;
            word-wrap: break-word;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, type === 'error' ? 4000 : 2000);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();