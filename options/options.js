document.addEventListener('DOMContentLoaded', async function() {
    const textarea = document.getElementById('wordlist-textarea');
    const saveButton = document.getElementById('save-button');
    const clearButton = document.getElementById('clear-button');
    const wordCountSpan = document.getElementById('word-count');
    const notification = document.getElementById('notification');
    
    await loadWordlist();
    
    textarea.addEventListener('input', updateWordCount);
    saveButton.addEventListener('click', saveWordlist);
    clearButton.addEventListener('click', clearWordlist);
    
    async function loadWordlist() {
        try {
            const result = await chrome.storage.local.get(['jlptWordlist']);
            const wordlist = result.jlptWordlist || [];
            
            textarea.value = wordlist.join('\n');
            updateWordCount();
            
        } catch (error) {
            console.error('加载词汇表失败:', error);
            showNotification('加载词汇表失败', 'error');
        }
    }
    
    async function saveWordlist() {
        try {
            const text = textarea.value.trim();
            const wordlist = text ? text.split('\n')
                .map(word => word.trim())
                .filter(word => word.length > 0) : [];
            
            await chrome.storage.local.set({ jlptWordlist: wordlist });
            
            showNotification(`已保存 ${wordlist.length} 个词汇`, 'success');
            updateWordCount();
            
        } catch (error) {
            console.error('保存词汇表失败:', error);
            showNotification('保存失败', 'error');
        }
    }
    
    function clearWordlist() {
        if (confirm('确定要清空词汇表吗？此操作不可撤销。')) {
            textarea.value = '';
            updateWordCount();
            showNotification('词汇表已清空', 'success');
        }
    }
    
    function updateWordCount() {
        const text = textarea.value.trim();
        const wordCount = text ? text.split('\n')
            .map(word => word.trim())
            .filter(word => word.length > 0).length : 0;
        
        wordCountSpan.textContent = `${wordCount} 个词汇`;
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