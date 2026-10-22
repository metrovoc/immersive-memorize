// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { exportCardsToCsv } from '@/lib/csv-formatter'
import { sanitizeSentenceHtml } from '@/lib/html'
import type { FlashCard } from '@/types'

describe('sanitizeSentenceHtml', () => {
  it('keeps ruby and the highlight class but drops attributes and other elements', () => {
    const html =
      '<span class="player-x im-highlight" style="color:red" onclick="x()">食べ</span>' +
      '<ruby>漢字<rt>かんじ</rt></ruby><img src=x onerror=alert(1)><script>alert(1)</script><a href="#">リンク</a>'
    expect(sanitizeSentenceHtml(html)).toBe(
      '<span class="im-highlight">食べ</span><ruby>漢字<rt>かんじ</rt></ruby>リンク'
    )
  })
})

describe('exportCardsToCsv', () => {
  const card: FlashCard = {
    id: 1,
    word: '漢字',
    reading: 'かんじ',
    definition: 'kanji; Chinese characters',
    sentence: 'この<ruby>漢字<rt>かんじ</rt></ruby>を<span class="im-highlight">書く</span>',
    timestamp: 75,
    screenshot: '',
    sourceTitle: 'Show "S1"',
    createdAt: '2026-01-01T00:00:00.000Z',
  }

  it('writes Anki headers, Anki furigana and a bold target word', () => {
    const lines = exportCardsToCsv([card], 'anki-html').split('\n')
    expect(lines.slice(0, 3)).toEqual([
      '#separator:Semicolon',
      '#html:true',
      '#columns:Word;Reading;Definition;Sentence;Screenshot;Timestamp;Source',
    ])
    expect(lines[3]).toBe(
      '漢字;かんじ;"kanji; Chinese characters";この 漢字[かんじ]を<b>書く</b>;;1:15;"Show ""S1"""'
    )
  })

  it('writes plain text without furigana or screenshots', () => {
    expect(exportCardsToCsv([card], 'plain-text').split('\n')).toEqual([
      'Word;Reading;Definition;Sentence;Timestamp;Source',
      '漢字;かんじ;"kanji; Chinese characters";この漢字を書く;1:15;"Show ""S1"""',
    ])
  })
})
