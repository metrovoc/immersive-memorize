export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const SENTENCE_TAGS = new Set([
  'RUBY',
  'RB',
  'RT',
  'RP',
  'SPAN',
  'BR',
  'B',
  'I',
  'U',
  'EM',
  'STRONG',
])
const DROPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT'])

/**
 * Reduces subtitle HTML captured from a web page to plain formatting and ruby annotations.
 * Other elements are replaced by their text, and only `im-*` classes survive.
 */
export function sanitizeSentenceHtml(html: string): string {
  const template = document.createElement('template')
  template.innerHTML = html
  sanitizeChildren(template.content)
  return template.innerHTML.replace(/\s+/g, ' ').trim()
}

function sanitizeChildren(parent: ParentNode): void {
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) continue
    const element = node as Element
    if (node.nodeType !== Node.ELEMENT_NODE || DROPPED_TAGS.has(element.tagName)) {
      node.remove()
      continue
    }
    if (!SENTENCE_TAGS.has(element.tagName)) {
      element.replaceWith(document.createTextNode(element.textContent ?? ''))
      continue
    }
    const classes = Array.from(element.classList).filter(name => name.startsWith('im-'))
    for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name)
    if (classes.length > 0) element.className = classes.join(' ')
    sanitizeChildren(element)
  }
}
