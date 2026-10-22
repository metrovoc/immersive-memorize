export type { Word } from '@/lib/japanese-analyzer/common'

export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
export type JlptLevel = (typeof JLPT_LEVELS)[number]

export interface FlashCard {
  id: number
  /** Dictionary form (lemma) of the word. */
  word: string
  /** Sanitized HTML of the subtitle line, including ruby annotations. */
  sentence: string
  /** Playback position in seconds. */
  timestamp: number
  /** JPEG data URL, or an empty string when there is none or it was not loaded. */
  screenshot: string
  /** Set when a card is loaded without its screenshot data. */
  hasScreenshot?: boolean
  sourceTitle: string
  createdAt: string
  level?: string
  definition?: string
  reading?: string
  showTitle?: string
  seasonNumber?: string
  episodeNumber?: string
  episodeTitle?: string
}

export interface VocabEntry {
  VocabKanji: string
  VocabFurigana: string
  VocabDefCN: string
  VocabDefEN?: string
  VocabPitch: string
  VocabPoS: string
  Frequency: string
  Level: string
}

/** Dictionary details stored on a flashcard. */
export interface WordInfo {
  level: JlptLevel
  reading: string
  definition: string
}

export type CsvExportFormat = 'anki-html' | 'plain-text' | 'rich-text'

export type ToastType = 'success' | 'error' | 'warning' | 'info'
