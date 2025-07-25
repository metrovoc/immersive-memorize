/**
 * Netflix字幕源实现
 * 专门处理Netflix网站的字幕提取和解析
 */

import type { 
  ISubtitleSource, 
  PageContext, 
  MediaInfo, 
  ParsedSubtitle,
  SubtitleSourceCapabilities 
} from './types';
import { NetflixExtractor } from '../netflix-extractor';
import { SubtitleTextParser } from '../subtitle-text-parser';

export class NetflixSubtitleSource implements ISubtitleSource {
  readonly name = 'Netflix Native';
  readonly priority = 0; // 最高优先级
  readonly capabilities: SubtitleSourceCapabilities = {
    supportsNativeSubtitles: true,
    supportsCustomSubtitles: false,
    requiresUserInput: false
  };

  private observer: MutationObserver | null = null;
  private extractor: NetflixExtractor;
  private textParser: SubtitleTextParser;
  private debugMode: boolean;
  private isInitialized: boolean = false;

  constructor(debugMode: boolean = false) {
    this.debugMode = debugMode;
    this.extractor = new NetflixExtractor(debugMode);
    this.textParser = new SubtitleTextParser();
  }

  canHandle(context: PageContext): boolean {
    return context.hostname.includes('netflix.com') && 
           context.hasVideo && 
           this.hasNetflixPlayer();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 等待Netflix播放器加载
      const playerReady = await this.extractor.waitForNetflixPlayer(10000);
      if (!playerReady) {
        throw new Error('Netflix播放器加载超时');
      }

      this.isInitialized = true;
      
      if (this.debugMode) {
        console.log('[NetflixSubtitleSource] 初始化完成');
      }
    } catch (error) {
      console.error('[NetflixSubtitleSource] 初始化失败:', error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.hasNetflixPlayer();
  }

  detectSubtitleContainers(): HTMLElement[] {
    const selectors = [
      '.player-timedtext-text-container',
      '.ltr-1472gpj',
      '[data-uia="player-caption-text"]'
    ];

    const containers: HTMLElement[] = [];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector) as NodeListOf<HTMLElement>;
      containers.push(...Array.from(elements));
    }

    if (this.debugMode && containers.length > 0) {
      console.log(`[NetflixSubtitleSource] 发现 ${containers.length} 个字幕容器`);
    }

    return containers;
  }

  parseSubtitleContent(container: HTMLElement): ParsedSubtitle {
    try {
      const parsedText = this.textParser.parse(container);
      
      if (this.debugMode) {
        console.log('[NetflixSubtitleSource] 解析字幕内容:', {
          cleanText: parsedText.cleanText,
          furiganaCount: parsedText.furiganaMap.length
        });
      }

      return {
        cleanText: parsedText.cleanText,
        displayHTML: parsedText.displayHTML,
        furiganaMap: parsedText.furiganaMap
      };
    } catch (error) {
      console.error('[NetflixSubtitleSource] 解析字幕内容失败:', error);
      return {
        cleanText: '',
        displayHTML: '',
        furiganaMap: []
      };
    }
  }

  extractMediaInfo(): MediaInfo {
    try {
      const netflixInfo = this.extractor.extractNetflixInfo();
      
      return {
        title: netflixInfo.showTitle,
        fullTitle: netflixInfo.fullTitle,
        showTitle: netflixInfo.showTitle,
        seasonNumber: netflixInfo.seasonNumber,
        episodeNumber: netflixInfo.episodeNumber,
        episodeTitle: netflixInfo.episodeTitle
      };
    } catch (error) {
      console.error('[NetflixSubtitleSource] 提取媒体信息失败:', error);
      return {
        title: 'Unknown',
        fullTitle: 'Unknown'
      };
    }
  }

  setupObserver(callback: (containers: HTMLElement[]) => void): void {
    this.cleanup(); // 清理现有的观察器

    const subtitleSelectors = [
      '.player-timedtext-text-container',
      '.ltr-1472gpj',
      '[data-uia="player-caption-text"]'
    ].join(', ');

    const handleMutation = (mutations: MutationRecord[]) => {
      let hasSubtitleChanges = false;

      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              
              if (element.matches(subtitleSelectors) || element.querySelector(subtitleSelectors)) {
                hasSubtitleChanges = true;
              }
            }
          });
        }
      });

      if (hasSubtitleChanges) {
        const containers = this.detectSubtitleContainers();
        callback(containers);
      }
    };

    this.observer = new MutationObserver(handleMutation);

    // 尝试找到更具体的观察目标
    const initialCheck = () => {
      const subtitleParent = document.querySelector(subtitleSelectors)?.parentElement;
      
      if (subtitleParent) {
        if (this.debugMode) {
          console.log('[NetflixSubtitleSource] 在字幕容器父级上设置观察器');
        }
        
        this.observer?.observe(subtitleParent, {
          childList: true,
          subtree: true
        });
      } else {
        if (this.debugMode) {
          console.log('[NetflixSubtitleSource] 在document.body上设置观察器');
        }
        
        this.observer?.observe(document.body, {
          childList: true,
          subtree: true
        });
      }

      // 立即检查现有字幕
      const containers = this.detectSubtitleContainers();
      if (containers.length > 0) {
        callback(containers);
      }
    };

    // 给页面一些时间加载
    setTimeout(initialCheck, 1000);
  }

  cleanup(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.debugMode) {
      console.log('[NetflixSubtitleSource] 清理完成');
    }
  }

  /**
   * 检查是否存在Netflix播放器
   */
  private hasNetflixPlayer(): boolean {
    const hasVideo = document.querySelector('video') !== null;
    const hasNetflixElements = document.querySelector('[class*="player"]') !== null ||
                             document.querySelector('[data-uia*="player"]') !== null ||
                             document.querySelector('.video-title') !== null;
    
    return hasVideo && hasNetflixElements;
  }

  /**
   * 获取当前视频元素
   */
  getVideoElement(): HTMLVideoElement | null {
    return document.querySelector('video');
  }

  /**
   * 获取视频时间戳
   */
  getCurrentTimestamp(): number {
    const videoElement = this.getVideoElement();
    return videoElement ? Math.floor(videoElement.currentTime) : 0;
  }

  /**
   * 检查是否在Netflix观看页面
   */
  static isNetflixWatchPage(): boolean {
    return window.location.hostname.includes('netflix.com') && 
           (window.location.pathname.includes('/watch') || 
            document.querySelector('video') !== null);
  }
}