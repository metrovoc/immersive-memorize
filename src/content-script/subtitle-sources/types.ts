/**
 * 字幕源核心接口和类型定义
 */

export interface PageContext {
  hostname: string;
  pathname: string;
  hasVideo: boolean;
  videoElements: HTMLVideoElement[];
}

export interface MediaInfo {
  title: string;
  fullTitle: string;
  showTitle?: string;
  seasonNumber?: string;
  episodeNumber?: string;
  episodeTitle?: string;
}

export interface ParsedSubtitle {
  cleanText: string;
  displayHTML: string;
  furiganaMap?: FuriganaMapping[];
}

export interface FuriganaMapping {
  kanji: string;
  furigana: string;
  startPos: number;
  endPos: number;
}

export interface SubtitleEntry {
  startTime: number;
  endTime: number;
  text: string;
  index: number;
}

export interface SubtitleSourceCapabilities {
  supportsNativeSubtitles: boolean;
  supportsCustomSubtitles: boolean;
  requiresUserInput: boolean;
}

/**
 * 统一的字幕源接口
 */
export interface ISubtitleSource {
  readonly name: string;
  readonly priority: number; // 0=最高优先级（原生字幕），1=中等（自定义字幕）
  readonly capabilities: SubtitleSourceCapabilities;
  
  // 检查是否可以处理当前页面环境
  canHandle(context: PageContext): boolean;
  
  // 检测字幕容器元素
  detectSubtitleContainers(): HTMLElement[];
  
  // 解析字幕内容
  parseSubtitleContent(container: HTMLElement): ParsedSubtitle;
  
  // 提取页面媒体信息
  extractMediaInfo(): MediaInfo;
  
  // 设置字幕监听器
  setupObserver(callback: (containers: HTMLElement[]) => void): void;
  
  // 清理资源
  cleanup(): void;
  
  // 初始化字幕源
  initialize(): Promise<void>;
  
  // 检查字幕源是否已就绪
  isReady(): boolean;
}

/**
 * 自定义字幕源特有的接口
 */
export interface ICustomSubtitleSource extends ISubtitleSource {
  // 加载SRT文件
  loadSRTFile(file: File): Promise<void>;
  
  // 设置目标视频元素
  setTargetVideo(video: HTMLVideoElement): void;
  
  // 创建字幕覆盖层
  createSubtitleOverlay(): HTMLElement;
  
  // 同步字幕显示
  syncSubtitles(currentTime: number): void;
  
  // 获取当前时间的字幕
  getCurrentSubtitle(currentTime: number): SubtitleEntry | null;
}

/**
 * 字幕源事件类型
 */
export type SubtitleSourceEvent = 
  | { type: 'subtitles-detected'; containers: HTMLElement[] }
  | { type: 'subtitle-changed'; subtitle: ParsedSubtitle }
  | { type: 'source-ready' }
  | { type: 'source-error'; error: Error };

export interface SubtitleSourceEventListener {
  (event: SubtitleSourceEvent): void;
}