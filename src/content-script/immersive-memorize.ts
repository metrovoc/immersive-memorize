/**
 * Immersive Memorize 主控制器 V2
 * 支持多字幕源架构的重构版本
 */

import type { FlashCard, ExtensionSettings, Word } from '@/types';
import { VocabLibraryManager } from '@/lib/vocab-library';
import { SubtitleProcessor } from './subtitle-processor';
import { SubtitleSourceRegistry, PageContextBuilder } from './subtitle-sources/registry';
import { NetflixSubtitleSource } from './subtitle-sources/netflix-source';
import { CustomSRTSubtitleSource } from './subtitle-sources/custom-srt-source';
import type { ISubtitleSource, PageContext } from './subtitle-sources/types';

export class ImmersiveMemorize {
  private vocabLibraryManager: VocabLibraryManager;
  private subtitleProcessor: SubtitleProcessor | null = null;
  private sourceRegistry: SubtitleSourceRegistry;
  private activeSource: ISubtitleSource | null = null;
  private customSource: CustomSRTSubtitleSource;
  
  private learnedWords: Set<string> = new Set();
  private currentTargetWord: Word | null = null;
  private currentTargetElement: HTMLElement | null = null;
  private pageContextObserver: MutationObserver | null = null;
  
  private captureHotkey: string = 's';
  private debugMode: boolean = true;
  private enableScreenshot: boolean = false;

  constructor() {
    this.vocabLibraryManager = new VocabLibraryManager();
    this.sourceRegistry = new SubtitleSourceRegistry(this.debugMode);
    this.customSource = new CustomSRTSubtitleSource(this.debugMode);
    this.initializeSubtitleSources();
  }

  /**
   * 初始化所有字幕源
   */
  private initializeSubtitleSources(): void {
    // 注册Netflix字幕源
    this.sourceRegistry.register('netflix.com', new NetflixSubtitleSource(this.debugMode));
    
    // 注册自定义字幕源（支持所有网站）
    this.sourceRegistry.register('*', this.customSource);

    if (this.debugMode) {
      const stats = this.sourceRegistry.getStats();
      console.log('[ImmersiveMemorizeV2] 字幕源注册完成:', stats);
    }
  }

  async init(): Promise<void> {
    try {
      // 初始化词汇库管理器
      await this.vocabLibraryManager.init();

      // 加载设置
      await this.loadSettings();

      // 初始化字幕处理器
      this.subtitleProcessor = new SubtitleProcessor(
        this.vocabLibraryManager,
        this.learnedWords,
        this.debugMode
      );

      // 检测页面环境并选择字幕源
      await this.detectAndInitializeSubtitleSources();

      // 设置事件监听器
      this.setupEventListeners();
      this.setupStorageListener();

      if (this.debugMode) {
        console.log('[ImmersiveMemorizeV2] 初始化完成');
        this.logCurrentState();
      }

    } catch (error) {
      console.error('[ImmersiveMemorizeV2] 初始化失败:', error);
    }
  }

  /**
   * 检测页面环境并初始化字幕源
   */
  private async detectAndInitializeSubtitleSources(): Promise<void> {
    const context = PageContextBuilder.create();
    const availableSources = this.sourceRegistry.getAvailableSources(context);

    if (this.debugMode) {
      console.log('[ImmersiveMemorizeV2] 页面上下文:', context);
      console.log('[ImmersiveMemorizeV2] 可用字幕源:', availableSources.map(s => s.name));
    }

    // 选择最高优先级的字幕源作为主要源
    if (availableSources.length > 0) {
      this.activeSource = availableSources[0];
      await this.initializeActiveSource();
    }

    // 设置页面变化监听器
    this.setupPageContextObserver(context);
  }

  /**
   * 初始化当前活跃的字幕源
   */
  private async initializeActiveSource(): Promise<void> {
    if (!this.activeSource) return;

    try {
      await this.activeSource.initialize();
      
      if (this.activeSource.isReady()) {
        this.setupSubtitleObserver();
        
        if (this.debugMode) {
          console.log(`[ImmersiveMemorizeV2] 字幕源 ${this.activeSource.name} 已就绪`);
        }
      }
    } catch (error) {
      console.error(`[ImmersiveMemorizeV2] 初始化字幕源 ${this.activeSource.name} 失败:`, error);
      this.activeSource = null;
    }
  }

  /**
   * 设置字幕观察器
   */
  private setupSubtitleObserver(): void {
    if (!this.activeSource) return;

    this.activeSource.setupObserver((containers: HTMLElement[]) => {
      this.processSubtitleContainers(containers);
    });
  }

  /**
   * 处理字幕容器
   */
  private async processSubtitleContainers(containers: HTMLElement[]): Promise<void> {
    if (!this.subtitleProcessor || containers.length === 0) return;

    // 清除现有高亮
    this.clearAllHighlights();
    this.currentTargetWord = null;
    this.currentTargetElement = null;

    // 按优先级处理容器
    for (const container of containers) {
      const text = container.innerText?.trim();
      if (!text) continue;

      // 重置处理标记
      container.dataset.imProcessed = '';

      // 尝试处理这个容器
      const targetWord = await this.subtitleProcessor.processAndHighlight(container);

      if (targetWord) {
        this.currentTargetWord = targetWord;
        this.currentTargetElement = document.querySelector('.im-current-target');
        container.dataset.imProcessed = 'true';

        if (this.debugMode) {
          console.log(`[ImmersiveMemorizeV2] 找到目标词汇: ${targetWord.word} (原形: ${targetWord.lemma})`);
        }
        return; // 找到目标词汇后停止处理
      }
    }

    if (this.debugMode) {
      console.log('[ImmersiveMemorizeV2] 当前字幕无未学词汇');
    }
  }

  /**
   * 设置页面上下文观察器
   */
  private setupPageContextObserver(initialContext: PageContext): void {
    this.pageContextObserver = PageContextBuilder.observeChanges((newContext) => {
      if (this.hasSignificantContextChange(initialContext, newContext)) {
        if (this.debugMode) {
          console.log('[ImmersiveMemorizeV2] 页面上下文发生重大变化，重新初始化');
        }
        this.detectAndInitializeSubtitleSources();
      }
    });
  }

  /**
   * 检查上下文是否有重大变化
   */
  private hasSignificantContextChange(oldContext: PageContext, newContext: PageContext): boolean {
    return (
      oldContext.hostname !== newContext.hostname ||
      oldContext.hasVideo !== newContext.hasVideo ||
      Math.abs(oldContext.videoElements.length - newContext.videoElements.length) > 0
    );
  }

  /**
   * 切换到自定义字幕模式
   */
  async switchToCustomSubtitleMode(srtFile: File, targetVideo: HTMLVideoElement): Promise<void> {
    try {
      // 清理当前字幕源
      if (this.activeSource) {
        this.activeSource.cleanup();
      }

      // 配置自定义字幕源
      await this.customSource.loadSRTFile(srtFile);
      this.customSource.setTargetVideo(targetVideo);
      await this.customSource.initialize();

      // 切换到自定义字幕源
      this.activeSource = this.customSource;
      this.setupSubtitleObserver();

      if (this.debugMode) {
        const stats = this.customSource.getStats();
        console.log('[ImmersiveMemorizeV2] 切换到自定义字幕模式:', stats);
      }

      this.showNotification(`已加载 ${this.customSource.getStats().totalEntries} 条自定义字幕`);
    } catch (error) {
      console.error('[ImmersiveMemorizeV2] 切换到自定义字幕模式失败:', error);
      this.showNotification('自定义字幕加载失败: ' + (error as Error).message, 'error');
    }
  }

  /**
   * 切换回原生字幕模式
   */
  async switchToNativeSubtitleMode(): Promise<void> {
    const context = PageContextBuilder.create();
    const nativeSources = this.sourceRegistry.getAvailableSources(context)
      .filter(source => source.capabilities.supportsNativeSubtitles);

    if (nativeSources.length > 0) {
      // 清理当前字幕源
      if (this.activeSource) {
        this.activeSource.cleanup();
      }

      // 切换到原生字幕源
      this.activeSource = nativeSources[0];
      await this.initializeActiveSource();

      if (this.debugMode) {
        console.log(`[ImmersiveMemorizeV2] 切换到原生字幕模式: ${this.activeSource.name}`);
      }

      this.showNotification(`已切换到${this.activeSource.name}`);
    } else {
      this.showNotification('当前网站不支持原生字幕', 'warning');
    }
  }

  /**
   * 加载设置
   */
  private async loadSettings(): Promise<void> {
    const result = (await chrome.storage.local.get([
      'captureHotkey',
      'debugMode',
      'enableScreenshot',
      'savedCards',
    ])) as Partial<ExtensionSettings>;

    this.captureHotkey = result.captureHotkey || 's';
    this.debugMode = result.debugMode !== false;
    this.enableScreenshot = result.enableScreenshot || false;

    // 加载已学词汇
    const savedCards = result.savedCards || [];
    this.learnedWords = new Set(savedCards.map((card: FlashCard) => card.word));
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    const keyHandler = async (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === this.captureHotkey.toLowerCase()) {
        if (!this.currentTargetWord) {
          this.showNotification('当前无生词可学习', 'info');
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        await this.captureData();
      }
    };

    document.addEventListener('keydown', keyHandler, true);
    window.addEventListener('keydown', keyHandler, true);

    if (this.debugMode) {
      console.log('[ImmersiveMemorizeV2] 事件监听器已设置');
    }
  }

  /**
   * 设置存储监听器
   */
  private setupStorageListener(): void {
    chrome.storage.onChanged.addListener(async changes => {
      let needsRefresh = false;

      if (changes.vocabLibrarySettings) {
        await this.vocabLibraryManager.init();
        await this.subtitleProcessor?.updateWordLists();
        needsRefresh = true;
      }

      if (changes.savedCards) {
        const savedCards = changes.savedCards.newValue || [];
        this.learnedWords = new Set(savedCards.map((card: FlashCard) => card.word));
        this.subtitleProcessor?.setLearnedWords(this.learnedWords);
        needsRefresh = true;
      }

      if (changes.captureHotkey) {
        this.captureHotkey = changes.captureHotkey.newValue || 's';
      }

      if (changes.debugMode) {
        this.debugMode = changes.debugMode.newValue !== false;
      }

      if (needsRefresh) {
        this.refreshCurrentSubtitles();
      }
    });
  }

  /**
   * 刷新当前字幕
   */
  private refreshCurrentSubtitles(): void {
    if (!this.activeSource) return;

    const containers = this.activeSource.detectSubtitleContainers();
    this.processSubtitleContainers(containers);
  }

  /**
   * 捕获学习数据
   */
  private async captureData(): Promise<void> {
    if (!this.currentTargetWord || !this.currentTargetElement || !this.activeSource) return;

    try {
      const word = this.currentTargetWord;
      const lemma = word.lemma;

      // 检查是否已经学过
      if (this.learnedWords.has(lemma)) {
        this.showNotification(`${lemma} 已存在`, 'warning');
        return;
      }

      // 获取句子内容
      const sentenceElement = this.currentTargetElement.closest(
        '.player-timedtext-text-container, .ltr-1472gpj, [data-uia="player-caption-text"], .im-custom-subtitle-overlay'
      ) as HTMLElement | null;

      let sentence = '';
      if (sentenceElement && this.activeSource) {
        const parsedSubtitle = this.activeSource.parseSubtitleContent(sentenceElement);
        sentence = parsedSubtitle.displayHTML;
      }

      // 获取媒体信息
      const mediaInfo = this.activeSource.extractMediaInfo();
      
      // 获取时间戳
      let timestamp = 0;
      const videoElement = document.querySelector<HTMLVideoElement>('video');
      if (videoElement) {
        timestamp = Math.floor(videoElement.currentTime);
      }

      // 截图（如果启用）
      let screenshot = '';
      if (this.enableScreenshot) {
        screenshot = await this.captureVideoFrame(videoElement);
      }

      // 获取词汇详细信息
      const selectedLibrary = this.vocabLibraryManager.getSelectedLibrary();
      const vocabEntry = selectedLibrary?.data.find(entry => entry.VocabKanji === lemma);

      // 创建卡片数据
      const cardData: FlashCard = {
        id: Date.now(),
        word: lemma,
        sentence: sentence,
        timestamp: timestamp,
        screenshot: screenshot,
        sourceTitle: mediaInfo.fullTitle,
        createdAt: new Date().toISOString(),
        level: vocabEntry?.Level,
        definition: vocabEntry?.VocabDefCN,
        reading: vocabEntry?.VocabFurigana,
        showTitle: mediaInfo.showTitle,
        seasonNumber: mediaInfo.seasonNumber,
        episodeNumber: mediaInfo.episodeNumber,
        episodeTitle: mediaInfo.episodeTitle,
      };

      // 保存卡片
      const result = (await chrome.storage.local.get(['savedCards'])) as Partial<ExtensionSettings>;
      const savedCards = result.savedCards || [];
      savedCards.push(cardData);

      await chrome.storage.local.set({ savedCards: savedCards });

      // 更新已学词汇
      this.learnedWords.add(lemma);
      this.subtitleProcessor?.setLearnedWords(this.learnedWords);

      // 更新进度
      await this.vocabLibraryManager.updateProgressFromCards();

      this.showNotification(`${word.word} ( ${lemma} ) 已学习`);

      // 清除高亮并寻找下一个词汇
      this.clearAllHighlights();
      this.currentTargetWord = null;
      this.currentTargetElement = null;

      setTimeout(() => {
        this.refreshCurrentSubtitles();
      }, 100);

    } catch (error) {
      console.error('[ImmersiveMemorizeV2] 捕获数据失败:', error);
      this.showNotification('保存失败: ' + (error as Error).message, 'error');
    }
  }

  /**
   * 捕获视频帧（截图）
   */
  private async captureVideoFrame(videoElement: HTMLVideoElement | null): Promise<string> {
    if (!videoElement) return '';

    try {
      const response = await chrome.runtime.sendMessage({ action: 'captureVisibleTab' });
      return response?.data || '';
    } catch (error) {
      console.error('[ImmersiveMemorizeV2] 截图失败:', error);
      return '';
    }
  }

  /**
   * 清除所有高亮
   */
  private clearAllHighlights(): void {
    const highlights = document.querySelectorAll<HTMLElement>('.im-highlight');
    highlights.forEach(highlight => {
      const parent = highlight.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(highlight.textContent || ''), highlight);
        parent.normalize();
      }
    });
  }

  /**
   * 显示通知
   */
  private showNotification(
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'success'
  ): void {
    const notification = document.createElement('div');
    let bgColor: string, icon: string;

    switch (type) {
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
      z-index: 2147483647;
      font-family: Arial, sans-serif;
      font-size: 16px;
      font-weight: bold;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      border: 2px solid rgba(255,255,255,0.2);
      max-width: 350px;
      word-wrap: break-word;
    `;

    notification.textContent = `${icon} ${message}`;

    const appendTarget = document.fullscreenElement || document.body;
    appendTarget.appendChild(notification);

    const duration = type === 'error' ? 4000 : type === 'warning' ? 3000 : 2000;
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, duration);
  }

  /**
   * 记录当前状态（调试用）
   */
  private logCurrentState(): void {
    if (!this.debugMode) return;

    const selectedLibrary = this.vocabLibraryManager.getSelectedLibrary();
    const settings = this.vocabLibraryManager.getSettings();
    const enabledLevels = Object.entries(settings.levelSettings)
      .filter(([_, progress]) => progress.enabled)
      .map(([level]) => level);

    console.log(`[ImmersiveMemorizeV2] 当前词库: ${selectedLibrary?.name || '未选择'}`);
    console.log(`[ImmersiveMemorizeV2] 激活等级: ${enabledLevels.join(', ')}`);
    console.log(`[ImmersiveMemorizeV2] 已学词汇: ${this.learnedWords.size} 个`);
    console.log(`[ImmersiveMemorizeV2] 当前字幕源: ${this.activeSource?.name || '无'}`);
    console.log(`[ImmersiveMemorizeV2] 捕获快捷键: ${this.captureHotkey.toUpperCase()}`);
  }

  /**
   * 获取当前状态信息
   */
  getStatus(): {
    activeSource: string | null;
    isReady: boolean;
    learnedWordsCount: number;
    availableSources: string[];
  } {
    const context = PageContextBuilder.create();
    const availableSources = this.sourceRegistry.getAvailableSources(context);

    return {
      activeSource: this.activeSource?.name || null,
      isReady: this.activeSource?.isReady() || false,
      learnedWordsCount: this.learnedWords.size,
      availableSources: availableSources.map(s => s.name)
    };
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.activeSource) {
      this.activeSource.cleanup();
    }

    if (this.pageContextObserver) {
      this.pageContextObserver.disconnect();
    }

    this.sourceRegistry.cleanup();
    this.clearAllHighlights();

    if (this.debugMode) {
      console.log('[ImmersiveMemorizeV2] 清理完成');
    }
  }
}
