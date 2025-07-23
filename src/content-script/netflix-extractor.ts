/**
 * Netflix页面信息提取器
 * 提取剧集名称、季数、集数等详细信息
 */

export interface NetflixInfo {
  showTitle: string;      // 剧集名称 (如 "Breaking Bad")
  seasonNumber?: string;  // 季数 (如 "第1季" 或 "Season 1")
  episodeNumber?: string; // 集数 (如 "第3集" 或 "Episode 3")
  episodeTitle?: string;  // 集标题 (如果有)
  fullTitle: string;      // 完整标题组合
}

export class NetflixExtractor {
  private debugMode: boolean;

  constructor(debugMode: boolean = false) {
    this.debugMode = debugMode;
  }

  /**
   * 提取Netflix页面的详细信息
   */
  public extractNetflixInfo(): NetflixInfo {
    const info: NetflixInfo = {
      showTitle: 'Unknown',
      fullTitle: 'Unknown'
    };

    try {
      // 1. 首先尝试从document.title提取基本信息
      const documentTitle = document.title.replace(' - Netflix', '');
      
      // 2. 尝试从播放器区域提取详细信息
      const showTitle = this.extractShowTitle();
      const seasonNumber = this.extractSeasonNumber();
      const episodeNumber = this.extractEpisodeNumber();
      const episodeTitle = this.extractEpisodeTitle();

      // 3. 组装信息
      info.showTitle = showTitle || documentTitle || 'Unknown';
      info.seasonNumber = seasonNumber || undefined;
      info.episodeNumber = episodeNumber || undefined;
      info.episodeTitle = episodeTitle || undefined;

      // 4. 构建完整标题
      info.fullTitle = this.buildFullTitle(info);

      if (this.debugMode) {
        console.log('[NetflixExtractor] 提取的信息:', info);
      }

    } catch (error) {
      console.error('[NetflixExtractor] 提取信息失败:', error);
      // 退回到document.title
      info.showTitle = document.title.replace(' - Netflix', '') || 'Unknown';
      info.fullTitle = info.showTitle;
    }

    return info;
  }

  /**
   * 提取剧集名称
   */
  private extractShowTitle(): string | null {
    const titleSelectors = [
      // 播放页面主标题
      'h4.ellipsize-text',
      '[data-uia="video-title"]',
      '.video-title',
      
      // 详情页标题
      '.title-info-metadata h1',
      '.fallback-text-container h1',
      
      // 播放器状态栏标题
      '.player-status-main-title',
      '.nf-player-container .video-title',
      
      // 通用标题选择器
      '[data-uia="title-field"]',
      '.title-field',
      
      // 备用选择器
      '.video-metadata .show-title',
      '.episode-metadata .show-title'
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        if (this.debugMode) {
          console.log(`[NetflixExtractor] 找到剧集标题 (${selector}):`, element.textContent.trim());
        }
        return element.textContent.trim();
      }
    }

    return null;
  }

  /**
   * 提取季数信息
   */
  private extractSeasonNumber(): string | null {
    const seasonSelectors = [
      // 季数选择器和标签
      '[data-uia="season-selector"] .current-season',
      '[data-uia="season-selector"]',
      '.season-label',
      '.current-season',
      
      // 视频元数据中的季数
      '.episode-metadata .season-info',
      '.video-metadata .season-number',
      '.season-number',
      
      // 播放器中的季数
      '.player-status-season',
      '.nf-player-container .season-info',
      
      // 通用季数选择器
      '[data-uia="season-field"]',
      '.season-field'
    ];

    for (const selector of seasonSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        const text = element.textContent.trim();
        // 提取季数信息
        const seasonMatch = text.match(/(?:第|Season|S)[\s]*(\d+)[\s]*[季]?/i);
        if (seasonMatch) {
          if (this.debugMode) {
            console.log(`[NetflixExtractor] 找到季数 (${selector}):`, text);
          }
          return text;
        }
      }
    }

    return null;
  }

  /**
   * 提取集数信息
   */
  private extractEpisodeNumber(): string | null {
    const episodeSelectors = [
      // 集数选择器
      '[data-uia="episode-title"]',
      '.episode-title',
      '.current-episode',
      
      // 视频元数据中的集数
      '.video-metadata .episode-number',
      '.episode-number',
      '.episode-metadata .episode-number',
      
      // 播放器中的集数
      '.player-status-episode',
      '.nf-player-container .episode-info',
      
      // 集数选择器中的当前集数
      '.episode-selector .selected .episode-number',
      '.episode-list .selected .episode-number',
      
      // 通用集数选择器
      '[data-uia="episode-field"]',
      '.episode-field'
    ];

    for (const selector of episodeSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        const text = element.textContent.trim();
        // 提取集数信息
        const episodeMatch = text.match(/(?:第|Episode|E|EP)[\s]*(\d+)[\s]*[集话]?/i);
        if (episodeMatch) {
          if (this.debugMode) {
            console.log(`[NetflixExtractor] 找到集数 (${selector}):`, text);
          }
          return text;
        }
      }
    }

    return null;
  }

  /**
   * 提取集标题
   */
  private extractEpisodeTitle(): string | null {
    const episodeTitleSelectors = [
      // 集标题
      '[data-uia="episode-title"] .episode-title-1',
      '.episode-title-text',
      '.episode-title-name',
      
      // 视频元数据中的集标题
      '.video-metadata .episode-title',
      '.episode-metadata .episode-title',
      
      // 播放器状态中的集标题
      '.player-status-main-title .episode-title',
      '.player-status-episode-title',
      
      // 选中集数的标题
      '.episode-selector .selected .episode-title',
      '.episode-list .selected .title'
    ];

    for (const selector of episodeTitleSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        if (this.debugMode) {
          console.log(`[NetflixExtractor] 找到集标题 (${selector}):`, element.textContent.trim());
        }
        return element.textContent.trim();
      }
    }

    return null;
  }

  /**
   * 构建完整标题
   */
  private buildFullTitle(info: NetflixInfo): string {
    let parts: string[] = [];

    // 添加剧集名称
    if (info.showTitle && info.showTitle !== 'Unknown') {
      parts.push(info.showTitle);
    }

    // 添加季数
    if (info.seasonNumber) {
      parts.push(info.seasonNumber);
    }

    // 添加集数
    if (info.episodeNumber) {
      parts.push(info.episodeNumber);
    }

    // 添加集标题
    if (info.episodeTitle) {
      parts.push(`"${info.episodeTitle}"`);
    }

    return parts.length > 0 ? parts.join(' ') : 'Unknown';
  }

  /**
   * 检查是否在Netflix播放页面
   */
  public static isNetflixWatchPage(): boolean {
    return window.location.hostname.includes('netflix.com') && 
           (window.location.pathname.includes('/watch') || 
            document.querySelector('video') !== null);
  }

  /**
   * 等待页面元素加载
   */
  public async waitForNetflixPlayer(timeout: number = 10000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      // 检查是否有视频元素和一些关键的Netflix元素
      const hasVideo = document.querySelector('video') !== null;
      const hasNetflixElements = document.querySelector('[class*="player"]') !== null ||
                                document.querySelector('[data-uia*="player"]') !== null ||
                                document.querySelector('.video-title') !== null;
      
      if (hasVideo && hasNetflixElements) {
        if (this.debugMode) {
          console.log('[NetflixExtractor] Netflix播放器已加载');
        }
        return true;
      }
      
      // 等待100ms后重试
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.debugMode) {
      console.log('[NetflixExtractor] 等待Netflix播放器超时');
    }
    return false;
  }
}