import '../globals.css'
import { downloadFile, exportCardsToCsv } from '@/lib/csv-formatter'
import { escapeHtml } from '@/lib/html'
import { definitionLanguage, localizePage, t, type MessageKey } from '@/lib/i18n'
import { icons } from '@/lib/icons'
import { isValidMatchPattern } from '@/lib/match-pattern'
import { cardHtml, showToast } from '@/lib/page-ui'
import { getSettings, onSettingsChanged, updateSettings, type Settings } from '@/lib/settings'
import { cardStore, onCardsChanged } from '@/lib/storage'
import { entryDefinition, entryReading, vocabKey, Vocabulary } from '@/lib/vocab'
import { JLPT_LEVELS, type CsvExportFormat, type FlashCard, type JlptLevel } from '@/types'

type View = 'cards' | 'vocabulary' | 'settings' | 'about'
type CardSort = 'newest' | 'oldest' | 'word' | 'level'

const VIEWS: { id: View; label: MessageKey }[] = [
  { id: 'cards', label: 'optionsTabCards' },
  { id: 'vocabulary', label: 'optionsTabVocabulary' },
  { id: 'settings', label: 'optionsTabSettings' },
  { id: 'about', label: 'optionsTabAbout' },
]
const SORT_LABELS: Record<CardSort, MessageKey> = {
  newest: 'cardsSortNewest',
  oldest: 'cardsSortOldest',
  word: 'cardsSortWord',
  level: 'cardsSortLevel',
}
const FORMAT_LABELS: Record<CsvExportFormat, [MessageKey, MessageKey]> = {
  'anki-html': ['exportFormatAnkiHtml', 'exportFormatHintAnkiHtml'],
  'plain-text': ['exportFormatPlainText', 'exportFormatHintPlainText'],
  'rich-text': ['exportFormatRichText', 'exportFormatHintRichText'],
}
const ALL_SITES = { origins: ['<all_urls>'] }
const WORDS_PER_BATCH = 200
const BACKUP_FORMAT = 'immersive-memorize-backup'
const REPOSITORY = 'https://github.com/metrovoc/immersive-memorize'
const STORE_PAGE =
  'https://chromewebstore.google.com/detail/immersive-memorize/hckblmpcigelkfeinckgflolbdbmdnai'

const params = new URLSearchParams(location.search)
const state = {
  view: parseView(params.get('view')),
  level: parseLevel(params.get('level')),
  highlight: params.get('highlight'),
  cardQuery: '',
  cardSort: 'newest' as CardSort,
  wordQuery: '',
  visibleWords: WORDS_PER_BATCH,
}
let settings: Settings
let vocabulary: Promise<Vocabulary> | null = null

const app = document.getElementById('app')!
const e = escapeHtml

function parseView(value: string | null): View {
  if (value === 'learned-words') return 'cards' // Links from version 0.10.
  return VIEWS.some(view => view.id === value) ? (value as View) : 'cards'
}

function parseLevel(value: string | null): JlptLevel | null {
  return (JLPT_LEVELS as readonly string[]).includes(value ?? '') ? (value as JlptLevel) : null
}

function loadVocabulary(): Promise<Vocabulary> {
  vocabulary ??= Vocabulary.load()
  return vocabulary
}

function main(): HTMLElement {
  return document.getElementById('view')!
}

function navigate(view: View, level: JlptLevel | null = null): void {
  state.view = view
  state.level = level
  state.highlight = null
  state.wordQuery = ''
  state.visibleWords = WORDS_PER_BATCH
  const query = new URLSearchParams({ view })
  if (level) query.set('level', level)
  history.replaceState(null, '', `?${query}`)
  renderNav()
  void renderView()
}

function renderShell(): void {
  app.innerHTML = `
    <header class="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div class="flex items-center gap-2">
          <img src="../icons/icon48.png" alt="" class="size-7" />
          <span class="text-lg font-semibold">${e(t('extName'))}</span>
        </div>
        <nav id="nav" class="flex gap-1" role="tablist"></nav>
      </div>
    </header>
    <main id="view" class="mx-auto max-w-5xl px-6 py-8"></main>`
  document.getElementById('nav')!.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-view]')
    if (button) navigate(button.dataset.view as View)
  })
}

function renderNav(): void {
  document.getElementById('nav')!.innerHTML = VIEWS.map(
    ({ id, label }) => `
      <button class="btn ${id === state.view ? 'bg-accent text-foreground' : 'btn-ghost text-muted-foreground'}"
        data-view="${id}" role="tab" aria-selected="${id === state.view}">${e(t(label))}</button>`
  ).join('')
}

async function renderView(): Promise<void> {
  const view = state.view
  // A fresh element per render, so listeners bound by earlier renders go away with it.
  main().replaceWith(
    Object.assign(document.createElement('main'), { id: 'view', className: main().className })
  )
  if (view === 'cards') await renderCards()
  else if (view === 'vocabulary') await renderVocabulary()
  else if (view === 'settings') await renderSettings()
  else renderAbout()
}

function heading(title: string, description: string): string {
  return `
    <div class="mb-6">
      <h1 class="text-2xl font-bold">${e(title)}</h1>
      <p class="mt-1 text-muted-foreground">${e(description)}</p>
    </div>`
}

// Flashcards

let cards: FlashCard[] = []

function sortedCards(): FlashCard[] {
  const query = state.cardQuery.trim().toLowerCase()
  const filtered = query
    ? cards.filter(card =>
        [card.word, card.reading, card.definition, card.sentence, card.sourceTitle].some(field =>
          field?.toLowerCase().includes(query)
        )
      )
    : [...cards]
  const levelOrder = (card: FlashCard) => {
    const index = (JLPT_LEVELS as readonly string[]).indexOf(card.level ?? '')
    return index === -1 ? JLPT_LEVELS.length : index
  }
  switch (state.cardSort) {
    case 'oldest':
      return filtered.reverse()
    case 'word':
      return filtered.sort((a, b) => a.word.localeCompare(b.word, 'ja'))
    case 'level':
      return filtered.sort((a, b) => levelOrder(a) - levelOrder(b) || b.id - a.id)
    default:
      return filtered
  }
}

// Each render works on the view element current when it started and stops once a newer render
// has replaced it.
async function renderCards(): Promise<void> {
  const root = main()
  cards = await cardStore.getCards()
  if (!root.isConnected) return

  root.innerHTML = `
    <div id="card-summary"></div>
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <input id="card-search" type="search" class="input min-w-48 flex-1" placeholder="${e(t('cardsSearch'))}" value="${e(state.cardQuery)}" />
      <select id="card-sort" class="input" aria-label="${e(t('cardsSort'))}">
        ${(Object.keys(SORT_LABELS) as CardSort[])
          .map(
            sort =>
              `<option value="${sort}" ${sort === state.cardSort ? 'selected' : ''}>${e(t(SORT_LABELS[sort]))}</option>`
          )
          .join('')}
      </select>
      <button id="export-csv" class="btn btn-primary">${icons.download()}${e(t('cardsExportCsv'))}</button>
      <button id="delete-all" class="btn btn-danger">${icons.trash()}${e(t('cardsDeleteAll'))}</button>
    </div>
    <div id="card-list" class="space-y-3"></div>`

  renderCardData()
  if (state.highlight)
    document.querySelector('#card-list .ring-2')?.scrollIntoView({ block: 'center' })

  const search = document.getElementById('card-search') as HTMLInputElement
  search.addEventListener('input', () => {
    state.cardQuery = search.value
    renderCardList()
  })
  const sort = document.getElementById('card-sort') as HTMLSelectElement
  sort.addEventListener('change', () => {
    state.cardSort = sort.value as CardSort
    renderCardList()
  })
  document.getElementById('export-csv')!.addEventListener('click', () => void exportCsv())
  document.getElementById('delete-all')!.addEventListener('click', async () => {
    if (!confirm(t('confirmDeleteAll', cards.length))) return
    await cardStore.clear()
    showToast(t('cardsDeletedAll'))
  })
  const list = document.getElementById('card-list')!
  list.addEventListener('click', event => void onCardAction(event))
  list.addEventListener('mouseover', event => void showScreenshotPreview(event))
  list.addEventListener('mouseout', event => {
    if ((event.target as HTMLElement).closest('[data-action="screenshot"]')) hidePreview()
  })
}

/** Updates everything in the cards view that depends on the saved cards. */
function renderCardData(): void {
  const counts = JLPT_LEVELS.map(level => ({
    level,
    count: cards.filter(card => card.level === level).length,
  }))
  document.getElementById('card-summary')!.innerHTML = `
    ${heading(t('cardsTitle'), t('cardsDescription', cards.length))}
    <div class="mb-6 grid grid-cols-5 gap-3">
      ${counts
        .map(
          ({ level, count }) => `
        <div class="card p-3 text-center">
          <div class="text-xl font-bold text-primary">${count}</div>
          <div class="text-xs text-muted-foreground">${level}</div>
        </div>`
        )
        .join('')}
    </div>`
  for (const id of ['export-csv', 'delete-all']) {
    ;(document.getElementById(id) as HTMLButtonElement).disabled = cards.length === 0
  }
  renderCardList()
}

function renderCardList(): void {
  const list = document.getElementById('card-list')
  if (!list) return
  const visible = sortedCards()
  if (cards.length === 0) {
    list.innerHTML = emptyState(
      t('cardsEmptyTitle'),
      t('cardsEmptyHint', settings.captureHotkey.toUpperCase())
    )
    return
  }
  if (visible.length === 0) {
    list.innerHTML = emptyState(t('cardsNoMatches'), '')
    return
  }
  list.innerHTML = visible
    .map(card => cardHtml(card, { highlighted: card.word === state.highlight }))
    .join('')
}

function emptyState(title: string, hint: string): string {
  return `
    <div class="card px-6 py-16 text-center text-muted-foreground">
      <p class="mb-1 text-lg font-medium text-foreground">${e(title)}</p>
      <p class="text-sm">${e(hint)}</p>
    </div>`
}

async function onCardAction(event: MouseEvent): Promise<void> {
  const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')
  if (!button) return
  const cardId = Number(button.dataset.cardId)
  if (button.dataset.action === 'delete') {
    if (!confirm(t('confirmDeleteCard'))) return
    await cardStore.deleteCard(cardId)
    showToast(t('cardDeleted'))
  } else if (button.dataset.action === 'screenshot') {
    hidePreview()
    showScreenshotModal(await cardStore.getScreenshot(cardId))
  }
}

async function exportCsv(): Promise<void> {
  const format = settings.csvExportFormat
  try {
    const all = await cardStore.getCards({ withScreenshots: format !== 'plain-text' })
    const date = new Date().toISOString().slice(0, 10)
    downloadFile(
      exportCardsToCsv(all, format),
      `immersive-memorize-${format}-${date}.csv`,
      'text/csv;charset=utf-8'
    )
    showToast(t('cardsExported', all.length))
  } catch (error) {
    showToast(t('cardsExportFailed', (error as Error).message), 'error')
  }
}

const screenshotCache = new Map<number, Promise<string>>()

async function showScreenshotPreview(event: MouseEvent): Promise<void> {
  const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action="screenshot"]')
  if (!button || document.getElementById('screenshot-preview')) return
  const cardId = Number(button.dataset.cardId)
  if (!screenshotCache.has(cardId)) screenshotCache.set(cardId, cardStore.getScreenshot(cardId))
  const preview = document.createElement('div')
  preview.id = 'screenshot-preview'
  preview.className = 'pointer-events-none fixed z-50 w-64 rounded-lg border bg-card p-1 shadow-lg'
  const rect = button.getBoundingClientRect()
  preview.style.top = `${Math.min(rect.top, window.innerHeight - 180)}px`
  preview.style.left = `${Math.max(8, rect.left - 272)}px`
  document.body.appendChild(preview)
  const src = await screenshotCache.get(cardId)!
  if (preview.isConnected && src) {
    const image = document.createElement('img')
    image.src = src
    image.alt = t('cardScreenshotAlt')
    image.className = 'w-full rounded'
    preview.appendChild(image)
  }
}

function hidePreview(): void {
  document.getElementById('screenshot-preview')?.remove()
}

function showScreenshotModal(src: string): void {
  if (!src) {
    showToast(t('cardScreenshotMissing'), 'warning')
    return
  }
  const modal = document.createElement('div')
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6'
  modal.setAttribute('role', 'dialog')
  const image = document.createElement('img')
  image.src = src
  image.alt = t('cardScreenshotAlt')
  image.className = 'max-h-full max-w-full rounded-lg shadow-2xl'
  modal.appendChild(image)
  const close = () => {
    modal.remove()
    document.removeEventListener('keydown', onKey)
  }
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close()
  }
  modal.addEventListener('click', close)
  document.addEventListener('keydown', onKey)
  document.body.appendChild(modal)
}

// Vocabulary

const POS_LABELS: [RegExp, MessageKey][] = [
  [/^自他動/, 'posVerb'],
  [/^他動/, 'posTransitiveVerb'],
  [/^自動/, 'posIntransitiveVerb'],
  [/^補動/, 'posAuxiliaryVerb'],
  [/^動/, 'posVerb'],
  [/^補形/, 'posAuxiliaryAdjective'],
  [/^イ形/, 'posIAdjective'],
  [/^ナ形/, 'posNaAdjective'],
  [/^連体/, 'posAdnominal'],
  [/^連語/, 'posExpression'],
  [/^成句/, 'posIdiom'],
  [/^接尾/, 'posSuffix'],
  [/^接頭/, 'posPrefix'],
  [/^.助$/, 'posParticle'],
  [/^接$/, 'posConjunction'],
  [/^名/, 'posNoun'],
  [/^副/, 'posAdverb'],
  [/^代/, 'posPronoun'],
  [/^感/, 'posInterjection'],
]
const VERB_CLASSES: Record<string, MessageKey> = { 1: 'posGodan', 2: 'posIchidan', 3: 'posSuru' }

/** Translates the word list's part-of-speech abbreviations, e.g. 他動1 → "transitive verb (godan)". */
function partOfSpeech(abbreviation: string): string {
  return abbreviation
    .replace(/[①-⑳⓪]/g, '')
    .split('・')
    .filter(Boolean)
    .map(part => {
      const label = POS_LABELS.find(([pattern]) => pattern.test(part))?.[1]
      if (!label) return part
      const verbClass = VERB_CLASSES[part.match(/動(\d)/)?.[1] ?? '']
      return verbClass ? `${t(label)} (${t(verbClass)})` : t(label)
    })
    .join(', ')
}

async function renderVocabulary(): Promise<void> {
  const root = main()
  root.innerHTML = `<p class="text-muted-foreground">${e(t('loading'))}</p>`
  const [words, learned] = await Promise.all([loadVocabulary(), cardStore.getLearnedWords()])
  if (!root.isConnected) return
  const learnedWords = new Set(learned)
  if (state.level) renderLevel(root, words, state.level, learnedWords)
  else renderLevels(root, words, learnedWords)
}

function renderLevels(root: HTMLElement, words: Vocabulary, learned: Set<string>): void {
  root.innerHTML = `
    ${heading(t('vocabularyTitle'), t('vocabularyDescription'))}
    <div class="grid gap-4">
      ${JLPT_LEVELS.map(level => {
        const keys = new Set(words.entriesForLevel(level).map(entry => vocabKey(entry.VocabKanji)))
        const done = [...keys].filter(key => learned.has(key)).length
        const percent = keys.size ? Math.round((done / keys.size) * 100) : 0
        const enabled = settings.enabledLevels.includes(level)
        return `
          <div class="card p-5 ${enabled ? '' : 'opacity-70'}">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div class="flex items-center gap-4">
                <span class="text-2xl font-bold">${level}</span>
                <span class="text-sm text-muted-foreground">${e(t('vocabularyLevelProgress', done, keys.size))}</span>
              </div>
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2 text-sm">
                  <input type="checkbox" class="switch" data-level-toggle="${level}" ${enabled ? 'checked' : ''} />
                  ${e(t('vocabularyLearnLevel'))}
                </label>
                <button class="btn btn-outline" data-level-open="${level}">${e(t('vocabularyBrowse'))}${icons.chevronRight()}</button>
              </div>
            </div>
            <div class="mt-4 h-2 rounded-full bg-muted" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
              <div class="h-2 rounded-full bg-primary" style="width: ${percent}%"></div>
            </div>
          </div>`
      }).join('')}
    </div>`

  root.addEventListener('change', async event => {
    const toggle = event.target as HTMLInputElement
    const level = toggle.dataset.levelToggle as JlptLevel | undefined
    if (!level) return
    const enabledLevels = JLPT_LEVELS.filter(item =>
      item === level ? toggle.checked : settings.enabledLevels.includes(item)
    )
    await updateSettings({ enabledLevels })
  })
  root.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-level-open]')
    if (button) navigate('vocabulary', button.dataset.levelOpen as JlptLevel)
  })
}

function renderLevel(
  root: HTMLElement,
  words: Vocabulary,
  level: JlptLevel,
  learned: Set<string>
): void {
  const entries = words.entriesForLevel(level)
  const keys = new Set(entries.map(entry => vocabKey(entry.VocabKanji)))
  const learnedCount = [...keys].filter(key => learned.has(key)).length
  root.innerHTML = `
    <button id="back" class="btn btn-ghost mb-4 -ml-3">${icons.chevronLeft()}${e(t('vocabularyBack'))}</button>
    ${heading(t('vocabularyLevelTitle', level), t('vocabularyLevelDescription', keys.size, learnedCount))}
    <input id="word-search" type="search" class="input mb-4 w-full" placeholder="${e(t('vocabularySearch'))}" value="${e(state.wordQuery)}" />
    <div id="word-list" class="grid gap-3"></div>`

  const language = definitionLanguage()
  const renderList = () => {
    const query = state.wordQuery.trim().toLowerCase()
    const matches = query
      ? entries.filter(entry =>
          [entry.VocabKanji, entry.VocabFurigana, entryDefinition(entry, language)].some(field =>
            field.toLowerCase().includes(query)
          )
        )
      : entries
    const shown = matches.slice(0, state.visibleWords)
    const list = document.getElementById('word-list')!
    list.innerHTML =
      shown
        .map(entry => {
          const key = vocabKey(entry.VocabKanji)
          const reading = entryReading(entry)
          const details = [
            entry.VocabPoS && partOfSpeech(entry.VocabPoS),
            entry.VocabPitch && t('vocabularyPitch', entry.VocabPitch),
          ].filter(Boolean)
          return `
            <div class="card p-4 ${learned.has(key) ? 'bg-muted/50' : ''}">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-lg font-bold text-primary">${e(entry.VocabKanji.replace(/\[[^\]]*\]|\s/g, ''))}</span>
                ${reading && reading !== key ? `<span class="text-sm text-muted-foreground">${e(reading)}</span>` : ''}
                ${learned.has(key) ? `<span class="badge bg-success/15 text-success">${e(t('vocabularyLearned'))}</span>` : ''}
              </div>
              <div class="mt-1 text-sm">${e(entryDefinition(entry, language) || t('vocabularyNoDefinition'))}</div>
              ${details.length ? `<div class="mt-1 text-xs text-muted-foreground">${e(details.join(' · '))}</div>` : ''}
            </div>`
        })
        .join('') +
      (matches.length > shown.length
        ? `<button id="show-more" class="btn btn-outline">${e(t('vocabularyShowMore', matches.length - shown.length))}</button>`
        : '') +
      (matches.length === 0 ? emptyState(t('vocabularyNoMatches'), '') : '')
    document.getElementById('show-more')?.addEventListener('click', () => {
      state.visibleWords += WORDS_PER_BATCH
      renderList()
    })
  }
  renderList()

  document.getElementById('back')!.addEventListener('click', () => navigate('vocabulary'))
  const search = document.getElementById('word-search') as HTMLInputElement
  let timer = 0
  search.addEventListener('input', () => {
    clearTimeout(timer)
    timer = window.setTimeout(() => {
      state.wordQuery = search.value
      state.visibleWords = WORDS_PER_BATCH
      renderList()
    }, 150)
  })
}

// Settings

function section(title: string, body: string): string {
  return `
    <section class="card p-6">
      <h2 class="mb-4 text-lg font-semibold">${e(title)}</h2>
      <div class="space-y-4">${body}</div>
    </section>`
}

function switchRow(id: string, label: string, hint: string, checked: boolean): string {
  return `
    <label class="flex items-start justify-between gap-6">
      <span>
        <span class="block text-sm font-medium">${e(label)}</span>
        ${hint ? `<span class="mt-0.5 block text-sm text-muted-foreground">${e(hint)}</span>` : ''}
      </span>
      <input id="${id}" type="checkbox" class="switch mt-0.5" ${checked ? 'checked' : ''} />
    </label>`
}

async function renderSettings(): Promise<void> {
  const root = main()
  const formats = Object.keys(FORMAT_LABELS) as CsvExportFormat[]
  const siteAccess = await Promise.all(
    settings.autoEnabledSites.map(async pattern => ({
      pattern,
      valid: isValidMatchPattern(pattern),
      granted:
        isValidMatchPattern(pattern) &&
        (await chrome.permissions.contains({ origins: [pattern] }).catch(() => false)),
    }))
  )
  if (!root.isConnected) return

  root.innerHTML = `
    ${heading(t('settingsTitle'), t('settingsDescription'))}
    <div class="space-y-6">
      ${section(
        t('settingsCapture'),
        `
        <div class="flex items-center justify-between gap-6">
          <span>
            <span class="block text-sm font-medium">${e(t('settingsHotkey'))}</span>
            <span class="mt-0.5 block text-sm text-muted-foreground">${e(t('settingsHotkeyHint'))}</span>
          </span>
          <input id="hotkey" readonly class="input w-16 cursor-pointer text-center font-mono text-base font-bold uppercase" value="${e(settings.captureHotkey)}" aria-label="${e(t('settingsHotkey'))}" />
        </div>
        ${switchRow('screenshots', t('settingsScreenshots'), t('settingsScreenshotsHint'), settings.enableScreenshot)}`
      )}
      ${section(
        t('settingsExport'),
        `
        <label class="block">
          <span class="mb-1 block text-sm font-medium">${e(t('settingsExportFormat'))}</span>
          <select id="csv-format" class="input w-full">
            ${formats
              .map(
                format =>
                  `<option value="${format}" ${format === settings.csvExportFormat ? 'selected' : ''}>${e(t(FORMAT_LABELS[format][0]))}</option>`
              )
              .join('')}
          </select>
          <span id="csv-format-hint" class="mt-1 block text-sm text-muted-foreground">${e(t(FORMAT_LABELS[settings.csvExportFormat][1]))}</span>
        </label>`
      )}
      ${section(
        t('settingsSites'),
        `
        ${switchRow('everywhere', t('settingsEverywhere'), t('settingsEverywhereHint'), settings.autoEnableEverywhere)}
        <div class="border-t pt-4 ${settings.autoEnableEverywhere ? 'opacity-50' : ''}">
          <p class="mb-3 text-sm text-muted-foreground">${e(t('settingsSitesHint'))}</p>
          <ul class="mb-3 space-y-2">
            ${siteAccess
              .map(
                ({ pattern, valid, granted }) => `
              <li class="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                <code class="flex-1 truncate text-sm">${e(pattern)}</code>
                ${
                  !valid
                    ? `<span class="text-xs text-destructive">${e(t('settingsSiteInvalid'))}</span>`
                    : granted
                      ? ''
                      : `<button class="btn btn-outline h-7 px-2 text-xs" data-grant="${e(pattern)}">${e(t('settingsSiteGrant'))}</button>`
                }
                <button class="btn btn-ghost btn-icon text-destructive" data-remove="${e(pattern)}" aria-label="${e(t('settingsSiteRemove'))}" title="${e(t('settingsSiteRemove'))}">${icons.trash()}</button>
              </li>`
              )
              .join('')}
          </ul>
          <form id="add-site" class="flex gap-2">
            <input id="site-pattern" class="input flex-1" placeholder="*://*.example.com/*" aria-label="${e(t('settingsSitePattern'))}" />
            <button class="btn btn-primary">${icons.plus()}${e(t('settingsSiteAdd'))}</button>
          </form>
        </div>`
      )}
      ${section(
        t('settingsBackup'),
        `
        <p class="text-sm text-muted-foreground">${e(t('settingsBackupHint'))}</p>
        <div class="flex flex-wrap gap-2">
          <button id="export-backup" class="btn btn-outline">${icons.download()}${e(t('settingsBackupExport'))}</button>
          <button id="import-backup" class="btn btn-outline">${icons.upload()}${e(t('settingsBackupImport'))}</button>
          <input id="backup-file" type="file" accept=".json,application/json" hidden />
        </div>`
      )}
      ${section(
        t('settingsAdvanced'),
        switchRow('debug', t('settingsDebug'), t('settingsDebugHint'), settings.debugMode)
      )}
    </div>`

  const hotkey = document.getElementById('hotkey') as HTMLInputElement
  hotkey.addEventListener('keydown', async event => {
    if (event.key === 'Tab') return
    event.preventDefault()
    if (event.key === 'Escape') {
      hotkey.blur()
    } else if (/^[a-z]$/i.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      await updateSettings({ captureHotkey: event.key.toLowerCase() })
      hotkey.value = event.key.toLowerCase()
      hotkey.blur()
      showToast(t('settingsHotkeySaved', event.key.toUpperCase()))
    } else {
      showToast(t('settingsHotkeyInvalid'), 'warning')
    }
  })

  bindSwitch('screenshots', async checked => {
    // Chrome only captures tabs with access to all sites, or tabs where the icon was clicked.
    if (checked && !(await chrome.permissions.request(ALL_SITES))) {
      showToast(t('settingsScreenshotsNoAccess'), 'info')
    }
    await updateSettings({ enableScreenshot: checked })
  })
  bindSwitch('debug', checked => updateSettings({ debugMode: checked }))
  bindSwitch('everywhere', async checked => {
    if (checked && !(await chrome.permissions.request(ALL_SITES))) {
      ;(document.getElementById('everywhere') as HTMLInputElement).checked = false
      showToast(t('settingsAccessDenied'), 'warning')
      return
    }
    await updateSettings({ autoEnableEverywhere: checked })
  })

  const format = document.getElementById('csv-format') as HTMLSelectElement
  format.addEventListener('change', async () => {
    const value = format.value as CsvExportFormat
    document.getElementById('csv-format-hint')!.textContent = t(FORMAT_LABELS[value][1])
    await updateSettings({ csvExportFormat: value })
  })

  document.getElementById('add-site')!.addEventListener('submit', async event => {
    event.preventDefault()
    const input = document.getElementById('site-pattern') as HTMLInputElement
    const pattern = input.value.trim()
    if (!isValidMatchPattern(pattern)) {
      showToast(t('settingsSiteInvalidHint'), 'error')
      return
    }
    if (settings.autoEnabledSites.includes(pattern)) return
    if (!(await chrome.permissions.request({ origins: [pattern] }))) {
      showToast(t('settingsAccessDenied'), 'warning')
      return
    }
    await updateSettings({ autoEnabledSites: [...settings.autoEnabledSites, pattern] })
  })

  root.addEventListener('click', async event => {
    const target = event.target as HTMLElement
    const grant = target.closest<HTMLElement>('[data-grant]')?.dataset.grant
    const remove = target.closest<HTMLElement>('[data-remove]')?.dataset.remove
    if (grant && (await chrome.permissions.request({ origins: [grant] }))) void renderView()
    if (remove) {
      await updateSettings({
        autoEnabledSites: settings.autoEnabledSites.filter(pattern => pattern !== remove),
      })
    }
  })

  document.getElementById('export-backup')!.addEventListener('click', () => void exportBackup())
  const file = document.getElementById('backup-file') as HTMLInputElement
  document.getElementById('import-backup')!.addEventListener('click', () => file.click())
  file.addEventListener('change', () => {
    if (file.files?.[0]) void importBackup(file.files[0])
    file.value = ''
  })
}

function bindSwitch(id: string, onChange: (checked: boolean) => Promise<void>): void {
  const input = document.getElementById(id) as HTMLInputElement
  input.addEventListener('change', () => void onChange(input.checked))
}

async function exportBackup(): Promise<void> {
  const all = await cardStore.getCards({ withScreenshots: true })
  const backup = {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    cards: all,
  }
  const date = new Date().toISOString().slice(0, 10)
  downloadFile(JSON.stringify(backup), `immersive-memorize-backup-${date}.json`, 'application/json')
  showToast(t('settingsBackupExported', all.length))
}

function isCard(value: unknown): value is FlashCard {
  const card = value as FlashCard
  return (
    typeof card?.id === 'number' &&
    typeof card.word === 'string' &&
    typeof card.sentence === 'string' &&
    typeof card.createdAt === 'string'
  )
}

async function importBackup(file: File): Promise<void> {
  try {
    const backup = JSON.parse(await file.text())
    if (backup?.format !== BACKUP_FORMAT || !Array.isArray(backup.cards)) {
      throw new Error(t('settingsBackupInvalid'))
    }
    const existing = new Set((await cardStore.getCards()).map(card => card.id))
    const incoming = (backup.cards as unknown[]).filter(isCard)
    const added = incoming
      .filter(card => !existing.has(card.id))
      .map(card => ({
        ...card,
        screenshot: typeof card.screenshot === 'string' ? card.screenshot : '',
        timestamp: Number(card.timestamp) || 0,
        sourceTitle: String(card.sourceTitle ?? ''),
      }))
    await cardStore.putCards(added)
    showToast(t('settingsBackupImported', added.length, incoming.length - added.length))
  } catch (error) {
    showToast(t('settingsBackupImportFailed', (error as Error).message), 'error')
  }
}

// About

function renderAbout(): void {
  const link = (href: string, label: string) =>
    `<a class="text-primary underline-offset-4 hover:underline" href="${href}" target="_blank" rel="noreferrer">${e(label)}</a>`
  main().innerHTML = `
    ${heading(t('extName'), t('aboutVersion', chrome.runtime.getManifest().version))}
    <div class="space-y-6">
      ${section(
        t('aboutWhatTitle'),
        `
        <p class="text-sm leading-relaxed">${e(t('extDescription'))}</p>
        <p class="text-sm leading-relaxed text-muted-foreground">${e(t('aboutPrivacy'))}</p>
        <div class="flex flex-wrap gap-4 text-sm">
          ${link(REPOSITORY, t('aboutSource'))}
          ${link(`${REPOSITORY}/issues`, t('aboutIssues'))}
          ${link(STORE_PAGE, t('aboutStore'))}
        </div>`
      )}
      ${section(
        t('aboutCredits'),
        `
        <ul class="list-disc space-y-1 pl-5 text-sm">
          <li>${link('https://github.com/patdx/kuromoji.js', 'kuromoji.js')} — ${e(t('aboutCreditKuromoji'))}</li>
          <li>${link('https://github.com/5mdld/anki-jlpt-decks', 'anki-jlpt-decks')} — ${e(t('aboutCreditJlpt'))}</li>
          <li>${link('https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project', 'JMdict')} — ${e(t('aboutCreditJmdict'))}</li>
        </ul>`
      )}
    </div>`
}

async function start(): Promise<void> {
  localizePage(`${t('extName')} · ${t('optionsTitle')}`)
  settings = await getSettings()
  renderShell()
  renderNav()
  await renderView()

  onSettingsChanged(patch => {
    settings = { ...settings, ...patch }
    // Re-render views whose content depends on settings; other views keep their state.
    if (state.view === 'settings' || (state.view === 'vocabulary' && !state.level)) {
      void renderView()
    }
  })
  onCardsChanged(async () => {
    if (state.view === 'cards') {
      cards = await cardStore.getCards()
      if (document.getElementById('card-summary')) renderCardData()
    } else if (state.view === 'vocabulary') {
      void renderView()
    }
  })
}

void start()
