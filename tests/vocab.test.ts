import { describe, expect, it } from 'vitest'
import { entryReading, readingsMatch, vocabKey, Vocabulary } from '@/lib/vocab'
import type { VocabEntry } from '@/types'

function entry(fields: Partial<VocabEntry>): VocabEntry {
  return {
    VocabKanji: '',
    VocabFurigana: '',
    VocabDefCN: '',
    VocabDefEN: '',
    VocabPitch: '',
    VocabPoS: '',
    Frequency: '',
    Level: 'N5',
    ...fields,
  }
}

describe('vocabKey', () => {
  it('turns headwords into analyzer lemmas', () => {
    expect(vocabKey('〜やすい')).toBe('やすい')
    expect(vocabKey('石 鹸[けん]')).toBe('石鹸')
    expect(vocabKey('馴[な] 染[じ]む')).toBe('馴染む')
    expect(vocabKey('ああ(嘆)')).toBe('ああ')
  })
})

describe('entryReading', () => {
  it('ignores etymology stored in place of a reading', () => {
    expect(entryReading(entry({ VocabFurigana: 'たべる' }))).toBe('たべる')
    expect(entryReading(entry({ VocabFurigana: '(英) kilogram' }))).toBe('')
  })
})

describe('readingsMatch', () => {
  it('accepts katakana, long vowels and inflected readings', () => {
    expect(readingsMatch('タベル', 'たべる')).toBe(true)
    expect(readingsMatch('たべ', 'たべる')).toBe(true)
    expect(readingsMatch('いく', 'たべる')).toBe(false)
  })
})

describe('Vocabulary', () => {
  const words = new Vocabulary([
    entry({
      VocabKanji: '食べる',
      VocabFurigana: 'たべる',
      VocabDefEN: 'to eat',
      VocabDefCN: '吃',
    }),
    entry({ VocabKanji: '〜やすい', VocabFurigana: '〜やすい', Level: 'N4' }),
  ])

  it('lists readings for the enabled levels only', () => {
    expect(words.activeWords(['N5'])).toEqual([['食べる', ['たべる']]])
    expect(words.activeWords(['N4'])).toEqual([['やすい', ['やすい']]])
  })

  it('looks words up with definitions in the requested language', () => {
    expect(words.lookup('食べる', 'en')).toEqual({
      level: 'N5',
      reading: 'たべる',
      definition: 'to eat',
    })
    expect(words.lookup('食べる', 'zh')?.definition).toBe('吃')
    expect(words.lookup('飲む', 'en')).toBeNull()
  })
})
