document.addEventListener('DOMContentLoaded', async function() {
    const textarea = document.getElementById('wordlist-textarea');
    const saveButton = document.getElementById('save-button');
    const clearButton = document.getElementById('clear-button');
    const wordCountSpan = document.getElementById('word-count');
    const hotkeyInput = document.getElementById('hotkey-input');
    const debugCheckbox = document.getElementById('debug-checkbox');
    const notification = document.getElementById('notification');
    
    await loadSettings();
    
    textarea.addEventListener('input', updateWordCount);
    saveButton.addEventListener('click', saveSettings);
    clearButton.addEventListener('click', clearWordlist);
    hotkeyInput.addEventListener('keydown', handleHotkeyInput);
    debugCheckbox.addEventListener('change', saveSettings);
    
    async function loadSettings() {
        try {
            const result = await chrome.storage.local.get(['jlptWordlist', 'captureHotkey', 'debugMode']);
            const wordlist = result.jlptWordlist || [];
            const hotkey = result.captureHotkey || 's';
            const debugMode = result.debugMode !== false;
            
            textarea.value = wordlist.join('\n');
            hotkeyInput.value = hotkey.toUpperCase();
            debugCheckbox.checked = debugMode;
            
            updateWordCount();
            
        } catch (error) {
            console.error('加载设置失败:', error);
            showNotification('加载设置失败', 'error');
        }
    }
    
    async function saveSettings() {
        try {
            const text = textarea.value.trim();
            const wordlist = text ? text.split('\n')
                .map(word => word.trim())
                .filter(word => word.length > 0) : [];
            
            const hotkey = hotkeyInput.value.toLowerCase() || 's';
            const debugMode = debugCheckbox.checked;
            
            await chrome.storage.local.set({ 
                jlptWordlist: wordlist,
                captureHotkey: hotkey,
                debugMode: debugMode
            });
            
            showNotification(`已保存 ${wordlist.length} 个词汇，快捷键: ${hotkey.toUpperCase()}`, 'success');
            updateWordCount();
            
        } catch (error) {
            console.error('保存设置失败:', error);
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
    
    function handleHotkeyInput(e) {
        e.preventDefault();
        
        // 只允许字母键
        if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
            hotkeyInput.value = e.key.toUpperCase();
            hotkeyInput.blur();
            saveSettings();
        } else if (e.key === 'Escape') {
            hotkeyInput.blur();
        }
    }
});