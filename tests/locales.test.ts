/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

type Messages = Record<string, { message: string }>

const load = (locale: string): Messages =>
  JSON.parse(readFileSync(new URL(`../_locales/${locale}/messages.json`, import.meta.url), 'utf8'))

const english = load('en')
const locales = readdirSync(new URL('../_locales', import.meta.url))
const placeholders = (message: string) => (message.match(/\$\d/g) ?? []).sort()

describe('locales', () => {
  it.each(locales)('%s has the same messages and placeholders as English', locale => {
    const messages = load(locale)
    expect(Object.keys(messages).sort()).toEqual(Object.keys(english).sort())
    for (const [key, { message }] of Object.entries(messages)) {
      expect(placeholders(message), `${locale}: ${key}`).toEqual(placeholders(english[key].message))
    }
  })

  it('uses only key characters Chrome accepts', () => {
    for (const key of Object.keys(english)) expect(key).toMatch(/^[A-Za-z0-9_]+$/)
  })

  it.each(locales)('%s keeps the store summary within 132 characters', locale => {
    expect(load(locale).extDescription.message.length).toBeLessThanOrEqual(132)
  })
})
