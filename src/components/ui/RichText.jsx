import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { isRichTextHtml, sanitizeRichTextHtml } from '../../lib/richText'

/**
 * Render a value written in the guidelines editor.
 *
 * Newer values are the sanitised HTML subset in lib/richText; older ones are
 * the plain text / Markdown that field used to hold. Both keep working, and
 * either way the markup is re-checked here rather than trusted because it came
 * back from the API.
 *
 * The wrapper element carries `className` itself — `.markdown-body > * + *`
 * spaces *direct* children, so an extra div in between would flatten the gaps.
 */
export default function RichText({ value, className = '', empty = null }) {
  const raw = String(value || '')
  if (!raw.trim()) return empty

  if (isRichTextHtml(raw)) {
    const html = sanitizeRichTextHtml(raw)
    if (!html) return empty
    return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  }

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{raw}</ReactMarkdown>
    </div>
  )
}
