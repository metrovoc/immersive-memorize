import { formatTime } from '@/lib/format'
import { t } from '@/lib/i18n'
import {
  decodeSubtitleBytes,
  isSubtitleFileName,
  parseSubtitleFile,
  SUBTITLE_FILE_EXTENSIONS,
  type SubtitleCue,
} from '@/lib/subtitle-file'
import { uiLayer } from './ui'

export type SubtitlesLoaded = (
  video: HTMLVideoElement,
  cues: SubtitleCue[],
  fileName: string
) => void

function describeVideo(video: HTMLVideoElement): string {
  const width = video.videoWidth || Math.round(video.clientWidth)
  const height = video.videoHeight || Math.round(video.clientHeight)
  return [`${width}×${height}`, formatTime(video.duration)].filter(Boolean).join(' · ')
}

/** Lets the user pick a video in this frame and load a subtitle file for it. */
export class SubtitlePicker {
  private elements: HTMLElement[] = []

  constructor(private readonly onLoaded: SubtitlesLoaded) {}

  /** Returns false when this frame has no visible video to offer. */
  open(): boolean {
    const videos = Array.from(document.querySelectorAll('video')).filter(video => {
      const rect = video.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })
    if (videos.length === 0) return false
    this.close()
    document.addEventListener('keydown', this.onKeyDown, true)
    if (videos.length === 1) this.showPanel(videos[0])
    else videos.forEach((video, index) => this.showChoice(video, index))
    return true
  }

  close(): void {
    this.elements.forEach(element => element.remove())
    this.elements = []
    document.removeEventListener('keydown', this.onKeyDown, true)
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    this.close()
  }

  private add<T extends HTMLElement>(element: T): T {
    uiLayer().appendChild(element)
    this.elements.push(element)
    return element
  }

  private showChoice(video: HTMLVideoElement, index: number): void {
    const rect = video.getBoundingClientRect()
    const choice = this.add(document.createElement('div'))
    choice.className = 'video-choice'
    Object.assign(choice.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    })
    const title = document.createElement('strong')
    title.textContent = t('pickerVideoNumber', index + 1)
    const details = document.createElement('span')
    details.textContent = describeVideo(video)
    const button = document.createElement('button')
    button.className = 'button'
    button.textContent = t('pickerChooseVideo')
    choice.append(title, details, button)
    choice.addEventListener('click', event => {
      event.stopPropagation()
      this.close()
      document.addEventListener('keydown', this.onKeyDown, true)
      this.showPanel(video)
    })
  }

  private showPanel(video: HTMLVideoElement): void {
    const panel = this.add(document.createElement('div'))
    panel.className = 'panel'
    panel.setAttribute('role', 'dialog')

    const heading = document.createElement('h2')
    heading.textContent = t('pickerTitle')
    const details = document.createElement('p')
    details.textContent = describeVideo(video)

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = SUBTITLE_FILE_EXTENSIONS.join(',')
    input.hidden = true

    const dropZone = document.createElement('div')
    dropZone.className = 'drop-zone'
    dropZone.tabIndex = 0
    const prompt = document.createElement('strong')
    prompt.textContent = t('pickerDropPrompt')
    const formats = document.createElement('span')
    formats.textContent = t('pickerFormats')
    dropZone.append(prompt, formats, input)

    const error = document.createElement('div')
    error.className = 'error'
    error.hidden = true

    const cancel = document.createElement('button')
    cancel.className = 'button secondary'
    cancel.textContent = t('cancel')
    cancel.addEventListener('click', () => this.close())
    const actions = document.createElement('div')
    actions.className = 'actions'
    actions.append(cancel)

    panel.append(heading, details, dropZone, error, actions)

    const load = async (file: File | undefined) => {
      if (!file) return
      error.hidden = true
      if (!isSubtitleFileName(file.name)) {
        error.textContent = t('pickerUnsupportedFile')
        error.hidden = false
        return
      }
      const text = decodeSubtitleBytes(new Uint8Array(await file.arrayBuffer()))
      const cues = parseSubtitleFile(file.name, text)
      if (cues.length === 0) {
        error.textContent = t('pickerNoCues')
        error.hidden = false
        return
      }
      this.close()
      this.onLoaded(video, cues, file.name)
    }

    dropZone.addEventListener('click', () => input.click())
    dropZone.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') input.click()
    })
    input.addEventListener('change', () => void load(input.files?.[0]))
    dropZone.addEventListener('dragover', event => {
      event.preventDefault()
      dropZone.classList.add('dragging')
    })
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'))
    dropZone.addEventListener('drop', event => {
      event.preventDefault()
      dropZone.classList.remove('dragging')
      void load(event.dataTransfer?.files[0])
    })

    // Place the panel at the video's bottom-right corner, kept inside the viewport.
    const rect = video.getBoundingClientRect()
    const width = 320
    const height = panel.offsetHeight || 260
    const left = Math.min(Math.max(8, rect.right - width - 16), window.innerWidth - width - 8)
    const top = Math.min(Math.max(8, rect.bottom - height - 16), window.innerHeight - height - 8)
    panel.style.left = `${left}px`
    panel.style.top = `${Math.max(8, top)}px`
    dropZone.focus()
  }
}
