document.addEventListener('DOMContentLoaded', async function() {
    const totalCardsSpan = document.getElementById('total-cards');
    const exportButton = document.getElementById('export-button');
    const clearAllButton = document.getElementById('clear-all-button');
    const openOptionsButton = document.getElementById('open-options');
    const cardsList = document.getElementById('cards-list');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    const notification = document.getElementById('notification');
    
    let savedCards = [];
    let currentPage = 1;
    const cardsPerPage = 10;
    
    await loadCards();
    
    exportButton.addEventListener('click', exportToAnki);
    clearAllButton.addEventListener('click', clearAllCards);
    openOptionsButton.addEventListener('click', openOptions);
    prevPageBtn.addEventListener('click', () => changePage(-1));
    nextPageBtn.addEventListener('click', () => changePage(1));
    
    async function loadCards() {
        try {
            const result = await chrome.storage.local.get(['savedCards']);
            savedCards = result.savedCards || [];
            
            updateStats();
            renderCards();
            updatePagination();
            
        } catch (error) {
            console.error('加载卡片失败:', error);
            showNotification('加载卡片失败', 'error');
        }
    }
    
    function updateStats() {
        totalCardsSpan.textContent = savedCards.length;
        exportButton.disabled = savedCards.length === 0;
        clearAllButton.disabled = savedCards.length === 0;
    }
    
    function renderCards() {
        if (savedCards.length === 0) {
            cardsList.innerHTML = `
                <div class="no-cards">
                    <p>还没有保存任何卡片</p>
                    <p class="hint">在 Netflix 上观看日语内容时，将鼠标悬停在高亮词汇上并按 <kbd>S</kbd> 键保存</p>
                </div>
            `;
            return;
        }
        
        const startIndex = (currentPage - 1) * cardsPerPage;
        const endIndex = startIndex + cardsPerPage;
        const pageCards = savedCards.slice(startIndex, endIndex);
        
        cardsList.innerHTML = pageCards.map(card => `
            <div class="card-item" data-id="${card.id}">
                <div class="card-content">
                    <div class="card-word">${escapeHtml(card.word)}</div>
                    <div class="card-source">${escapeHtml(card.sourceTitle)}</div>
                    <div class="card-sentence">${escapeHtml(card.sentence)}</div>
                </div>
                <div class="card-actions">
                    <button class="card-delete" onclick="deleteCard(${card.id})">删除</button>
                </div>
            </div>
        `).join('');
    }
    
    function updatePagination() {
        const totalPages = Math.ceil(savedCards.length / cardsPerPage);
        
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
        
        if (savedCards.length === 0) {
            pageInfo.textContent = '第 0 页，共 0 页';
        } else {
            pageInfo.textContent = `第 ${currentPage} 页，共 ${totalPages} 页`;
        }
    }
    
    function changePage(direction) {
        const totalPages = Math.ceil(savedCards.length / cardsPerPage);
        const newPage = currentPage + direction;
        
        if (newPage >= 1 && newPage <= totalPages) {
            currentPage = newPage;
            renderCards();
            updatePagination();
        }
    }
    
    window.deleteCard = async function(cardId) {
        if (confirm('确定要删除这张卡片吗？')) {
            try {
                savedCards = savedCards.filter(card => card.id !== cardId);
                await chrome.storage.local.set({ savedCards: savedCards });
                
                const totalPages = Math.ceil(savedCards.length / cardsPerPage);
                if (currentPage > totalPages && totalPages > 0) {
                    currentPage = totalPages;
                }
                
                updateStats();
                renderCards();
                updatePagination();
                
                showNotification('卡片已删除', 'success');
                
            } catch (error) {
                console.error('删除卡片失败:', error);
                showNotification('删除失败', 'error');
            }
        }
    };
    
    async function exportToAnki() {
        if (savedCards.length === 0) {
            showNotification('没有卡片可导出', 'error');
            return;
        }
        
        try {
            const csvHeader = 'Word;Sentence;Screenshot;Timestamp;Source';
            const csvRows = savedCards.map(card => {
                const word = escapeCsvField(card.word);
                const sentence = escapeCsvField(card.sentence);
                const screenshot = card.screenshot ? 
                    `<img src="${card.screenshot}">` : '';
                const timestamp = formatTimestamp(card.timestamp);
                const source = escapeCsvField(card.sourceTitle);
                
                return `${word};${sentence};${screenshot};${timestamp};${source}`;
            });
            
            const csvContent = [csvHeader, ...csvRows].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `immersive-memorize-${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
            
            URL.revokeObjectURL(url);
            showNotification(`已导出 ${savedCards.length} 张卡片`, 'success');
            
        } catch (error) {
            console.error('导出失败:', error);
            showNotification('导出失败', 'error');
        }
    }
    
    async function clearAllCards() {
        if (confirm('确定要删除所有卡片吗？此操作不可撤销。')) {
            try {
                await chrome.storage.local.set({ savedCards: [] });
                savedCards = [];
                currentPage = 1;
                
                updateStats();
                renderCards();
                updatePagination();
                
                showNotification('所有卡片已清空', 'success');
                
            } catch (error) {
                console.error('清空失败:', error);
                showNotification('清空失败', 'error');
            }
        }
    }
    
    function openOptions() {
        chrome.runtime.openOptionsPage();
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function escapeCsvField(field) {
        if (typeof field !== 'string') return '';
        
        if (field.includes(';') || field.includes('"') || field.includes('\n')) {
            return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
    }
    
    function formatTimestamp(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    function showNotification(message, type = 'success') {
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
});