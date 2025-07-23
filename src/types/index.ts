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
  learnedWords: string[]
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
  savedCards: FlashCard[]
  vocabLibrarySettings: VocabLibrarySettings
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