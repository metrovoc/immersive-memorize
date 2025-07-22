export interface FlashCard {
  id: number
  word: string
  sentence: string
  timestamp: number
  screenshot: string
  sourceTitle: string
  createdAt: string
}

export interface ExtensionSettings {
  jlptWordlist: string[]
  captureHotkey: string
  debugMode: boolean
  savedCards: FlashCard[]
}

export interface NotificationType {
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}