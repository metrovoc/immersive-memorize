import type messages from '../../_locales/en/messages.json'

/** Keys of `_locales/en/messages.json`, the default locale every other locale mirrors. */
export type MessageKey = keyof typeof messages

/** Returns the message for the browser's UI language, filling `$1`, `$2`, … in order. */
export function t(key: MessageKey, ...substitutions: (string | number)[]): string {
  return chrome.i18n.getMessage(key, substitutions.map(String)) || key
}

/** Dictionary definitions follow the UI language: Chinese for the zh_CN locale, English otherwise. */
export function definitionLanguage(): 'en' | 'zh' {
  return t('definitionLanguage') === 'zh' ? 'zh' : 'en'
}

/** Applies the UI language and title to an extension page. */
export function localizePage(title: string): void {
  document.documentElement.lang = t('htmlLang')
  document.title = title
}
