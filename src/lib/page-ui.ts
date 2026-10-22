import type { FlashCard, ToastType } from '@/types'
import { formatTime } from './format'
import { escapeHtml, sanitizeSentenceHtml } from './html'
import { t } from './i18n'
import { icons } from './icons'

const TOAST_COLORS: Record<ToastType, string> = {
  success: 'bg-success text-white',
  error: 'bg-destructive text-destructive-foreground',
  warning: 'bg-warning text-white',
  info: 'bg-primary text-primary-foreground',
}

/** A short status message in the corner of an extension page. */
export function showToast(message: string, type: ToastType = 'success'): void {
  let list = document.getElementById('toasts')
  if (!list) {
    list = document.createElement('div')
    list.id = 'toasts'
    list.className = 'fixed top-4 right-4 z-50 flex flex-col items-end gap-2'
    list.setAttribute('role', 'status')
    document.body.appendChild(list)
  }
  const toast = document.createElement('div')
  toast.className = `max-w-xs rounded-md px-4 py-2 text-sm font-medium shadow-lg transition-opacity duration-300 ${TOAST_COLORS[type]}`
  toast.textContent = message
  list.appendChild(toast)
  setTimeout(() => {
    toast.classList.add('opacity-0')
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(t('htmlLang'))
}

/** Markup for one flashcard; buttons carry `data-action` and `data-card-id`. */
export function cardHtml(card: FlashCard, options: { highlighted?: boolean } = {}): string {
  const reading =
    card.reading && card.reading !== card.word
      ? `<div class="text-sm text-muted-foreground">${escapeHtml(card.reading)}</div>`
      : ''
  const definition = card.definition
    ? `<div class="mt-1 text-sm">${escapeHtml(card.definition)}</div>`
    : ''
  const sentence = card.sentence
    ? `<div class="sentence mt-2 border-l-2 pl-3 text-sm leading-relaxed text-foreground/80">${sanitizeSentenceHtml(card.sentence)}</div>`
    : ''
  const meta = [card.sourceTitle, formatTime(card.timestamp), formatDate(card.createdAt)]
    .filter(Boolean)
    .map(escapeHtml)
    .join(' · ')
  const screenshotButton =
    card.hasScreenshot || card.screenshot
      ? `<button class="btn btn-ghost btn-icon text-muted-foreground" data-action="screenshot" data-card-id="${card.id}" title="${escapeHtml(t('cardViewScreenshot'))}" aria-label="${escapeHtml(t('cardViewScreenshot'))}">${icons.image()}</button>`
      : ''

  return `
    <article class="card group p-4 ${options.highlighted ? 'ring-2 ring-primary' : ''}" data-card-word="${escapeHtml(card.word)}" data-card-id="${card.id}">
      <div class="flex items-start gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-lg font-bold text-primary">${escapeHtml(card.word)}</span>
            ${card.level ? `<span class="badge">${escapeHtml(card.level)}</span>` : ''}
          </div>
          ${reading}${definition}${sentence}
          <div class="mt-2 text-xs text-muted-foreground">${meta}</div>
        </div>
        <div class="flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          ${screenshotButton}
          <button class="btn btn-ghost btn-icon text-destructive" data-action="delete" data-card-id="${card.id}" title="${escapeHtml(t('cardDelete'))}" aria-label="${escapeHtml(t('cardDelete'))}">${icons.trash()}</button>
        </div>
      </div>
    </article>`
}
