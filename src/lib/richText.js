/**
 * Rich text for the guidelines editor.
 *
 * A guidelines value is a small, fixed subset of HTML — only the tags,
 * attributes and CSS properties the toolbar can produce. It is sanitised on
 * the way out of the editor AND again on the way into a page, so a value
 * edited by hand, pasted from Word, or written by an older client can never
 * carry a script, an event handler, or a style that escapes its box.
 *
 * Hackathons saved before the editor existed hold plain text / Markdown.
 * `isRichTextHtml` tells the two apart so those keep rendering through
 * ReactMarkdown exactly as they always have, and `plainTextToRichTextHtml`
 * lifts them into the editor the first time someone opens one.
 */

/* Tags the toolbar produces, plus the ones a realistic paste brings along. */
const ALLOWED_TAGS = new Set([
  'P', 'BR', 'DIV', 'SPAN',
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'MARK', 'SUB', 'SUP',
  'UL', 'OL', 'LI',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'BLOCKQUOTE', 'CODE', 'PRE', 'HR', 'A',
])

/* Removed with their contents. Everything else unknown is merely unwrapped,
   which keeps the words and throws away the wrapper. */
const DROPPED_TAGS = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'FRAME', 'FRAMESET', 'OBJECT', 'EMBED', 'APPLET',
  'LINK', 'META', 'BASE', 'TITLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'MATH',
  'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'OPTION', 'LABEL',
  'AUDIO', 'VIDEO', 'CANVAS', 'IMG', 'PICTURE', 'SOURCE',
])

const ATTRS_BY_TAG = {
  A: ['href', 'title', 'target', 'rel'],
  OL: ['type', 'start'],
}

/* CSS the toolbar can set. Anything else — positioning, sizing, backgrounds
   with images — is dropped so a pasted style cannot break the page around it. */
const ALLOWED_STYLE_PROPS = new Set([
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-decoration-line',
  'text-align',
  'list-style-type',
])

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'

const UNSAFE_STYLE_VALUE = /url\s*\(|expression|javascript:|@import|[<>\\{}]/i
const SAFE_STYLE_VALUE = /^[\w\s#.,%()/-]+$/
const FONT_SIZE_KEYWORDS = new Set([
  'small', 'medium', 'large', 'x-large', 'xx-large', 'xxx-large', 'smaller', 'larger',
])
const OL_TYPES = new Set(['1', 'a', 'A', 'i', 'I'])
const SAFE_HREF = /^(https?:|mailto:|tel:|#|\/)/i

/** `<font size="1..7">` — what execCommand('fontSize') emits — in pixels. */
const FONT_SIZE_ATTR_PX = { 1: 10, 2: 13, 3: 15, 4: 18, 5: 24, 6: 32, 7: 48 }

/** Sizes the editor offers. Kept in px so nesting two spans cannot compound. */
export const RICH_TEXT_FONT_SIZES = [
  { label: 'Small', value: '13px' },
  { label: 'Normal', value: '15px' },
  { label: 'Large', value: '18px' },
  { label: 'X-Large', value: '22px' },
  { label: 'Heading', value: '28px' },
]

/* Mid-tone hues only: guidelines are read on the light admin page and on the
   dark student page, so a near-black or near-white pick would vanish on one of
   them. "Default" removes the colour and lets the page's own ink through. */
export const RICH_TEXT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Indigo', value: '#4f46e5' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Teal', value: '#0d9488' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Lime', value: '#84a900' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Pink', value: '#db2777' },
  { label: 'Purple', value: '#9333ea' },
  { label: 'Grey', value: '#6b7280' },
]

/** List numbering / bullet styles, in the order the toolbar lists them. */
export const RICH_TEXT_LIST_STYLES = [
  { key: 'decimal', group: 'ordered', label: '1. 2. 3.', olType: '1' },
  { key: 'lower-alpha', group: 'ordered', label: 'a. b. c.', olType: 'a' },
  { key: 'upper-alpha', group: 'ordered', label: 'A. B. C.', olType: 'A' },
  { key: 'lower-roman', group: 'ordered', label: 'i. ii. iii.', olType: 'i' },
  { key: 'upper-roman', group: 'ordered', label: 'I. II. III.', olType: 'I' },
  { key: 'disc', group: 'unordered', label: '●  Disc' },
  { key: 'circle', group: 'unordered', label: '○  Circle' },
  { key: 'square', group: 'unordered', label: '■  Square' },
]

/** Does this value carry markup, or is it legacy plain text / Markdown? */
export function isRichTextHtml(value) {
  return /<(?:p|div|span|br|b|strong|i|em|u|s|ul|ol|li|h[1-6]|blockquote|a|font|pre|code)\b[^>]*>/i.test(
    String(value || ''),
  )
}

function clampFontSize(raw) {
  const value = raw.trim().toLowerCase()
  if (FONT_SIZE_KEYWORDS.has(value)) return value
  const px = /^(\d+(?:\.\d+)?)px$/.exec(value)
  if (px) return `${Math.min(48, Math.max(10, Math.round(Number(px[1]))))}px`
  const relative = /^(\d+(?:\.\d+)?)(em|rem)$/.exec(value)
  if (relative) return `${Math.min(3, Math.max(0.7, Number(relative[1])))}${relative[2]}`
  return ''
}

/** Keep only the declarations the toolbar could have written. */
function cleanStyle(style) {
  const kept = []
  String(style || '')
    .split(';')
    .forEach((declaration) => {
      const at = declaration.indexOf(':')
      if (at === -1) return
      const prop = declaration.slice(0, at).trim().toLowerCase()
      let value = declaration.slice(at + 1).trim()
      if (!ALLOWED_STYLE_PROPS.has(prop)) return
      if (!value || UNSAFE_STYLE_VALUE.test(value) || !SAFE_STYLE_VALUE.test(value)) return
      if (prop === 'font-size') {
        value = clampFontSize(value)
        if (!value) return
      }
      kept.push(`${prop}: ${value}`)
    })
  return kept.join('; ')
}

/** `<font color size face>` — what older browsers and execCommand emit. */
function fontToSpan(node, doc) {
  const span = doc.createElement('span')
  const styles = []
  const color = node.getAttribute('color')
  const size = node.getAttribute('size')
  if (color) styles.push(`color: ${color}`)
  if (size && FONT_SIZE_ATTR_PX[size]) styles.push(`font-size: ${FONT_SIZE_ATTR_PX[size]}px`)
  const inherited = node.getAttribute('style')
  if (inherited) styles.push(inherited)
  const style = cleanStyle(styles.join('; '))
  if (style) span.setAttribute('style', style)
  while (node.firstChild) span.appendChild(node.firstChild)
  node.replaceWith(span)
  return span
}

function cleanElement(node, doc) {
  // An earlier unwrap in this pass may already have taken this node out of the
  // tree; there is nothing left to clean, and no parent to unwrap it into.
  if (!node.parentNode) return

  // Anything outside the HTML namespace goes, contents and all. SVG and MathML
  // are the classic sanitiser bypass: inside them the parser keeps tag names
  // lower-case and switches the parsing rules, so an <svg><script> would slip
  // past a name-based drop-list written in upper case.
  if (node.namespaceURI && node.namespaceURI !== HTML_NAMESPACE) {
    node.remove()
    return
  }

  // localName over tagName: only the former is reliably case-normalised.
  const tag = String(node.localName || node.tagName || '').toUpperCase()

  if (DROPPED_TAGS.has(tag)) {
    node.remove()
    return
  }

  if (tag === 'FONT') {
    cleanChildren(fontToSpan(node, doc), doc)
    return
  }

  if (!ALLOWED_TAGS.has(tag)) {
    // Unknown wrapper: keep the words, throw away the box. Clean the children
    // it held rather than re-walking the whole parent — a Word paste nests
    // these several deep, and re-walking would revisit siblings this pass has
    // already unwrapped and detached.
    const parent = node.parentNode
    const moved = []
    while (node.firstChild) {
      const child = node.firstChild
      parent.insertBefore(child, node)
      moved.push(child)
    }
    node.remove()
    moved.forEach((child) => {
      if (child.nodeType === 8) child.remove()
      else if (child.nodeType === 1) cleanElement(child, doc)
    })
    return
  }

  const allowed = ATTRS_BY_TAG[tag] || []
  Array.from(node.attributes).forEach(({ name }) => {
    const attr = name.toLowerCase()
    if (attr === 'style') return
    if (!allowed.includes(attr)) node.removeAttribute(name)
  })

  const style = cleanStyle(node.getAttribute('style'))
  if (style) node.setAttribute('style', style)
  else node.removeAttribute('style')

  if (tag === 'OL' && node.hasAttribute('type') && !OL_TYPES.has(node.getAttribute('type'))) {
    node.removeAttribute('type')
  }
  if (tag === 'A') {
    const href = (node.getAttribute('href') || '').trim()
    if (!SAFE_HREF.test(href)) node.removeAttribute('href')
    if (node.getAttribute('target')) node.setAttribute('rel', 'noopener noreferrer')
  }

  cleanChildren(node, doc)
}

function cleanChildren(parent, doc) {
  Array.from(parent.childNodes).forEach((child) => {
    if (child.nodeType === 8) child.remove() // comment
    else if (child.nodeType === 1) cleanElement(child, doc)
  })
}

/**
 * Strip a guidelines value down to the allowed subset. Returns '' for anything
 * unparseable, and is safe to call on every keystroke.
 */
export function sanitizeRichTextHtml(html) {
  const input = String(html || '')
  if (!input.trim()) return ''
  if (typeof DOMParser === 'undefined') return ''
  const doc = new DOMParser().parseFromString(`<body>${input}</body>`, 'text/html')
  cleanChildren(doc.body, doc)
  return doc.body.innerHTML
}

const BLOCK_BOUNDARY = /<\/(?:p|div|li|ul|ol|h[1-6]|blockquote|pre|tr)>|<br\s*\/?>/gi

/** The words alone — for "is this empty?" checks and character counts. */
export function richTextToPlainText(value) {
  const raw = String(value || '')
  if (!raw) return ''
  if (!isRichTextHtml(raw)) return raw
  if (typeof DOMParser === 'undefined') return raw.replace(/<[^>]*>/g, ' ')
  const spaced = raw.replace(BLOCK_BOUNDARY, (match) => `${match}\n`)
  const doc = new DOMParser().parseFromString(`<body>${spaced}</body>`, 'text/html')
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n')
}

/** True when a value renders as nothing — including `<p><br></p>` and friends. */
export function isRichTextEmpty(value) {
  return !richTextToPlainText(value).replace(/\u00a0/g, ' ').trim()
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** The inline Markdown the old plain-text guidelines actually used. */
function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>')
}

/**
 * Lift legacy plain text / Markdown into editor HTML, so the first time an
 * admin opens an older hackathon its dashes are already real bullets rather
 * than a wall of literal "- " lines.
 */
export function plainTextToRichTextHtml(value) {
  const raw = String(value || '')
  if (!raw.trim()) return ''
  if (isRichTextHtml(raw)) return sanitizeRichTextHtml(raw)

  const out = []
  let list = null // 'ul' | 'ol'
  let paragraph = []

  const closeParagraph = () => {
    if (paragraph.length) out.push(`<p>${paragraph.join('<br>')}</p>`)
    paragraph = []
  }
  const closeList = () => {
    if (list) out.push(`</${list}>`)
    list = null
  }
  const openList = (kind) => {
    if (list === kind) return
    closeList()
    out.push(`<${kind}>`)
    list = kind
  }

  raw.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim()
    if (!line) {
      closeParagraph()
      closeList()
      return
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      closeParagraph()
      closeList()
      const level = Math.min(4, heading[1].length + 1)
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`)
      return
    }

    const bullet = /^[-*•·]\s+(.*)$/.exec(line)
    if (bullet) {
      closeParagraph()
      openList('ul')
      out.push(`<li>${inlineMarkdown(bullet[1])}</li>`)
      return
    }

    const numbered = /^\d+[.)]\s+(.*)$/.exec(line)
    if (numbered) {
      closeParagraph()
      openList('ol')
      out.push(`<li>${inlineMarkdown(numbered[1])}</li>`)
      return
    }

    closeList()
    paragraph.push(inlineMarkdown(line))
  })

  closeParagraph()
  closeList()
  return out.join('')
}
