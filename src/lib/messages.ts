import type { Word } from '@/lib/japanese-analyzer/common'
import type { SubtitleStyle } from '@/lib/settings'
import type { FlashCard, WordInfo } from '@/types'

/** A video's position in the viewport, used to crop screenshots. */
export interface CropRect {
  x: number
  y: number
  width: number
  height: number
  viewportWidth: number
}

/** Requests handled by the background service worker. */
export interface BackgroundApi {
  activateTab: { params: { tabId: number }; result: boolean }
  analyzeText: { params: { text: string }; result: Word[] }
  getActiveWords: { params: Record<string, never>; result: [string, string[]][] }
  lookupWord: { params: { word: string }; result: WordInfo | null }
  captureScreenshot: { params: { crop?: CropRect }; result: string }
  addCard: { params: { card: FlashCard }; result: null }
  getLearnedWords: { params: Record<string, never>; result: string[] }
}

export type BackgroundRequest = {
  [K in keyof BackgroundApi]: { type: K } & BackgroundApi[K]['params']
}[keyof BackgroundApi]

export type BackgroundResponse<T> = { ok: true; result: T } | { ok: false; error: string }

export async function callBackground<K extends keyof BackgroundApi>(
  type: K,
  params: BackgroundApi[K]['params']
): Promise<BackgroundApi[K]['result']> {
  const response = (await chrome.runtime.sendMessage({ type, ...params })) as
    BackgroundResponse<BackgroundApi[K]['result']> | undefined
  if (!response) throw new Error(`No response to ${type}`)
  if (!response.ok) throw new Error(response.error)
  return response.result
}

/** Messages the popup and background send to content scripts. */
export type ContentMessage =
  | { type: 'ping' }
  | { type: 'openSubtitlePicker' }
  | { type: 'previewSubtitleStyle'; style: SubtitleStyle }
