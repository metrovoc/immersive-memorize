import type { CsvExportFormat, FlashCard } from '@/types'
import { formatTime } from './format'
import { sanitizeSentenceHtml } from './html'

const SEPARATOR = ';'

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field
}

function parse(html: string): HTMLTemplateElement {
  const template = document.createElement('template')
  template.innerHTML = sanitizeSentenceHtml(html)
  return template
}

function serialize(template: HTMLTemplateElement): string {
  return template.innerHTML.replace(/\s+/g, ' ').trim()
}

/** Plain text without furigana. */
function toPlainText(html: string): string {
  const template = parse(html)
  template.content.querySelectorAll('rt, rp').forEach(element => element.remove())
  return (template.content.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** Anki's furigana syntax (` 漢字[かんじ]`), with the target word in bold. */
function toAnkiHtml(html: string): string {
  const template = parse(html)
  template.content.querySelectorAll('ruby').forEach(ruby => {
    const reading = ruby.querySelector('rt')?.textContent?.trim() ?? ''
    ruby.querySelectorAll('rt, rp').forEach(element => element.remove())
    const base = ruby.textContent?.trim() ?? ''
    ruby.replaceWith(reading ? ` ${base}[${reading}]` : base)
  })
  template.content.querySelectorAll('.im-highlight').forEach(highlight => {
    const bold = document.createElement('b')
    bold.textContent = highlight.textContent
    highlight.replaceWith(bold)
  })
  return serialize(template)
}

/** HTML that keeps ruby annotations and colors the target word. */
function toRichHtml(html: string): string {
  const template = parse(html)
  template.content.querySelectorAll('.im-highlight').forEach(highlight => {
    highlight.setAttribute('style', 'color: #e65100; font-weight: bold')
  })
  return serialize(template)
}

export function exportCardsToCsv(cards: FlashCard[], format: CsvExportFormat): string {
  const html = format !== 'plain-text'
  const columns = ['Word', 'Reading', 'Definition', 'Sentence']
  if (html) columns.push('Screenshot')
  columns.push('Timestamp', 'Source')

  const rows = cards.map(card => {
    const sentence =
      format === 'plain-text'
        ? toPlainText(card.sentence)
        : format === 'anki-html'
          ? toAnkiHtml(card.sentence)
          : toRichHtml(card.sentence)
    const fields = [card.word, card.reading ?? '', card.definition ?? '', sentence]
    if (html) fields.push(card.screenshot ? `<img src="${card.screenshot}">` : '')
    fields.push(formatTime(card.timestamp), card.sourceTitle)
    return fields.map(escapeField).join(SEPARATOR)
  })

  // Anki reads these headers to pick the separator, enable HTML and name the fields.
  const header =
    format === 'anki-html'
      ? ['#separator:Semicolon', '#html:true', `#columns:${columns.join(SEPARATOR)}`]
      : [columns.join(SEPARATOR)]
  return [...header, ...rows].join('\n')
}

export function downloadFile(content: BlobPart, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
