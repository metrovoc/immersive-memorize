import type { SubtitleStyle } from '@/lib/settings'
import { activeCueText, renderCueText, type SubtitleCue } from '@/lib/subtitle-file'
import type { MediaInfo, SubtitleSource } from './types'

/** The closest ancestor that frames the video, so the overlay can sit inside the player. */
function findVideoContainer(video: HTMLVideoElement): HTMLElement | null {
  let element = video.parentElement
  while (element && element !== document.body) {
    const rect = element.getBoundingClientRect()
    const position = getComputedStyle(element).position
    const coversVideo =
      rect.width >= video.clientWidth * 0.8 && rect.height >= video.clientHeight * 0.8
    if (rect.width > 0 && rect.height > 0 && (coversVideo || position !== 'static')) {
      return element
    }
    element = element.parentElement
  }
  return null
}

/** Subtitles from a file the user loaded, drawn over a video they picked. */
export class CustomSubtitleSource implements SubtitleSource {
  private readonly overlay = document.createElement('div')
  private container: HTMLElement | null = null
  private containerPosition: string | null = null
  private text = ''
  private onSubtitles: ((containers: HTMLElement[]) => void) | null = null
  private cleanups: (() => void)[] = []

  constructor(
    private readonly target: HTMLVideoElement,
    private readonly cues: SubtitleCue[],
    readonly fileName: string,
    private style: SubtitleStyle,
    private pinned: boolean
  ) {
    this.overlay.className = 'im-custom-subtitle-overlay'
  }

  get cueCount(): number {
    return this.cues.length
  }

  start(onSubtitles: (containers: HTMLElement[]) => void): void {
    this.stop()
    this.onSubtitles = onSubtitles
    this.findContainer()

    const sync = () => this.sync()
    let frame = 0
    const place = () => {
      frame ||= requestAnimationFrame(() => {
        frame = 0
        this.place()
      })
    }
    for (const event of ['timeupdate', 'seeked', 'loadedmetadata']) {
      this.target.addEventListener(event, sync)
      this.cleanups.push(() => this.target.removeEventListener(event, sync))
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, { capture: true, passive: true })
    document.addEventListener('fullscreenchange', place)
    // Players can move the video without any event we could observe.
    const interval = window.setInterval(place, 1000)
    this.cleanups.push(() => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, { capture: true })
      document.removeEventListener('fullscreenchange', place)
      window.clearInterval(interval)
      cancelAnimationFrame(frame)
    })

    this.place()
    this.sync()
  }

  stop(): void {
    this.cleanups.forEach(cleanup => cleanup())
    this.cleanups = []
    this.overlay.remove()
    this.restoreContainer()
    this.text = ''
    this.onSubtitles = null
  }

  containers(): HTMLElement[] {
    return this.text ? [this.overlay] : []
  }

  video(): HTMLVideoElement {
    return this.target
  }

  mediaInfo(): MediaInfo {
    return { fullTitle: document.title.trim() || this.fileName }
  }

  setStyle(style: SubtitleStyle): void {
    this.style = style
    this.place()
    this.sync()
  }

  setPinned(pinned: boolean): void {
    if (pinned === this.pinned) return
    this.pinned = pinned
    this.findContainer()
    this.place()
  }

  private findContainer(): void {
    this.restoreContainer()
    this.container = this.pinned ? null : findVideoContainer(this.target)
    if (this.container && getComputedStyle(this.container).position === 'static') {
      this.containerPosition = this.container.style.position
      this.container.style.position = 'relative'
    }
  }

  private restoreContainer(): void {
    if (this.container && this.containerPosition !== null) {
      this.container.style.position = this.containerPosition
    }
    this.container = null
    this.containerPosition = null
  }

  private sync(): void {
    const text = activeCueText(this.cues, this.target.currentTime + this.style.timeOffset)
    if (text === this.text) return
    this.text = text
    renderCueText(this.overlay, text)
    this.overlay.style.display = text ? 'block' : 'none'
    this.onSubtitles?.(this.containers())
  }

  /** Puts the overlay inside the player, or over it when the player cannot host it. */
  private place(): void {
    const fullscreen =
      document.fullscreenElement?.localName === 'video' ? null : document.fullscreenElement
    const inPlayer = this.container && (!fullscreen || fullscreen.contains(this.container))
    const parent = inPlayer ? this.container! : (fullscreen ?? document.body)
    if (this.overlay.parentElement !== parent) parent.appendChild(this.overlay)

    const { fontSize, verticalPosition, backgroundOpacity } = this.style
    let placement: string
    if (inPlayer) {
      placement = `position: absolute; left: 50%; bottom: ${verticalPosition}px;`
    } else if (this.pinned) {
      placement = `position: fixed; left: 50%; bottom: ${verticalPosition}px;`
    } else {
      const rect = this.target.getBoundingClientRect()
      placement = `position: fixed; left: ${rect.left + rect.width / 2}px;
        bottom: ${window.innerHeight - rect.bottom + verticalPosition}px;`
    }
    this.overlay.style.cssText = `${placement}
      transform: translateX(-50%); max-width: 80%; width: max-content;
      display: ${this.text ? 'block' : 'none'}; padding: 0.25em 0.6em; border-radius: 6px;
      background: rgba(0, 0, 0, ${backgroundOpacity / 100}); color: #fff;
      font: 600 ${fontSize}px/1.5 system-ui, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif;
      text-align: center; text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.9);
      z-index: 2147483647; pointer-events: none;`
  }
}
