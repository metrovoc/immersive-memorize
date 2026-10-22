import type { MediaInfo, SubtitleSource } from './types'

const SUBTITLE_ROOT = '.player-timedtext'
const SUBTITLE_SELECTOR = '.player-timedtext-text-container'

function touchesSubtitles(mutation: MutationRecord): boolean {
  if ((mutation.target as Element).closest?.(SUBTITLE_ROOT)) return true
  return [...mutation.addedNodes, ...mutation.removedNodes].some(
    node =>
      node instanceof Element &&
      (node.matches(`${SUBTITLE_ROOT}, ${SUBTITLE_SELECTOR}`) ||
        node.querySelector(SUBTITLE_SELECTOR) !== null)
  )
}

const TITLE_SELECTORS = [
  'h4.ellipsize-text',
  '[data-uia="video-title"]',
  '.video-title',
  '.title-info-metadata h1',
  '.fallback-text-container h1',
  '.player-status-main-title',
  '[data-uia="title-field"]',
  '.video-metadata .show-title',
  '.episode-metadata .show-title',
]
const SEASON_SELECTORS = [
  '[data-uia="season-selector"] .current-season',
  '[data-uia="season-selector"]',
  '.season-label',
  '.current-season',
  '.episode-metadata .season-info',
  '.season-number',
  '.player-status-season',
  '[data-uia="season-field"]',
]
const EPISODE_SELECTORS = [
  '[data-uia="episode-title"]',
  '.episode-title',
  '.current-episode',
  '.episode-number',
  '.player-status-episode',
  '.episode-selector .selected .episode-number',
  '[data-uia="episode-field"]',
]
const EPISODE_TITLE_SELECTORS = [
  '[data-uia="episode-title"] .episode-title-1',
  '.episode-title-text',
  '.episode-title-name',
  '.episode-metadata .episode-title',
  '.player-status-episode-title',
  '.episode-selector .selected .episode-title',
]

function firstText(selectors: string[], pattern?: RegExp): string | undefined {
  for (const selector of selectors) {
    const text = document.querySelector(selector)?.textContent?.trim()
    if (text && (!pattern || pattern.test(text))) return text
  }
  return undefined
}

export function isNetflixPlayer(): boolean {
  return /(^|\.)netflix\.com$/.test(location.hostname) && document.querySelector('video') !== null
}

/** Netflix's own subtitles, which it renders as DOM text over the player. */
export class NetflixSubtitleSource implements SubtitleSource {
  private observer: MutationObserver | null = null
  private frame = 0

  start(onSubtitles: (containers: HTMLElement[]) => void): void {
    this.stop()
    const report = () => {
      this.frame = 0
      onSubtitles(this.containers())
    }
    this.observer = new MutationObserver(mutations => {
      if (!this.frame && mutations.some(touchesSubtitles))
        this.frame = requestAnimationFrame(report)
    })
    this.observer.observe(document.body, { childList: true, subtree: true })
    report()
  }

  stop(): void {
    this.observer?.disconnect()
    this.observer = null
    cancelAnimationFrame(this.frame)
    this.frame = 0
  }

  containers(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>(SUBTITLE_SELECTOR))
  }

  video(): HTMLVideoElement | null {
    return document.querySelector('video')
  }

  mediaInfo(): MediaInfo {
    const showTitle =
      firstText(TITLE_SELECTORS) || document.title.replace(/\s*[-|]\s*Netflix$/, '') || undefined
    const seasonNumber = firstText(SEASON_SELECTORS, /(第|Season|S)\s*\d+/i)
    const episodeNumber = firstText(EPISODE_SELECTORS, /(第|Episode|E|EP)\s*\d+/i)
    const episodeTitle = firstText(EPISODE_TITLE_SELECTORS)
    const fullTitle = [showTitle, seasonNumber, episodeNumber, episodeTitle && `"${episodeTitle}"`]
      .filter(Boolean)
      .join(' ')
    return {
      fullTitle: fullTitle || 'Netflix',
      showTitle,
      seasonNumber,
      episodeNumber,
      episodeTitle,
    }
  }
}
