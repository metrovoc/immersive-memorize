// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  activeCueText,
  decodeSubtitleBytes,
  parseSubtitleFile,
  parseTimestamp,
  renderCueText,
} from '@/lib/subtitle-file'

describe('parseTimestamp', () => {
  it('reads SRT, VTT and ASS timestamps', () => {
    expect(parseTimestamp('00:01:02,500')).toBe(62.5)
    expect(parseTimestamp('01:02.250')).toBe(62.25)
    expect(parseTimestamp('1:00:00.50')).toBe(3600.5)
  })
})

describe('parseSubtitleFile', () => {
  it('parses SRT with a BOM, CRLF line endings and formatting tags', () => {
    const srt =
      '﻿1\r\n00:00:01,000 --> 00:00:02,500\r\n<i>こんにちは</i>\r\n<font color="red">世界</font>\r\n\r\n' +
      '2\r\n00:00:03,000 --> 00:00:04,000\r\n次の行\r\n'
    expect(parseSubtitleFile('episode.srt', srt)).toEqual([
      { start: 1, end: 2.5, text: '<i>こんにちは</i>\n世界' },
      { start: 3, end: 4, text: '次の行' },
    ])
  })

  it('parses WebVTT with headers, cue ids, settings and voice tags', () => {
    const vtt = [
      'WEBVTT',
      '',
      'NOTE a comment',
      '',
      'intro',
      '00:01.000 --> 00:02.000 align:start position:10%',
      '<v Taro>おはよう</v> <c.yellow>ございます</c>',
      '',
      '00:00:05.000 --> 00:00:06.000',
      '<ruby>漢字<rt>かんじ</rt></ruby>',
    ].join('\n')
    expect(parseSubtitleFile('episode.vtt', vtt)).toEqual([
      { start: 1, end: 2, text: 'おはよう ございます' },
      { start: 5, end: 6, text: '<ruby>漢字<rt>かんじ</rt></ruby>' },
    ])
  })

  it('parses ASS dialogue, keeping commas in the text and dropping override tags and drawings', () => {
    const ass = [
      '[Script Info]',
      'Title: Test',
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,{\\an8}そうだね、\\Nいいよ',
      'Comment: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,ignored',
      'Dialogue: 0,0:00:02.00,0:00:03.00,Sign,,0,0,0,,{\\p1}m 0 0 l 100 0{\\p0}',
    ].join('\n')
    expect(parseSubtitleFile('episode.ass', ass)).toEqual([
      { start: 1, end: 3.5, text: 'そうだね、\nいいよ' },
    ])
  })

  it('treats markup-like text in ASS as text', () => {
    const ass =
      '[Events]\nFormat: Start, End, Text\nDialogue: 0:00:01.00,0:00:02.00,<img src=x onerror=alert(1)>'
    expect(parseSubtitleFile('a.ass', ass)[0].text).toBe('<img src=x onerror=alert(1)>')
  })
})

describe('decodeSubtitleBytes', () => {
  it('detects UTF-8, UTF-16 and Shift_JIS', () => {
    expect(decodeSubtitleBytes(new TextEncoder().encode('日本語'))).toBe('日本語')
    expect(decodeSubtitleBytes(new Uint8Array([0xff, 0xfe, 0xe5, 0x65, 0x2c, 0x67]))).toBe('日本')
    // "日本" in Shift_JIS.
    expect(decodeSubtitleBytes(new Uint8Array([0x93, 0xfa, 0x96, 0x7b]))).toBe('日本')
  })
})

describe('activeCueText', () => {
  it('joins overlapping cues', () => {
    const cues = [
      { start: 0, end: 5, text: 'a' },
      { start: 2, end: 3, text: 'b' },
    ]
    expect(activeCueText(cues, 2.5)).toBe('a\nb')
    expect(activeCueText(cues, 5)).toBe('')
  })
})

describe('renderCueText', () => {
  it('creates only allowed elements and never parses markup from the file', () => {
    const container = document.createElement('div')
    renderCueText(container, '<b>強調</b>\n<img src=x onerror=alert(1)>')
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')?.textContent).toBe('強調')
    expect(container.querySelector('br')).not.toBeNull()
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
  })
})
