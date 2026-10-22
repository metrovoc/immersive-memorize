export interface SubtitleCue {
  start: number
  end: number
  /** Text with `\n` line breaks and only the markup listed in CUE_TAGS. */
  text: string
}

export const SUBTITLE_FILE_EXTENSIONS = ['.srt', '.vtt', '.ass', '.ssa']

const CUE_TAGS = ['i', 'b', 'u', 'ruby', 'rt'] as const
const CUE_TAG_PATTERN = new RegExp(`<(/?)(${CUE_TAGS.join('|')})>`, 'gi')

export function isSubtitleFileName(name: string): boolean {
  const lower = name.toLowerCase()
  return SUBTITLE_FILE_EXTENSIONS.some(extension => lower.endsWith(extension))
}

/** Decodes subtitle bytes, falling back to legacy Japanese encodings such as Shift_JIS. */
export function decodeSubtitleBytes(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
  for (const encoding of ['utf-8', 'shift_jis', 'euc-jp']) {
    try {
      return new TextDecoder(encoding, { fatal: true }).decode(bytes)
    } catch {
      // Try the next encoding.
    }
  }
  return new TextDecoder('gb18030').decode(bytes)
}

export function parseSubtitleFile(fileName: string, content: string): SubtitleCue[] {
  const text = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const isAss = /\.(ass|ssa)$/i.test(fileName) || /^\s*\[Script Info\]/i.test(text)
  const cues = isAss ? parseAss(text) : parseSrtOrVtt(text)
  return cues
    .filter(cue => cue.text.trim() && cue.end > cue.start)
    .sort((a, b) => a.start - b.start)
}

const TIMING = /((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})/

function parseSrtOrVtt(text: string): SubtitleCue[] {
  const cues: SubtitleCue[] = []
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.split('\n')
    const timingIndex = lines.findIndex(line => TIMING.test(line))
    if (timingIndex === -1) continue
    const [, start, end] = lines[timingIndex].match(TIMING)!
    cues.push({
      start: parseTimestamp(start),
      end: parseTimestamp(end),
      text: cleanMarkup(lines.slice(timingIndex + 1).join('\n')),
    })
  }
  return cues
}

/** Parses `hh:mm:ss,mmm`, `mm:ss.mmm` and ASS `h:mm:ss.cc` timestamps into seconds. */
export function parseTimestamp(value: string): number {
  const [clock, fraction = '0'] = value.trim().split(/[.,]/)
  const seconds = clock
    .split(':')
    .map(Number)
    .reduce((total, part) => total * 60 + part, 0)
  return seconds + Number(`0.${fraction}`)
}

/** Keeps the tags we render and drops the rest (font tags, VTT classes and voices, timestamps). */
function cleanMarkup(text: string): string {
  return text
    .replace(/<\/?([a-z][\w.-]*)(\s[^>]*)?>|<\d[^>]*>/gi, (tag, name: string | undefined) => {
      const base = name?.split('.')[0].toLowerCase()
      return base && (CUE_TAGS as readonly string[]).includes(base)
        ? tag.startsWith('</')
          ? `</${base}>`
          : `<${base}>`
        : ''
    })
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

function parseAss(text: string): SubtitleCue[] {
  const cues: SubtitleCue[] = []
  let format: string[] = []
  let inEvents = false
  for (const line of text.split('\n')) {
    const section = line.match(/^\s*\[(.+)\]\s*$/)
    if (section) {
      inEvents = section[1].toLowerCase() === 'events'
      continue
    }
    if (!inEvents) continue
    const [, kind, rest] = line.match(/^\s*(Format|Dialogue)\s*:\s*(.*)$/i) ?? []
    if (kind?.toLowerCase() === 'format') {
      format = rest.split(',').map(field => field.trim().toLowerCase())
      continue
    }
    if (kind?.toLowerCase() !== 'dialogue' || format.length === 0) continue
    const fields = rest.split(',')
    // The text field is last and may itself contain commas.
    const values = [
      ...fields.slice(0, format.length - 1),
      fields.slice(format.length - 1).join(','),
    ]
    const field = (name: string) => values[format.indexOf(name)] ?? ''
    const raw = field('text')
    if (/\\p[1-9]/.test(raw)) continue // Vector drawings, not dialogue.
    cues.push({
      start: parseTimestamp(field('start')),
      end: parseTimestamp(field('end')),
      text: cleanMarkup(
        raw
          .replace(/\{[^}]*\}/g, '')
          .replace(/\\[Nn]/g, '\n')
          .replace(/\\h/g, ' ')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
      ),
    })
  }
  return cues
}

/** Text of the cues showing at `time`, one cue per line. */
export function activeCueText(cues: SubtitleCue[], time: number): string {
  return cues
    .filter(cue => cue.start <= time && time < cue.end)
    .map(cue => cue.text)
    .join('\n')
}

/** Renders cue text into `container` with DOM nodes, so subtitle files can never inject markup. */
export function renderCueText(container: HTMLElement, text: string): void {
  container.replaceChildren()
  const stack: HTMLElement[] = [container]
  let lastIndex = 0
  const appendText = (value: string) => {
    value.split('\n').forEach((line, index) => {
      if (index > 0) stack[stack.length - 1].appendChild(document.createElement('br'))
      if (line) stack[stack.length - 1].appendChild(document.createTextNode(line))
    })
  }
  for (const match of text.matchAll(CUE_TAG_PATTERN)) {
    appendText(text.slice(lastIndex, match.index))
    lastIndex = match.index + match[0].length
    const [, closing, name] = match
    const tag = name.toLowerCase()
    if (closing) {
      const index = stack.findLastIndex((element, i) => i > 0 && element.localName === tag)
      if (index > 0) stack.length = index
    } else {
      const element = document.createElement(tag)
      stack[stack.length - 1].appendChild(element)
      stack.push(element)
    }
  }
  appendText(text.slice(lastIndex))
}
