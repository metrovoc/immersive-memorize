// Writes English definitions from JMdict for the words in dict/jlpt.json to dict/jmdict-en.json,
// keyed by headword and then by the word list's furigana.
//
// Usage: node scripts/add-english-definitions.mjs <path-to-jmdict-eng.json>
//
// Input: jmdict-eng-<version>.json (the full file, not the "common" subset) from
// https://github.com/scriptin/jmdict-simplified/releases
// JMdict is by the Electronic Dictionary Research and Development Group (EDRDG) and is
// licensed under CC BY-SA 4.0 (https://www.edrdg.org/edrdg/licence.html). The output stays in its
// own file under that license, apart from the word list, which has a different license.

import { readFileSync, writeFileSync } from 'node:fs'

const JLPT_PATH = new URL('../dict/jlpt.json', import.meta.url)
const OUTPUT_PATH = new URL('../dict/jmdict-en.json', import.meta.url)
const MAX_SENSES = 3
const MAX_GLOSSES = 3
const MAX_LENGTH = 120

const KANA = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u
const toHiragana = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
const toKatakana = s => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60))
// Removes the dakuten from the first kana
const unvoice = s =>
  s
    .normalize('NFD')
    .replace(/^(.)\u3099/u, '$1')
    .normalize('NFC')
const hanChars = s => s.match(/\p{Script=Han}/gu) ?? []
// "〜 人[にん]" -> "人", "ああ(嘆)" -> "ああ"
const normalizeKey = kanji =>
  kanji.replace(/\[[^\]]*\]|\([^)]*\)|\s/g, '').replace(/^[〜～]|[〜～]$/g, '')

const NOUN = t => t === 'n' || t.startsWith('n-')
const SUFFIX = t => t === 'suf' || t === 'n-suf' || t === 'ctr'
const PREFIX = t => t === 'pref' || t === 'n-pref'
const EXPRESSION = t => t === 'exp'
const AUXILIARY = t => t.startsWith('aux')
const PARTICLE = t => t === 'prt'
const POS = {
  名: NOUN,
  代: t => t === 'pn',
  数: t => t === 'num',
  副: t => t.startsWith('adv'),
  イ形: t => t.startsWith('adj-i'),
  ナ形: t => t === 'adj-na' || t === 'adj-pn',
  接尾: SUFFIX,
  接頭: PREFIX,
  感: t => t === 'int',
  接: t => t === 'conj',
  連体: t => t === 'adj-pn' || t === 'adj-f',
  連語: EXPRESSION,
  成句: EXPRESSION,
  補動: AUXILIARY,
  補形: AUXILIARY,
  格助: PARTICLE,
  副助: PARTICLE,
  接助: PARTICLE,
  終助: PARTICLE,
  動1: t => t.startsWith('v5'),
  動2: t => t.startsWith('v1'),
  動3: t => t.startsWith('vs') || t === 'vk' || t === 'vz',
}

const parsePos = label =>
  label
    .split('・')
    .map(atom => POS[atom.replace(/[①-⑳⓪]/g, '').replace(/^[自他]+(?=動)/, '')])
    .filter(Boolean)

const appliesTo = (list, text) => list.includes('*') || list.includes(text)
const hasPos = (sense, test) => sense.partOfSpeech.some(test)
// Keeps the items that pass the test, or all of them when none does
const prefer = (items, test) => (items.some(test) ? items.filter(test) : items)

const etymologyTerms = furigana =>
  furigana
    .replace(/&nbsp;/g, ' ')
    .split(/[；;・]/)
    .map(term => term.replace(/\([^)]*\)/g, '').trim())
    .filter(Boolean)

const matchesEtymology = (sense, terms) =>
  sense.gloss.some(g => terms.includes(g.text.replace(/\s*\([^)]*\)/g, '').trim())) ||
  sense.languageSource.some(source => terms.includes(source.text))

const formatSenses = senses => {
  const seen = new Set()
  const parts = []
  for (const sense of senses) {
    const glosses = sense.gloss
      .filter(g => g.lang === 'eng' && !seen.has(g.text))
      .slice(0, MAX_GLOSSES)
      .map(g => g.text)
    glosses.forEach(text => seen.add(text))
    if (glosses.length) parts.push(glosses.join(', '))
    if (parts.length === MAX_SENSES) break
  }
  let text = parts[0] ?? ''
  for (const part of parts.slice(1)) {
    if (text.length + part.length + 2 > MAX_LENGTH) break
    text += `; ${part}`
  }
  return text
}

const jmdictPath = process.argv[2]
if (!jmdictPath) {
  console.error('Usage: node scripts/add-english-definitions.mjs <path-to-jmdict-eng.json>')
  process.exit(1)
}

const jmdict = JSON.parse(readFileSync(jmdictPath, 'utf8'))
const byKanji = new Map()
const byKana = new Map()
const addTo = (map, text, word) => (map.get(text) ?? map.set(text, []).get(text)).push(word)
for (const word of jmdict.words) {
  word.kanji.forEach(k => addTo(byKanji, k.text, word))
  word.kana.forEach(k => addTo(byKana, k.text, word))
}

// JMdict entries spelled `text` (read as `reading` if it has kanji) with their applicable senses
const findCandidates = (text, reading, kanaOnly) => {
  const candidates = []
  for (const word of (kanaOnly ? byKana : byKanji).get(text) ?? []) {
    const form = (kanaOnly ? word.kana : word.kanji).find(f => f.text === text)
    const kana = kanaOnly
      ? form
      : word.kana.find(k => appliesTo(k.appliesToKanji, text) && toHiragana(k.text) === reading)
    if (!kana) continue
    const senses = word.sense.filter(s =>
      kanaOnly
        ? appliesTo(s.appliesToKana, text)
        : appliesTo(s.appliesToKanji, text) && appliesTo(s.appliesToKana, kana.text)
    )
    if (senses.length) candidates.push({ word, form, kana, senses })
  }
  return candidates
}

const defineEntry = entry => {
  const key = normalizeKey(entry.VocabKanji)
  const furigana = entry.VocabFurigana.replace(/[〜～\s]/g, '')
  // Loanwords store their etymology here instead, e.g. "(英) gram；(法) gramme"
  const reading = KANA.test(furigana) ? toHiragana(furigana) : null
  const kanaOnly = KANA.test(key)
  const affix = /^[〜～]/.test(entry.VocabKanji)
    ? SUFFIX
    : /[〜～]$/.test(entry.VocabKanji)
      ? PREFIX
      : null
  const categories = parsePos(entry.VocabPoS)

  // Fall back to the other kana script and, for suffixes, to the form without rendaku
  // (〜づかい is listed as つかい)
  const attempts = [[key, reading]]
  if (kanaOnly) attempts.push([toKatakana(key), reading], [toHiragana(key), reading])
  if (affix === SUFFIX) attempts.push([unvoice(key), reading && unvoice(reading)])
  let candidates = []
  for (const [text, textReading] of attempts) {
    candidates = findCandidates(text, textReading, kanaOnly)
    if (candidates.length) break
  }
  if (!candidates.length) return ''

  const terms = reading === null ? etymologyTerms(entry.VocabFurigana) : []
  candidates = prefer(candidates, c => c.senses.some(s => matchesEtymology(s, terms)))
  if (affix) candidates = prefer(candidates, c => c.senses.some(s => hasPos(s, affix)))

  const chineseChars = new Set(hanChars(entry.VocabDefCN))
  const score = ({ word, form, kana, senses }) => {
    const posMatches = categories.filter(test => senses.some(s => hasPos(s, test))).length
    // Ateji are chosen for their sound, so they say nothing about the meaning
    const sharesHan = word.kanji.some(
      k => !k.tags.includes('ateji') && hanChars(k.text).some(c => chineseChars.has(c))
    )
    const usuallyKana = !word.kanji.length || senses.some(s => s.misc.includes('uk'))
    return (
      (4 * posMatches) / (categories.length || 1) +
      (sharesHan ? 3 : 0) +
      (kanaOnly && usuallyKana ? 2 : 0) +
      (form.common ? 2 : 0) +
      (kana.common ? 1 : 0) +
      (!kanaOnly && word.kanji[0] === form ? 1 : 0)
    )
  }
  const best = candidates.reduce((a, b) => (score(b) > score(a) ? b : a))

  let senses = best.senses
  if (affix) senses = prefer(senses, s => hasPos(s, affix))
  // Noun labels also cover what JMdict tags as numerals, auxiliaries, etc., so they are too
  // broad to filter senses by
  if (categories.length && !categories.includes(NOUN)) {
    senses = prefer(senses, s => categories.some(test => hasPos(s, test)))
  }
  return formatSenses(senses)
}

// Homophones the matching rules pick wrongly, checked by hand against the Chinese definitions.
const OVERRIDES = {
  しまい: 'end, close, finish, termination',
  もうける: 'to make money, to make a profit; to get a bargain',
  ごくごく: 'gulping (down), drinking in big gulps',
  '〜味': 'counter for kinds of food, drink or medicine',
  '〜み': '-ness (as in "sweetness"), -th (as in "warmth"), a touch of',
  'ぼろ〜': 'worn-out, shabby, tattered',
  おろか: 'not to mention, let alone, much less',
  あげる: 'to give; to do for someone (as 〜てあげる); to raise, to elevate',
}

const entries = JSON.parse(readFileSync(JLPT_PATH, 'utf8')).map(entry => ({
  ...entry,
  VocabDefEN: OVERRIDES[entry.VocabKanji] ?? defineEntry(entry),
}))
const glosses = {}
for (const { VocabKanji, VocabFurigana, VocabDefEN } of entries) {
  if (VocabDefEN) (glosses[VocabKanji] ??= {})[VocabFurigana] = VocabDefEN
}
writeFileSync(OUTPUT_PATH, JSON.stringify(glosses, null, 2) + '\n')

const percent = (matched, total) => `${matched}/${total} (${((100 * matched) / total).toFixed(2)}%)`
const levels = {}
for (const { Level, VocabDefEN } of entries) {
  levels[Level] ??= [0, 0]
  levels[Level][0] += VocabDefEN ? 1 : 0
  levels[Level][1]++
}
const unmatched = entries.filter(entry => !entry.VocabDefEN)
console.log(`English definitions from JMdict ${jmdict.dictDate}`)
console.log(`Matched: ${percent(entries.length - unmatched.length, entries.length)}`)
for (const level of Object.keys(levels).sort().reverse()) {
  console.log(`  ${level}: ${percent(...levels[level])}`)
}
console.log(`Unmatched (${unmatched.length}): ${unmatched.map(e => e.VocabKanji).join(', ')}`)
