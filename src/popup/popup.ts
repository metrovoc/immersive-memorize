import '../globals.css'
import { escapeHtml } from '@/lib/html'
import { localizePage, t } from '@/lib/i18n'
import { icons } from '@/lib/icons'
import { callBackground, type ContentMessage } from '@/lib/messages'
import { cardHtml, showToast } from '@/lib/page-ui'
import {
  DEFAULT_SUBTITLE_STYLE,
  getSettings,
  updateSettings,
  type SubtitleStyle,
} from '@/lib/settings'
import { cardStore, onCardsChanged } from '@/lib/storage'
import type { FlashCard } from '@/types'

const PAGE_SIZE = 10
const ALL_SITES = { origins: ['<all_urls>'] }

let cards: FlashCard[] = []
let page = 0
let style: SubtitleStyle = DEFAULT_SUBTITLE_STYLE
let activeTab: chrome.tabs.Tab | undefined
let hotkey = 'S'

const app = document.getElementById('app')!

function render(): void {
  app.innerHTML = `
    <header class="flex items-center justify-between gap-2 px-4 pt-4">
      <div class="flex items-center gap-2">
        <img src="../icons/icon48.png" alt="" class="size-6" />
        <h1 class="text-base font-semibold">${escapeHtml(t('extName'))}</h1>
      </div>
      <button id="open-options" class="btn btn-ghost btn-icon" title="${escapeHtml(t('popupOpenOptions'))}" aria-label="${escapeHtml(t('popupOpenOptions'))}">${icons.settings()}</button>
    </header>
    <p id="status" class="px-4 pt-1 text-xs text-muted-foreground"></p>
    <nav class="mx-4 mt-3 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist">
      <button id="tab-cards" class="tab btn" role="tab">${icons.cards()}${escapeHtml(t('popupTabCards'))}</button>
      <button id="tab-subtitles" class="tab btn" role="tab">${icons.subtitles()}${escapeHtml(t('popupTabSubtitles'))}</button>
    </nav>

    <section id="view-cards" class="space-y-3 p-4" role="tabpanel">
      <button id="open-library" class="btn btn-outline w-full justify-between"></button>
      <div id="card-list" class="max-h-[340px] space-y-2 overflow-y-auto pr-1"></div>
      <div id="pagination" class="flex items-center justify-center gap-3">
        <button id="previous-page" class="btn btn-ghost btn-icon" aria-label="${escapeHtml(t('previousPage'))}">${icons.chevronLeft()}</button>
        <span id="page-info" class="min-w-20 text-center text-xs text-muted-foreground"></span>
        <button id="next-page" class="btn btn-ghost btn-icon" aria-label="${escapeHtml(t('nextPage'))}">${icons.chevronRight()}</button>
      </div>
    </section>

    <section id="view-subtitles" class="hidden space-y-3 p-4" role="tabpanel">
      <div class="card space-y-3 p-4">
        <div>
          <h2 class="font-semibold">${escapeHtml(t('popupCustomSubtitlesTitle'))}</h2>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(t('popupCustomSubtitlesDescription'))}</p>
        </div>
        <button id="load-subtitles" class="btn btn-primary w-full">${icons.upload()}${escapeHtml(t('popupLoadSubtitles'))}</button>
        <div id="subtitle-message" class="hidden rounded-md bg-muted p-3 text-sm"></div>
      </div>
      <div class="card space-y-4 p-4">
        <h2 class="font-semibold">${escapeHtml(t('popupAppearanceTitle'))}</h2>
        ${slider('fontSize', t('popupFontSize'), 12, 48, 1)}
        ${slider('verticalPosition', t('popupPosition'), 0, 300, 5)}
        ${slider('backgroundOpacity', t('popupBackground'), 0, 100, 5)}
        <div class="space-y-1">
          <div class="flex items-center justify-between text-sm">
            <label for="timeOffset" class="font-medium">${escapeHtml(t('popupTimeOffset'))}</label>
            <span class="flex items-center gap-1">
              <input id="timeOffsetNumber" type="number" step="0.1" class="input h-7 w-20 px-2 text-right" aria-label="${escapeHtml(t('popupTimeOffset'))}" />
              <span class="text-muted-foreground">s</span>
            </span>
          </div>
          <input id="timeOffset" type="range" min="-15" max="15" step="0.1" class="range" />
          <p class="text-xs text-muted-foreground">${escapeHtml(t('popupTimeOffsetHint'))}</p>
        </div>
        <label class="flex items-start justify-between gap-3 border-t pt-3">
          <span>
            <span class="block text-sm font-medium">${escapeHtml(t('popupPinSubtitles'))}</span>
            <span class="block text-xs text-muted-foreground">${escapeHtml(t('popupPinSubtitlesHint'))}</span>
          </span>
          <input id="pin-subtitles" type="checkbox" class="switch mt-0.5" />
        </label>
        <button id="reset-style" class="btn btn-outline w-full">${escapeHtml(t('popupResetStyle'))}</button>
      </div>
    </section>`
}

function slider(id: keyof SubtitleStyle, label: string, min: number, max: number, step: number) {
  return `
    <div class="space-y-1">
      <div class="flex items-center justify-between text-sm">
        <label for="${id}" class="font-medium">${escapeHtml(label)}</label>
        <span id="${id}Value" class="text-muted-foreground"></span>
      </div>
      <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" class="range" />
    </div>`
}

function element<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

function showTab(tab: 'cards' | 'subtitles'): void {
  for (const name of ['cards', 'subtitles'] as const) {
    const selected = name === tab
    const button = element(`tab-${name}`)
    button.setAttribute('aria-selected', String(selected))
    button.classList.toggle('bg-background', selected)
    button.classList.toggle('shadow-sm', selected)
    button.classList.toggle('text-muted-foreground', !selected)
    element(`view-${name}`).classList.toggle('hidden', !selected)
  }
}

function renderCards(): void {
  const pages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE))
  page = Math.min(page, pages - 1)
  element('open-library').innerHTML =
    `<span>${escapeHtml(t('popupCardCount', cards.length))}</span><span class="text-xs text-muted-foreground">${escapeHtml(t('popupViewAll'))}</span>`

  const list = element('card-list')
  if (cards.length === 0) {
    list.innerHTML = `
      <div class="py-10 text-center text-sm text-muted-foreground">
        <p class="mb-1 font-medium text-foreground">${escapeHtml(t('popupEmptyTitle'))}</p>
        <p>${escapeHtml(t('popupEmptyHint', hotkey))}</p>
      </div>`
  } else {
    list.innerHTML = cards
      .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
      .map(card => cardHtml(card))
      .join('')
  }

  element('pagination').classList.toggle('hidden', pages <= 1)
  element('page-info').textContent = t('pageInfo', page + 1, pages)
  element<HTMLButtonElement>('previous-page').disabled = page === 0
  element<HTMLButtonElement>('next-page').disabled = page >= pages - 1
}

async function loadCards(): Promise<void> {
  cards = await cardStore.getCards()
  renderCards()
}

function openOptions(query = ''): void {
  void chrome.tabs.create({ url: chrome.runtime.getURL(`options/options.html${query}`) })
}

function renderStyle(): void {
  for (const key of ['fontSize', 'verticalPosition', 'backgroundOpacity'] as const) {
    element<HTMLInputElement>(key).value = String(style[key])
    element(`${key}Value`).textContent =
      key === 'backgroundOpacity' ? `${style[key]}%` : `${style[key]}px`
  }
  element<HTMLInputElement>('timeOffset').value = String(style.timeOffset)
  element<HTMLInputElement>('timeOffsetNumber').value = style.timeOffset.toFixed(1)
}

/** Shows a style change on the page right away; it is saved once the control is released. */
function previewStyle(): void {
  renderStyle()
  if (activeTab?.id !== undefined) {
    const message: ContentMessage = { type: 'previewSubtitleStyle', style }
    chrome.tabs.sendMessage(activeTab.id, message).catch(() => {
      // The extension is not running on this page.
    })
  }
}

function showSubtitleMessage(message: string, action?: { label: string; run: () => void }): void {
  const box = element('subtitle-message')
  box.classList.remove('hidden')
  box.textContent = message
  if (action) {
    const button = document.createElement('button')
    button.className = 'btn btn-outline mt-2 w-full'
    button.textContent = action.label
    button.addEventListener('click', action.run)
    box.appendChild(button)
  }
}

async function loadSubtitles(): Promise<void> {
  const tabId = activeTab?.id
  if (tabId === undefined || !(await callBackground('activateTab', { tabId }))) {
    showSubtitleMessage(t('popupPageNotSupported'))
    return
  }
  const message: ContentMessage = { type: 'openSubtitlePicker' }
  const opened = await chrome.tabs.sendMessage(tabId, message).then(
    response => response?.opened === true,
    () => false
  )
  if (opened) {
    window.close()
    return
  }
  // Players embedded from another site can only be reached with access to all sites.
  if (await chrome.permissions.contains(ALL_SITES)) {
    showSubtitleMessage(t('popupNoVideo'))
  } else {
    showSubtitleMessage(t('popupNoVideoNeedsAccess'), {
      label: t('popupAllowAllSites'),
      run: async () => {
        if (await chrome.permissions.request(ALL_SITES)) void loadSubtitles()
      },
    })
  }
}

async function showStatus(): Promise<void> {
  const status = element('status')
  const tabId = activeTab?.id
  // Opening the popup grants access to the current tab, so start the extension there.
  const active =
    tabId !== undefined && (await callBackground('activateTab', { tabId }).catch(() => false))
  status.textContent = active ? t('popupStatusActive') : t('popupStatusUnavailable')
}

function bindEvents(): void {
  element('open-options').addEventListener('click', () => chrome.runtime.openOptionsPage())
  element('tab-cards').addEventListener('click', () => showTab('cards'))
  element('tab-subtitles').addEventListener('click', () => showTab('subtitles'))
  element('open-library').addEventListener('click', () => openOptions('?view=cards'))
  element('previous-page').addEventListener('click', () => {
    page--
    renderCards()
  })
  element('next-page').addEventListener('click', () => {
    page++
    renderCards()
  })

  element('card-list').addEventListener('click', async event => {
    const target = event.target as HTMLElement
    const button = target.closest<HTMLElement>('[data-action="delete"]')
    if (button) {
      if (!confirm(t('confirmDeleteCard'))) return
      await cardStore.deleteCard(Number(button.dataset.cardId))
      showToast(t('cardDeleted'))
      return
    }
    const card = target.closest<HTMLElement>('[data-card-word]')
    if (card) openOptions(`?view=cards&highlight=${encodeURIComponent(card.dataset.cardWord!)}`)
  })

  element('load-subtitles').addEventListener('click', () => void loadSubtitles())

  for (const key of ['fontSize', 'verticalPosition', 'backgroundOpacity', 'timeOffset'] as const) {
    const input = element<HTMLInputElement>(key)
    input.addEventListener('input', () => {
      style = { ...style, [key]: Number(input.value) }
      previewStyle()
    })
    input.addEventListener('change', () => void updateSettings({ subtitleStyle: style }))
  }
  const offset = element<HTMLInputElement>('timeOffsetNumber')
  offset.addEventListener('change', () => {
    const value = Number(offset.value)
    style = { ...style, timeOffset: Number.isFinite(value) ? Math.round(value * 10) / 10 : 0 }
    previewStyle()
    void updateSettings({ subtitleStyle: style })
  })
  element('pin-subtitles').addEventListener('change', event => {
    void updateSettings({ pinSubtitlesToScreen: (event.target as HTMLInputElement).checked })
  })
  element('reset-style').addEventListener('click', () => {
    style = DEFAULT_SUBTITLE_STYLE
    previewStyle()
    void updateSettings({ subtitleStyle: style })
  })
}

async function main(): Promise<void> {
  localizePage(t('extName'))
  render()
  bindEvents()
  showTab('cards')
  ;[activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const settings = await getSettings()
  hotkey = settings.captureHotkey.toUpperCase()
  style = settings.subtitleStyle
  element<HTMLInputElement>('pin-subtitles').checked = settings.pinSubtitlesToScreen
  renderStyle()
  onCardsChanged(() => void loadCards())
  await Promise.all([loadCards(), showStatus()])
}

void main()
