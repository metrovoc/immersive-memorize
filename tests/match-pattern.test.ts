import { describe, expect, it } from 'vitest'
import { isValidMatchPattern, matchesPattern, originPattern } from '@/lib/match-pattern'

describe('matchesPattern', () => {
  it('matches subdomains and the bare domain for *. hosts', () => {
    expect(matchesPattern('https://www.netflix.com/watch/1', '*://*.netflix.com/*')).toBe(true)
    expect(matchesPattern('https://netflix.com/', '*://*.netflix.com/*')).toBe(true)
    expect(matchesPattern('https://notnetflix.com/', '*://*.netflix.com/*')).toBe(false)
  })

  it('checks the scheme and the path', () => {
    expect(matchesPattern('http://example.com/a', 'https://example.com/*')).toBe(false)
    expect(matchesPattern('https://example.com/videos/1', 'https://example.com/videos/*')).toBe(
      true
    )
    expect(matchesPattern('https://example.com/other', 'https://example.com/videos/*')).toBe(false)
    expect(matchesPattern('https://example.com.evil.test/', '*://example.com/*')).toBe(false)
  })
})

describe('isValidMatchPattern', () => {
  it('accepts Chrome match patterns only', () => {
    expect(isValidMatchPattern('*://*.example.com/*')).toBe(true)
    expect(isValidMatchPattern('<all_urls>')).toBe(true)
    expect(isValidMatchPattern('*://video.*.com/*')).toBe(false)
    expect(isValidMatchPattern('example.com')).toBe(false)
  })
})

describe('originPattern', () => {
  it('covers the whole origin', () => {
    expect(originPattern('https://www.youtube.com/watch?v=1')).toBe('https://www.youtube.com/*')
    expect(originPattern('chrome://extensions')).toBeNull()
  })
})
