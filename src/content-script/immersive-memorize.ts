import { sanitizeSentenceHtml } from '@/lib/html'
import { t } from '@/lib/i18n'
import { createLogger, errorMessage, setDebugLogging } from '@/lib/logger'
import { callBackground, type ContentMessage, type CropRect } from '@/lib/messages'
import { DEFAULT_SETTINGS, getSettings, onSettingsChanged, type Settings } from '@/lib/settings'
import { onCardsChanged } from '@/lib/storage/revision'
import type { SubtitleCue } from '@/lib/subtitle-file'
import type { FlashCard, Word } from '@/types'
import { SubtitlePicker } from './subtitle-picker'
import { clearHighlights, highlightWord, SubtitleProcessor } from './subtitle-processor'
import { CustomSubtitleSource } from './subtitle-sources/custom-source'
import { isNetflixPlayer, NetflixSubtitleSource } from './subtitle-sources/netflix-source'
import type { SubtitleSource } from './subtitle-sources/types'
import { ensureHighlightStyle, toast } from './ui'

const log = createLogger('content')

interface Target {
  word: Word
  container: HTMLElement
  element: HTMLElement
}

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

function sameWords(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every(word => b.has(word))
}

/** Runs in every frame of an activated tab: highlights one new word at a time and saves cards. */
export class ImmersiveMemorize {
  private settings: Settings = DEFAULT_SETTINGS
  private source: SubtitleSource | null = null
  private custom: CustomSubtitleSource | null = null
  private processor: SubtitleProcessor | null = null
  private processorReady: Promise<SubtitleProcessor> | null = null
  private learnedWords = new Set<string>()
  private learnedVersion = 0
  private target: Target | null = null
  private signature = ''
  private pending: HTMLElement[] | null = null
  private draining = false
  private capturing = false
  private readonly picker = new SubtitlePicker((video, cues, fileName) =>
    this.useCustomSubtitles(video, cues, fileName)
  )

  async start(): Promise<void> {
    chrome.runtime.onMessage.addListener(this.onMessage)
    document.addEventListener('keydown', this.onKeyDown, true)
    this.settings = await getSettings()
    setDebugLogging(this.settings.debugMode)
    onSettingsChanged(patch => this.applySettings(patch))
    onCardsChanged(() => void this.reloadLearnedWords())
    if (/(^|\.)netflix\.com$/.test(location.hostname)) this.watchNetflix()
  }

  private readonly onMessage = (
    message: ContentMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ): boolean => {
    switch (message?.type) {
      case 'ping':
        sendResponse({ pong: true })
        break
      case 'openSubtitlePicker':
        // Frames without a video stay silent so the frame that has one can answer.
        if (this.picker.open()) sendResponse({ opened: true })
        break
      case 'previewSubtitleStyle':
        this.custom?.setStyle(message.style)
        break
    }
    return false
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.source || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key.toLowerCase() !== this.settings.captureHotkey || isEditable(event.target)) return
    if (this.source.containers().length === 0) return
    if (!this.target) {
      toast(t('toastNoNewWord'), 'info')
      return
    }
    event.preventDefault()
    event.stopImmediatePropagation()
    void this.capture()
  }

  private watchNetflix(): void {
    let timer = 0
    const check = () => {
      timer = 0
      const available = isNetflixPlayer()
      if (available && !this.source) void this.activate(new NetflixSubtitleSource())
      else if (!available && this.source instanceof NetflixSubtitleSource) this.deactivate()
    }
    new MutationObserver(() => {
      timer ||= window.setTimeout(check, 500)
    }).observe(document.body, { childList: true, subtree: true })
    check()
  }

  private useCustomSubtitles(video: HTMLVideoElement, cues: SubtitleCue[], fileName: string): void {
    const source = new CustomSubtitleSource(
      video,
      cues,
      fileName,
      this.settings.subtitleStyle,
      this.settings.pinSubtitlesToScreen
    )
    void this.activate(source).then(active => {
      if (active) toast(t('toastSubtitlesLoaded', source.cueCount, fileName))
    })
  }

  private async activate(source: SubtitleSource): Promise<boolean> {
    this.deactivate()
    this.source = source
    this.custom = source instanceof CustomSubtitleSource ? source : null
    try {
      await this.ensureProcessor()
    } catch (error) {
      log.error('Loading the vocabulary failed:', error)
      toast(t('toastStartFailed', errorMessage(error)), 'error')
      if (this.source === source) this.deactivate()
      return false
    }
    if (this.source !== source) return false
    ensureHighlightStyle()
    source.start(containers => this.onSubtitles(containers))
    log.debug('Started', source.constructor.name)
    return true
  }

  private deactivate(): void {
    this.source?.stop()
    this.source = null
    this.custom = null
    this.target = null
    this.signature = ''
    clearHighlights()
  }

  private ensureProcessor(): Promise<SubtitleProcessor> {
    this.processorReady ??= Promise.all([
      callBackground('getActiveWords', {}),
      callBackground('getLearnedWords', {}),
    ]).then(
      ([activeWords, learnedWords]) => {
        this.learnedWords = new Set(learnedWords)
        this.processor = new SubtitleProcessor(new Map(activeWords), this.learnedWords)
        return this.processor
      },
      error => {
        this.processorReady = null
        throw error
      }
    )
    return this.processorReady
  }

  /** Processes the latest subtitles; updates that arrive meanwhile replace each other. */
  private onSubtitles(containers: HTMLElement[]): void {
    this.pending = containers
    if (this.draining) return
    this.draining = true
    void (async () => {
      try {
        while (this.pending) {
          const next = this.pending
          this.pending = null
          await this.process(next)
        }
      } catch (error) {
        log.error('Processing subtitles failed:', error)
      } finally {
        this.draining = false
      }
    })()
  }

  private async process(containers: HTMLElement[]): Promise<void> {
    const processor = this.processor
    if (!processor) return
    const signature = `${this.learnedVersion}|${containers.map(c => c.textContent).join('\n')}`
    if (signature === this.signature && (!this.target || this.target.element.isConnected)) return
    this.signature = signature

    let found: { word: Word; container: HTMLElement } | null = null
    for (const container of containers) {
      const word = await processor.findTarget(container)
      if (word) {
        found = { word, container }
        break
      }
    }

    // Swap highlights in one step so the old one never disappears before the new one shows.
    clearHighlights()
    this.target = null
    if (found?.container.isConnected) {
      const element = highlightWord(found.container, found.word)
      if (element) this.target = { ...found, element }
    }
    log.debug('Target word:', this.target?.word.lemma ?? 'none')
  }

  private refresh(): void {
    if (this.source) this.onSubtitles(this.source.containers())
  }

  private async capture(): Promise<void> {
    const target = this.target
    const source = this.source
    if (!target || !source || this.capturing) return
    const lemma = target.word.lemma
    if (this.learnedWords.has(lemma)) {
      toast(t('toastAlreadySaved', lemma), 'warning')
      return
    }

    this.capturing = true
    try {
      const video = source.video()
      const [info, screenshot] = await Promise.all([
        callBackground('lookupWord', { word: lemma }),
        this.settings.enableScreenshot ? this.screenshot(video) : Promise.resolve(''),
      ])
      const media = source.mediaInfo()
      const card: FlashCard = {
        id: Date.now(),
        word: lemma,
        sentence: sanitizeSentenceHtml(target.container.innerHTML),
        timestamp: Math.floor(video?.currentTime ?? 0),
        screenshot,
        sourceTitle: media.fullTitle,
        createdAt: new Date().toISOString(),
        level: info?.level,
        definition: info?.definition,
        reading: info?.reading,
        showTitle: media.showTitle,
        seasonNumber: media.seasonNumber,
        episodeNumber: media.episodeNumber,
        episodeTitle: media.episodeTitle,
      }
      await callBackground('addCard', { card })
      this.learnedWords.add(lemma)
      this.learnedVersion++
      toast(
        target.word.word === lemma
          ? t('toastSaved', lemma)
          : t('toastSavedInflected', target.word.word, lemma)
      )
      this.refresh()
    } catch (error) {
      log.error('Saving the card failed:', error)
      toast(t('toastSaveFailed', errorMessage(error)), 'error')
    } finally {
      this.capturing = false
    }
  }

  private async screenshot(video: HTMLVideoElement | null): Promise<string> {
    let crop: CropRect | undefined
    // Coordinates inside a frame do not map onto the tab's capture, so only crop in the top frame.
    if (video && window === window.top) {
      const rect = video.getBoundingClientRect()
      crop = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        viewportWidth: window.innerWidth,
      }
    }
    try {
      return await callBackground('captureScreenshot', { crop })
    } catch (error) {
      log.warn('Screenshot failed:', error)
      toast(t('toastScreenshotFailed'), 'warning')
      return ''
    }
  }

  private applySettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch }
    if (patch.debugMode !== undefined) setDebugLogging(patch.debugMode)
    if (patch.subtitleStyle) this.custom?.setStyle(patch.subtitleStyle)
    if (patch.pinSubtitlesToScreen !== undefined) this.custom?.setPinned(patch.pinSubtitlesToScreen)
    if (patch.enabledLevels && this.processor) void this.reloadActiveWords()
  }

  private async reloadActiveWords(): Promise<void> {
    const activeWords = await callBackground('getActiveWords', {})
    this.processor?.setActiveWords(new Map(activeWords))
    this.learnedVersion++
    this.refresh()
  }

  private async reloadLearnedWords(): Promise<void> {
    if (!this.processor) return
    const learnedWords = new Set(await callBackground('getLearnedWords', {}))
    if (sameWords(learnedWords, this.learnedWords)) return
    this.learnedWords = learnedWords
    this.processor.setLearnedWords(learnedWords)
    this.learnedVersion++
    this.refresh()
  }
}
