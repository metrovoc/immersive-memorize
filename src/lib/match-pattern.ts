/**
 * Chrome match patterns such as `*://*.example.com/*`. A `*.` host prefix also matches the bare
 * domain, as in Chrome.
 */
const MATCH_PATTERN = /^(\*|https?|file|ftp):\/\/(\*|(?:\*\.)?[^/*]+)?(\/.*)$/

export function isValidMatchPattern(pattern: string): boolean {
  return pattern === '<all_urls>' || MATCH_PATTERN.test(pattern)
}

export function matchesPattern(url: string, pattern: string): boolean {
  if (pattern === '<all_urls>') return /^(https?|file|ftp):/.test(url)
  const match = pattern.match(MATCH_PATTERN)
  if (!match) return false
  const [, scheme, host = '', path] = match

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  const protocol = parsed.protocol.slice(0, -1)
  if (scheme === '*' ? protocol !== 'http' && protocol !== 'https' : protocol !== scheme) {
    return false
  }
  if (host && host !== '*') {
    const hostname = parsed.hostname
    if (host.startsWith('*.')) {
      const domain = host.slice(2)
      if (hostname !== domain && !hostname.endsWith(`.${domain}`)) return false
    } else if (hostname !== host) {
      return false
    }
  }
  const pathPattern = new RegExp(
    `^${path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`
  )
  return pathPattern.test(parsed.pathname + parsed.search)
}

/** The origin-wide pattern Chrome uses for host permissions, e.g. `https://www.example.com/*`. */
export function originPattern(url: string): string | null {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'http:' || protocol === 'https:' ? `${protocol}//${hostname}/*` : null
  } catch {
    return null
  }
}
