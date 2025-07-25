/**
 * 字幕源注册表和管理器
 * 负责管理所有字幕源的注册、发现和选择
 */

import type { 
  ISubtitleSource, 
  PageContext, 
  SubtitleSourceEvent, 
  SubtitleSourceEventListener 
} from './types';

/**
 * 字幕源注册项
 */
interface RegistryEntry {
  source: ISubtitleSource;
  domainPattern: string; // 支持的域名模式，'*' 表示通用
  enabled: boolean;
}

/**
 * 字幕源注册表
 */
export class SubtitleSourceRegistry {
  private entries: RegistryEntry[] = [];
  private eventListeners: SubtitleSourceEventListener[] = [];
  private debugMode: boolean;

  constructor(debugMode: boolean = false) {
    this.debugMode = debugMode;
  }

  /**
   * 注册字幕源
   */
  register(domainPattern: string, source: ISubtitleSource, enabled: boolean = true): void {
    if (this.debugMode) {
      console.log(`[SubtitleSourceRegistry] 注册字幕源: ${source.name} for ${domainPattern}`);
    }

    this.entries.push({
      source,
      domainPattern,
      enabled
    });

    // 按优先级排序
    this.entries.sort((a, b) => a.source.priority - b.source.priority);
  }

  /**
   * 获取当前页面可用的字幕源
   */
  getAvailableSources(context: PageContext): ISubtitleSource[] {
    const matchingSources: ISubtitleSource[] = [];

    for (const entry of this.entries) {
      if (!entry.enabled) continue;

      // 检查域名匹配
      if (this.matchesDomain(entry.domainPattern, context.hostname)) {
        // 检查源是否可以处理当前环境
        if (entry.source.canHandle(context)) {
          matchingSources.push(entry.source);
          
          if (this.debugMode) {
            console.log(`[SubtitleSourceRegistry] 找到可用字幕源: ${entry.source.name}`);
          }
        }
      }
    }

    return matchingSources;
  }

  /**
   * 获取最高优先级的字幕源
   */
  getBestSource(context: PageContext): ISubtitleSource | null {
    const availableSources = this.getAvailableSources(context);
    return availableSources.length > 0 ? availableSources[0] : null;
  }

  /**
   * 获取所有自定义字幕源
   */
  getCustomSources(context: PageContext): ISubtitleSource[] {
    return this.getAvailableSources(context)
      .filter(source => source.capabilities.supportsCustomSubtitles);
  }

  /**
   * 检查域名是否匹配
   */
  private matchesDomain(pattern: string, hostname: string): boolean {
    if (pattern === '*') return true;
    
    // 支持简单的通配符匹配
    if (pattern.includes('*')) {
      const regex = new RegExp(
        pattern.replace(/\*/g, '.*').replace(/\./g, '\\.')
      );
      return regex.test(hostname);
    }

    return hostname.includes(pattern);
  }

  /**
   * 启用或禁用字幕源
   */
  setSourceEnabled(sourceName: string, enabled: boolean): void {
    const entry = this.entries.find(e => e.source.name === sourceName);
    if (entry) {
      entry.enabled = enabled;
      if (this.debugMode) {
        console.log(`[SubtitleSourceRegistry] ${sourceName} ${enabled ? '已启用' : '已禁用'}`);
      }
    }
  }

  /**
   * 添加事件监听器
   */
  addEventListener(listener: SubtitleSourceEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(listener: SubtitleSourceEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * 触发事件
   */
  emitEvent(event: SubtitleSourceEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[SubtitleSourceRegistry] 事件监听器错误:', error);
      }
    }
  }

  /**
   * 清理所有字幕源
   */
  cleanup(): void {
    for (const entry of this.entries) {
      try {
        entry.source.cleanup();
      } catch (error) {
        console.error(`[SubtitleSourceRegistry] 清理字幕源 ${entry.source.name} 失败:`, error);
      }
    }
    this.eventListeners.length = 0;
  }

  /**
   * 获取注册的字幕源统计信息
   */
  getStats(): { total: number; enabled: number; byDomain: Record<string, number> } {
    const byDomain: Record<string, number> = {};
    let enabled = 0;

    for (const entry of this.entries) {
      if (entry.enabled) enabled++;
      byDomain[entry.domainPattern] = (byDomain[entry.domainPattern] || 0) + 1;
    }

    return {
      total: this.entries.length,
      enabled,
      byDomain
    };
  }
}

/**
 * 页面上下文创建器
 */
export class PageContextBuilder {
  static create(): PageContext {
    const videoElements = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[];
    
    return {
      hostname: window.location.hostname,
      pathname: window.location.pathname,
      hasVideo: videoElements.length > 0,
      videoElements
    };
  }

  /**
   * 监听页面变化并更新上下文
   */
  static observeChanges(callback: (context: PageContext) => void): MutationObserver {
    let lastContext = this.create();
    callback(lastContext);

    const observer = new MutationObserver(() => {
      const newContext = this.create();
      
      // 检查是否有重要变化
      if (this.hasSignificantChange(lastContext, newContext)) {
        lastContext = newContext;
        callback(newContext);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return observer;
  }

  private static hasSignificantChange(oldContext: PageContext, newContext: PageContext): boolean {
    return (
      oldContext.hasVideo !== newContext.hasVideo ||
      oldContext.videoElements.length !== newContext.videoElements.length ||
      oldContext.pathname !== newContext.pathname
    );
  }
}