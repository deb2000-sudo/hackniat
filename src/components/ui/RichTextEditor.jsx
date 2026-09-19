import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Icon from './Icon'
import {
  RICH_TEXT_COLORS,
  RICH_TEXT_FONT_SIZES,
  RICH_TEXT_LIST_STYLES,
  isRichTextHtml,
  plainTextToRichTextHtml,
  sanitizeRichTextHtml,
} from '../../lib/richText'

/**
 * Formatting toolbar over a contenteditable, saving the small HTML subset in
 * lib/richText. Used for the guidelines an admin writes for students and
 * evaluators: bold / italic / underline, text colour and size, and bullet,
 * numbered, lettered or Roman lists.
 *
 * It drives the selection with `document.execCommand`. That API is formally
 * deprecated but is the only one every browser implements, and the whole
 * point of a WYSIWYG box is that it behaves like the one people already know:
 * Cmd-B bolds, Enter starts a paragraph, Tab-free list editing. Everything it
 * produces is normalised (`<font>` → `<span style>`) and sanitised before it
 * leaves the component, so the deprecated API never dictates what is stored.
 *
 * The element is uncontrolled on purpose: writing `innerHTML` on every render
 * would drop the caret to the start of the box on every keystroke. Instead the
 * DOM is written only when a value arrives that this editor did not emit.
 */

/** The ordered-list style keys, split out for the toolbar's two optgroups. */
const ORDERED_STYLES = RICH_TEXT_LIST_STYLES.filter((item) => item.group === 'ordered')
const UNORDERED_STYLES = RICH_TEXT_LIST_STYLES.filter((item) => item.group === 'unordered')

/** Painted on, then taken straight back off, to reset a colour in place. */
const SENTINEL_COLOR = '#000001'

const EMPTY_ACTIVE = {
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
  ul: false,
  ol: false,
  listStyle: '',
  fontSize: '',
  color: '',
}

function rgbToHex(value) {
  const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(String(value || ''))
  if (!match) return /^#[0-9a-f]{6}$/i.test(value) ? String(value).toLowerCase() : ''
  return `#${match.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`
}

/** The colour under the caret, as a hex string. Safari throws here. */
function readForeColor() {
  try {
    return rgbToHex(document.queryCommandValue('foreColor'))
  } catch {
    return ''
  }
}

/** Keep the caret where it is: a toolbar press must not blur the editor. */
function hold(event) {
  event.preventDefault()
}

function ToolButton({ icon, title, onClick, active, disabled = false }) {
  return (
    <button
      type="button"
      className={`rt-tool ${active ? 'is-active' : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onMouseDown={hold}
      onClick={onClick}
    >
      <Icon name={icon} size={17} />
    </button>
  )
}

/** Editor HTML for whatever the form is holding — legacy plain text included. */
function toEditorHtml(value) {
  const raw = String(value || '')
  if (!raw.trim()) return ''
  return sanitizeRichTextHtml(isRichTextHtml(raw) ? raw : plainTextToRichTextHtml(raw))
}

export default function RichTextEditor({
  label,
  value = '',
  onChange,
  hint,
  error,
  required = false,
  disabled = false,
  maxLength,
  placeholder = '',
  minHeight = 200,
  id,
  className = '',
}) {
  // The caret lives in the DOM, not in React state, and the toolbar mutates it
  // directly. Memoising the handlers around that is guesswork the compiler
  // cannot check, so opt this component out.
  'use no memo'
  const generatedId = useId()
  const editorId = id || generatedId
  const editorRef = useRef(null)
  const savedRange = useRef(null)
  /** Last HTML this editor handed upward — the guard against re-writing the
   *  DOM (and losing the caret) when that same value comes back as a prop. */
  const lastEmitted = useRef(null)
  const migrated = useRef(false)
  const [active, setActive] = useState(EMPTY_ACTIVE)
  const [empty, setEmpty] = useState(true)
  const [colorOpen, setColorOpen] = useState(false)
  const colorRef = useRef(null)

  const length = String(value || '').length
  const overLimit = Boolean(maxLength) && length > maxLength

  /* ----------------------------- selection ------------------------------ */

  const rememberSelection = useCallback(() => {
    const el = editorRef.current
    const selection = window.getSelection()
    if (!el || !selection || !selection.rangeCount) return
    const range = selection.getRangeAt(0)
    if (el.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange()
  }, [])

  const restoreSelection = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    const range = savedRange.current
    if (!range || !el.contains(range.commonAncestorContainer)) return
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  }, [])

  /** The UL/OL the caret sits in, if any. */
  const currentList = useCallback(() => {
    const el = editorRef.current
    const selection = window.getSelection()
    if (!el || !selection || !selection.rangeCount) return null
    const node = selection.getRangeAt(0).startContainer
    const start = node.nodeType === 3 ? node.parentElement : node
    const list = start?.closest?.('ol, ul')
    return list && el.contains(list) ? list : null
  }, [])

  const refreshActive = useCallback(() => {
    const el = editorRef.current
    const selection = window.getSelection()
    if (!el || !selection || !selection.rangeCount) return
    if (!el.contains(selection.getRangeAt(0).commonAncestorContainer)) return

    const list = currentList()
    let listStyle = ''
    if (list?.tagName === 'OL') {
      const type = list.getAttribute('type') || '1'
      listStyle = ORDERED_STYLES.find((item) => item.olType === type)?.key || 'decimal'
    } else if (list?.tagName === 'UL') {
      listStyle = list.style.listStyleType || 'disc'
    }

    const node = selection.anchorNode
    const element = node?.nodeType === 3 ? node.parentElement : node
    let fontSize = ''
    if (element && el.contains(element)) {
      const px = Math.round(parseFloat(window.getComputedStyle(element).fontSize))
      fontSize = RICH_TEXT_FONT_SIZES.find((item) => parseInt(item.value, 10) === px)?.value || ''
    }

    const state = (command) => {
      try {
        return document.queryCommandState(command)
      } catch {
        return false
      }
    }
    const color = readForeColor()

    setActive({
      bold: state('bold'),
      italic: state('italic'),
      underline: state('underline'),
      strikeThrough: state('strikeThrough'),
      ul: list?.tagName === 'UL',
      ol: list?.tagName === 'OL',
      listStyle,
      fontSize,
      color,
    })
  }, [currentList])

  /* ------------------------------ emitting ------------------------------ */

  const emit = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const hasText = Boolean(el.textContent.replace(/\u00a0/g, ' ').trim())
    const html = hasText ? sanitizeRichTextHtml(el.innerHTML) : ''
    setEmpty(!hasText)
    if (html === lastEmitted.current) return
    lastEmitted.current = html
    onChange?.(html)
  }, [onChange])

  const runCommand = useCallback(
    (action) => {
      if (disabled) return
      restoreSelection()
      try {
        document.execCommand('styleWithCSS', false, true)
      } catch {
        /* Safari throws on an unsupported command rather than returning false. */
      }
      action()
      rememberSelection()
      emit()
      refreshActive()
    },
    [disabled, emit, refreshActive, rememberSelection, restoreSelection],
  )

  const exec = (command, argument) => {
    runCommand(() => document.execCommand(command, false, argument))
  }

  /* ------------------------------- effects ------------------------------ */

  // Write the DOM only for values this editor did not produce: the first load,
  // and a reset from the parent. Anything typed here is already on screen.
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const incoming = String(value || '')
    if (incoming === lastEmitted.current) return
    el.innerHTML = toEditorHtml(incoming)
    lastEmitted.current = incoming
    setEmpty(!el.textContent.trim())
  }, [value])

  // A hackathon written before this editor holds plain text. Convert it once,
  // on open, so what the admin sees is what a save would store.
  useEffect(() => {
    if (migrated.current || disabled) return
    migrated.current = true
    const raw = String(value || '')
    if (!raw.trim() || isRichTextHtml(raw)) return
    const html = toEditorHtml(raw)
    if (!html || html === raw) return
    lastEmitted.current = html
    onChange?.(html)
    // Runs for the value present at mount; later edits go through `emit`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p')
    } catch {
      /* Not supported everywhere; the browser's own default then applies. */
    }
  }, [])

  useEffect(() => {
    const onSelectionChange = () => {
      rememberSelection()
      refreshActive()
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [refreshActive, rememberSelection])

  useEffect(() => {
    if (!colorOpen) return undefined
    const onDown = (event) => {
      if (!colorRef.current?.contains(event.target)) setColorOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setColorOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [colorOpen])

  /* ------------------------------ commands ------------------------------ */

  /**
   * `fontSize` only understands the 1–7 scale, so ask for the sentinel 7 and
   * swap the `<font>` tags it leaves behind for spans carrying the real size.
   * The replaced nodes are re-selected so the text stays highlighted and a
   * second click (size, then colour) still lands on the same words.
   */
  const applyFontSize = (size) => {
    runCommand(() => {
      const el = editorRef.current
      document.execCommand('styleWithCSS', false, false)
      document.execCommand('fontSize', false, '7')
      document.execCommand('styleWithCSS', false, true)

      const replaced = []
      el.querySelectorAll('font[size="7"]').forEach((node) => {
        const span = document.createElement('span')
        span.style.fontSize = size
        while (node.firstChild) span.appendChild(node.firstChild)
        node.replaceWith(span)
        replaced.push(span)
      })
      // With styleWithCSS forced on by an outer command, some builds emit the
      // CSS keyword instead of a <font> tag.
      el.querySelectorAll('span[style*="xxx-large"]').forEach((node) => {
        node.style.fontSize = size
        replaced.push(node)
      })

      if (!replaced.length) return
      try {
        const range = document.createRange()
        range.setStartBefore(replaced[0])
        range.setEndAfter(replaced[replaced.length - 1])
        const selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
      } catch {
        /* Nodes ended up in an order Range refuses; the size still applied. */
      }
    })
  }

  /**
   * "Default colour" has to put the text back to inheriting the page's ink,
   * and `removeFormat` would strip the bold and the size along with it. So
   * paint the selection a sentinel colour — which gets it its own spans,
   * exactly the ones to clear — then take the colour back off those.
   */
  const applyColor = (hex) => {
    setColorOpen(false)
    runCommand(() => {
      if (hex) {
        document.execCommand('foreColor', false, hex)
        return
      }
      const el = editorRef.current
      document.execCommand('foreColor', false, SENTINEL_COLOR)
      el.querySelectorAll('[style*="color"]').forEach((node) => {
        if (rgbToHex(node.style.color) !== SENTINEL_COLOR) return
        node.style.color = ''
        if (!node.getAttribute('style')) node.removeAttribute('style')
      })
    })
  }

  /**
   * One control for "make this a list" and "number it this way": pick Roman
   * numerals with the caret in a paragraph and it becomes an `<ol type="i">`;
   * pick them inside an existing bulleted list and the list converts.
   */
  const applyListStyle = (key) => {
    const style = RICH_TEXT_LIST_STYLES.find((item) => item.key === key)
    if (!style) return
    runCommand(() => {
      const wanted = style.group === 'ordered' ? 'OL' : 'UL'
      let list = currentList()
      if (!list || list.tagName !== wanted) {
        document.execCommand(
          wanted === 'OL' ? 'insertOrderedList' : 'insertUnorderedList',
          false,
          null,
        )
        list = currentList()
      }
      if (!list) return
      if (wanted === 'OL') {
        list.style.listStyleType = ''
        list.setAttribute('type', style.olType)
      } else {
        list.removeAttribute('type')
        list.style.listStyleType = style.key
      }
    })
  }

  const toggleList = (kind) => {
    runCommand(() => {
      document.execCommand(kind === 'ol' ? 'insertOrderedList' : 'insertUnorderedList', false, null)
      const list = currentList()
      if (list?.tagName === 'OL' && !list.getAttribute('type')) list.setAttribute('type', '1')
    })
  }

  /** Paste arrives as whatever the source app writes; keep only our subset. */
  const onPaste = (event) => {
    if (disabled) return
    const html = event.clipboardData?.getData('text/html')
    const text = event.clipboardData?.getData('text/plain') || ''
    event.preventDefault()
    const clean = html ? sanitizeRichTextHtml(html) : ''
    runCommand(() => {
      if (clean) document.execCommand('insertHTML', false, clean)
      // Multi-line plain text becomes blocks; a single line stays inline, so
      // pasting a word mid-sentence does not split the paragraph around it.
      else if (/\r?\n/.test(text)) {
        document.execCommand('insertHTML', false, plainTextToRichTextHtml(text))
      } else document.execCommand('insertText', false, text)
    })
  }

  const counterHint = maxLength
    ? `${length.toLocaleString()} / ${maxLength.toLocaleString()} characters, formatting included`
    : ''

  return (
    <div className={`field rich-text ${className}`}>
      {label && (
        <label className="label" htmlFor={editorId}>
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}

      <div className={`rt-shell ${error ? 'rt-shell--error' : ''} ${disabled ? 'rt-shell--disabled' : ''}`}>
        <div className="rt-toolbar" role="toolbar" aria-label={`${label || 'Text'} formatting`}>
          <div className="rt-group">
            <ToolButton
              icon="bold"
              title="Bold (Ctrl+B)"
              disabled={disabled}
              active={active.bold}
              onClick={() => exec('bold')}
            />
            <ToolButton
              icon="italic"
              title="Italic (Ctrl+I)"
              disabled={disabled}
              active={active.italic}
              onClick={() => exec('italic')}
            />
            <ToolButton
              icon="underline"
              title="Underline (Ctrl+U)"
              disabled={disabled}
              active={active.underline}
              onClick={() => exec('underline')}
            />
            <ToolButton
              icon="strikethrough"
              title="Strikethrough"
              disabled={disabled}
              active={active.strikeThrough}
              onClick={() => exec('strikeThrough')}
            />
          </div>

          <div className="rt-group">
            <select
              className="rt-select"
              title="Font size"
              aria-label="Font size"
              disabled={disabled}
              value={active.fontSize}
              onChange={(event) => applyFontSize(event.target.value)}
            >
              <option value="" disabled>
                Size
              </option>
              {RICH_TEXT_FONT_SIZES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <div className="rt-color" ref={colorRef}>
              <button
                type="button"
                className={`rt-tool rt-tool--color ${colorOpen ? 'is-active' : ''}`}
                title="Text colour"
                aria-label="Text colour"
                aria-expanded={colorOpen}
                disabled={disabled}
                onMouseDown={hold}
                onClick={() => setColorOpen((open) => !open)}
              >
                <span className="rt-color__glyph">A</span>
                <span
                  className="rt-color__bar"
                  style={{ background: active.color || 'currentColor' }}
                />
                <Icon name="chevronDown" size={13} />
              </button>
              {colorOpen && (
                <div className="rt-color__menu">
                  <div className="rt-color__grid">
                    {RICH_TEXT_COLORS.filter((item) => item.value).map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className="rt-swatch"
                        style={{ background: item.value }}
                        title={item.label}
                        aria-label={item.label}
                        onMouseDown={hold}
                        onClick={() => applyColor(item.value)}
                      />
                    ))}
                  </div>
                  <div className="rt-color__row">
                    <button
                      type="button"
                      className="rt-color__reset"
                      onMouseDown={hold}
                      onClick={() => applyColor('')}
                    >
                      Default colour
                    </button>
                    <label className="rt-color__custom" title="Custom colour">
                      <input
                        type="color"
                        value={active.color || '#4f46e5'}
                        onChange={(event) => applyColor(event.target.value)}
                      />
                      <span>Custom</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rt-group">
            <ToolButton
              icon="listBullet"
              title="Bulleted list"
              disabled={disabled}
              active={active.ul}
              onClick={() => toggleList('ul')}
            />
            <ToolButton
              icon="listNumber"
              title="Numbered list"
              disabled={disabled}
              active={active.ol}
              onClick={() => toggleList('ol')}
            />
            <select
              className="rt-select rt-select--list"
              title="Bullet and numbering style"
              aria-label="Bullet and numbering style"
              disabled={disabled}
              value={active.listStyle}
              onChange={(event) => applyListStyle(event.target.value)}
            >
              <option value="" disabled>
                List style
              </option>
              <optgroup label="Numbering">
                {ORDERED_STYLES.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Bullets">
                {UNORDERED_STYLES.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            </select>
            <ToolButton
              icon="outdent"
              title="Decrease indent"
              disabled={disabled}
              onClick={() => exec('outdent')}
            />
            <ToolButton
              icon="indent"
              title="Increase indent"
              disabled={disabled}
              onClick={() => exec('indent')}
            />
          </div>

          <div className="rt-group rt-group--end">
            <ToolButton
              icon="clearFormat"
              title="Clear formatting"
              disabled={disabled}
              onClick={() => exec('removeFormat')}
            />
          </div>
        </div>

        <div
          id={editorId}
          ref={editorRef}
          className="rt-editor markdown-body"
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-invalid={!!error}
          aria-required={required}
          data-placeholder={placeholder}
          data-empty={empty ? 'true' : 'false'}
          style={{ minHeight }}
          onInput={emit}
          onBlur={emit}
          onPaste={onPaste}
          onKeyUp={refreshActive}
          onMouseUp={refreshActive}
        />
      </div>

      {error ? (
        <span className="field__error">{error}</span>
      ) : (
        (hint || counterHint) && (
          <span className={`field__hint ${overLimit ? 'field__hint--over' : ''}`}>
            {hint}
            {hint && counterHint ? ' · ' : ''}
            {counterHint}
          </span>
        )
      )}
    </div>
  )
}
