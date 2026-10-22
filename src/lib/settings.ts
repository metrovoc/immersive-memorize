import { JLPT_LEVELS, type CsvExportFormat, type JlptLevel } from '@/types'

export interface SubtitleStyle {
  fontSize: number
  /** Distance between the subtitle and the bottom of the video, in pixels. */
  verticalPosition: number
  backgroundOpacity: number
  /** Seconds added to the playback time when looking up custom subtitles. */
  timeOffset: number
}

export interface Settings {
  captureHotkey: string
  enableScreenshot: boolean
  csvExportFormat: CsvExportFormat
  debugMode: boolean
  enabledLevels: JlptLevel[]
  subtitleStyle: SubtitleStyle
  pinSubtitlesToScreen: boolean
  autoEnableEverywhere: boolean
  autoEnabledSites: string[]
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontSize: 16,
  verticalPosition: 60,
  backgroundOpacity: 50,
  timeOffset: 0,
}

export const DEFAULT_SETTINGS: Settings = {
  captureHotkey: 's',
  enableScreenshot: false,
  csvExportFormat: 'anki-html',
  debugMode: false,
  enabledLevels: [...JLPT_LEVELS],
  subtitleStyle: DEFAULT_SUBTITLE_STYLE,
  pinSubtitlesToScreen: false,
  autoEnableEverywhere: false,
  autoEnabledSites: ['*://*.netflix.com/*'],
}

// Settings live in chrome.storage.sync, one item per key, so they follow the user's Chrome profile.
export async function getSettings(): Promise<Settings> {
  return (await chrome.storage.sync.get(DEFAULT_SETTINGS)) as Settings
}

export function updateSettings(patch: Partial<Settings>): Promise<void> {
  return chrome.storage.sync.set(patch)
}

export function onSettingsChanged(listener: (patch: Partial<Settings>) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return
    const patch: Record<string, unknown> = {}
    for (const [key, change] of Object.entries(changes)) {
      if (key in DEFAULT_SETTINGS) {
        patch[key] = change.newValue ?? DEFAULT_SETTINGS[key as keyof Settings]
      }
    }
    if (Object.keys(patch).length > 0) listener(patch as Partial<Settings>)
  })
}

const LEGACY_LOCAL_KEYS = [
  'captureHotkey',
  'debugMode',
  'enableScreenshot',
  'csvExportFormat',
  'subtitleStyles',
  'activationSettings',
  'vocabLibrarySettings',
  // Marker left by the 0.10 move of cards to IndexedDB.
  'storage_migration_completed',
]

/**
 * Moves settings written by versions up to 0.10 (mostly in chrome.storage.local) into the
 * current synced keys. Debug logging is intentionally reset to its new default (off).
 */
export async function migrateLegacySettings(): Promise<void> {
  const local = await chrome.storage.local.get(LEGACY_LOCAL_KEYS)
  const { forceFullscreenMode } = await chrome.storage.sync.get('forceFullscreenMode')
  if (Object.keys(local).length === 0 && forceFullscreenMode === undefined) return

  const patch: Partial<Settings> = {}
  if (typeof local.captureHotkey === 'string' && /^[a-z]$/i.test(local.captureHotkey)) {
    patch.captureHotkey = local.captureHotkey.toLowerCase()
  }
  if (typeof local.enableScreenshot === 'boolean') patch.enableScreenshot = local.enableScreenshot
  if (['anki-html', 'plain-text', 'rich-text'].includes(local.csvExportFormat as string)) {
    patch.csvExportFormat = local.csvExportFormat as CsvExportFormat
  }
  if (local.subtitleStyles && typeof local.subtitleStyles === 'object') {
    patch.subtitleStyle = { ...DEFAULT_SUBTITLE_STYLE, ...local.subtitleStyles }
  }
  const activation = local.activationSettings as
    { globalAutoEnable?: boolean; autoEnabledSites?: string[] } | undefined
  if (activation) {
    patch.autoEnableEverywhere = activation.globalAutoEnable === true
    if (Array.isArray(activation.autoEnabledSites)) {
      patch.autoEnabledSites = activation.autoEnabledSites
    }
  }
  const levelSettings = (
    local.vocabLibrarySettings as
      { levelSettings?: Record<string, { enabled?: boolean }> } | undefined
  )?.levelSettings
  if (levelSettings) {
    patch.enabledLevels = JLPT_LEVELS.filter(level => levelSettings[level]?.enabled !== false)
  }
  if (typeof forceFullscreenMode === 'boolean') patch.pinSubtitlesToScreen = forceFullscreenMode

  await chrome.storage.sync.set(patch)
  await chrome.storage.local.remove(LEGACY_LOCAL_KEYS)
  await chrome.storage.sync.remove('forceFullscreenMode')
}
