export interface MediaInfo {
  fullTitle: string
  showTitle?: string
  seasonNumber?: string
  episodeNumber?: string
  episodeTitle?: string
}

/** Where subtitles come from: a site's own subtitles or a file the user loaded. */
export interface SubtitleSource {
  /** Starts reporting the elements that currently show subtitle text. */
  start(onSubtitles: (containers: HTMLElement[]) => void): void
  stop(): void
  containers(): HTMLElement[]
  mediaInfo(): MediaInfo
  video(): HTMLVideoElement | null
}
