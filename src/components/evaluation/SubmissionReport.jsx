import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { evaluationApi } from '../../api/evaluation'
import { useAsync } from '../../hooks/useAsync'
import { formatDateTime } from '../../utils/format'
import Alert from '../ui/Alert'
import Card, { CardBody, CardHeader } from '../ui/Card'
import Icon from '../ui/Icon'
import { LoadingBlock } from '../ui/Spinner'

const HEADING_RE = /^(#{1,2})\s+(.*)$/

/**
 * Split a markdown document into sections at each top-level (# or ##)
 * heading. Content preceding the first heading (if any) is kept under
 * `fallbackTitle` rather than dropped, so nothing from the real report is
 * ever discarded.
 */
function splitMarkdownSections(markdown, fallbackTitle) {
  if (!markdown || !markdown.trim()) return []

  const lines = markdown.split(/\r?\n/)
  const sections = []
  let current = null

  for (const line of lines) {
    const match = HEADING_RE.exec(line)
    if (match) {
      if (current) sections.push(current)
      current = { title: match[2].trim(), lines: [] }
    } else {
      if (!current) current = { title: fallbackTitle, lines: [] }
      current.lines.push(line)
    }
  }
  if (current) sections.push(current)

  return sections
    .map((s) => ({ title: s.title, body: s.lines.join('\n').trim() }))
    .filter((s) => s.body)
}

/**
 * Turn a section's raw markdown body into a short, plain-text excerpt
 * suitable for a quote: strip markdown syntax, collapse to one line, and
 * cap the length.
 */
function extractExcerpt(markdown, maxLen = 240) {
  if (!markdown) return ''
  const text = markdown
    .replace(/^>\s?/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s*(\[[ xX]\]\s*)?/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .trim()
  if (!text) return ''
  return text.length > maxLen ? `${text.slice(0, maxLen).trim()}…` : text
}

/**
 * Pull the "expert diagnostic" quote from whichever real section actually
 * exists — an Overall Assessment section is preferred, falling back to
 * Recommendations. Never fabricated: if neither section is present, the
 * caller shows a neutral "not yet available" state instead.
 */
function findDiagnosticExcerpt(sections) {
  const assessment = sections.find((s) => /overall\s*assessment/i.test(s.title))
  const recommendations = sections.find((s) => /recommendation/i.test(s.title))
  const source = assessment || recommendations
  return source ? extractExcerpt(source.body) : ''
}

function ExpertDiagnostic({ excerpt }) {
  return (
    <div className={`expert-diagnostic ${excerpt ? '' : 'expert-diagnostic--empty'}`}>
      <div className="expert-diagnostic__label">
        <Icon name="star" size={14} />
        Expert Diagnostic
      </div>
      <p className="expert-diagnostic__quote">
        {excerpt ? `“${excerpt}”` : 'Expert summary not yet available.'}
      </p>
    </div>
  )
}

function CollapsibleSection({ index, title, body, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`di-section ${open ? 'di-section--open' : ''}`}>
      <button
        type="button"
        className="di-section__header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="di-section__badge">{index}</span>
        <span className="di-section__title">{title}</span>
        <Icon name="chevronDown" size={18} className="di-section__chevron" />
      </button>
      {open && (
        <div className="di-section__body markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}

export default function SubmissionReport({ submissionId }) {
  const { data, loading, error, reload } = useAsync(() =>
    evaluationApi.getSubmissionReport(submissionId),
  )

  if (loading) {
    return (
      <Card>
        <CardBody>
          <LoadingBlock label="Loading analysis report…" />
        </CardBody>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="danger" title="Unable to load analysis report">
        <div className="stack-sm">
          <span>{error.message}</span>
          <button type="button" className="link-btn" onClick={reload}>
            Try again
          </button>
        </div>
      </Alert>
    )
  }

  // Whatever real headings the AI-generated checklist/report actually use
  // become the sections — nothing here is a fixed/invented category list.
  const sections = [
    ...splitMarkdownSections(data?.checklist, 'Checklist'),
    ...splitMarkdownSections(data?.report, 'Report'),
  ]
  const diagnosticExcerpt = findDiagnosticExcerpt(sections)

  return (
    <Card>
      <CardHeader>
        <div>
          <h3>Detailed Intelligence</h3>
          <p className="text-sm text-muted" style={{ marginTop: 4 }}>
            Analyzed {formatDateTime(data?.analyzed_at)}
          </p>
        </div>
        <Icon name="file" size={20} className="text-muted" />
      </CardHeader>
      <CardBody>
        {sections.length ? (
          <div className="di-list">
            {sections.map((section, i) => (
              <CollapsibleSection
                key={`${i}-${section.title}`}
                index={i + 1}
                title={section.title}
                body={section.body}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted text-sm">No report content was returned.</p>
        )}
        {sections.length > 0 && <ExpertDiagnostic excerpt={diagnosticExcerpt} />}
      </CardBody>
    </Card>
  )
}
