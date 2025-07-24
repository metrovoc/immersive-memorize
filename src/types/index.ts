import type { Word as AnalyzerWord } from '@/lib/japanese-analyzer';

export type Word = AnalyzerWord;

export interface FlashCard {
  id: number;
  word: string; // This should be the lemma of the word
  sentence: string;
  timestamp: number;
  screenshot: string;
  sourceTitle: string;
  createdAt: string;
  level?: string; // JLPT level (N5, N4, N3, N2, N1)
  definition?: string; // Word definition
  reading?: string; // Word reading (furigana)
  // Netflix详细信息
  showTitle?: string; // 剧集名称
  seasonNumber?: string; // 季数
  episodeNumber?: string; // 集数
  episodeTitle?: string; // 集标题
}


export interface VocabEntry {
  VocabKanji: string
  VocabFurigana: string
  VocabDefCN: string
  VocabPitch: string
  VocabPoS: string
  Frequency: string
  Level: string
}

export interface VocabLibrary {
  id: string
  name: string
  description: string
  icon: string
  data: VocabEntry[]
  totalWords: number
  levels: string[]
}

export interface LevelProgress {
  level: string
  enabled: boolean
  totalWords: number
  progress: number
}

export interface VocabLibrarySettings {
  selectedLibraryId: string
  levelSettings: Record<string, LevelProgress>
}

export interface ExtensionSettings {
  jlptWordlist: string[]
  captureHotkey: string
  debugMode: boolean
  enableScreenshot: boolean  // 新增：截图功能开关，默认false
  savedCards: FlashCard[]
  vocabLibrarySettings: VocabLibrarySettings
  csvExportFormat: 'plain-text' | 'anki-html' | 'rich-text' // CSV导出格式设置
}

export interface NotificationType {
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}

export type ViewMode = 'overview' | 'library-detail' | 'level-detail' | 'vocab-list' | 'learned-words'

export interface ViewState {
  mode: ViewMode
  libraryId?: string
  level?: string
  breadcrumb: string[]
}