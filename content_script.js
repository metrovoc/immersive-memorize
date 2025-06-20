(function() {
    'use strict';
    
    let jlptWordlist = [];
    let currentHoveredElement = null;
    let observer = null;
    
    async function init() {
        try {
            const result = await chrome.storage.local.get(['jlptWordlist']);
            jlptWordlist = result.jlptWordlist || [];
            console.log(`[Immersive Memorize] 已加载 ${jlptWordlist.length} 个词汇`);
            
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
            });
            
            highlight.addEventListener('mouseleave', (e) => {
                if (currentHoveredElement === e.target) {
                    currentHoveredElement = null;
                }
                e.target.style.backgroundColor = '#ffeb3b';
            });
        });
    }
    
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    function setupEventListeners() {
        document.addEventListener('keydown', async (e) => {
            if (e.key.toLowerCase() === 's' && currentHoveredElement) {
                e.preventDefault();
                await captureData();
            }
        });
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
            
            console.log(`[Immersive Memorize] 已保存卡片: ${word}`);
            showNotification(`已保存: ${word}`);
            
        } catch (error) {
            console.error('[Immersive Memorize] 捕获数据失败:', error);
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
    
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4caf50;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            z-index: 9999;
            font-family: Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 2000);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();