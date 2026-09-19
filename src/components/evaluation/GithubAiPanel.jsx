import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import Spinner from '../ui/Spinner'
import { MONO } from '../drop/theme'
import { formatDateTime } from '../../utils/format'

/** One `{ key, value | score }` entry from the analyzer, rendered as a chip. */
function ResultSegment({ segment }) {
  if (!segment?.key) return null
  const label = segment.label || segment.key.replace(/_/g, ' ')
  const value =
    segment.value ??
    (segment.score != null
      ? `${segment.score}${segment.max_score != null ? ` / ${segment.max_score}` : ''}`
      : null)
  if (value == null) return null
  return (
    <span className="github-ai__segment">
      <span>{label}</span>
      <strong className={MONO}>{value}</strong>
    </span>
  )
}

/**
 * Extras the analyser reports alongside the score.
 *
 * The backend already folds these into `rationale`, but as a run-on sentence
 * ("… AI: generated Architecture: full-stack …") — pulled out as labelled
 * facts they are actually scannable.
 */
function analyzerFacts(result) {
  const payload = result?.external_response?.result
  if (!payload || typeof payload !== 'object') return []

  const facts = []

  const classification = payload.ai?.classification
  if (classification) {
    facts.push({ label: 'AI classification', value: String(classification) })
  }

  const applicationType = payload.architecture?.application_type
  if (applicationType) {
    facts.push({ label: 'Application type', value: String(applicationType) })
  }

  // The backend usually emits visibility as a scored segment already; only add
  // it here when it didn't, so the panel never shows it twice.
  const hasVisibilitySegment = (result.segments || []).some(
    (segment) => segment?.key === 'visibility',
  )
  if (!hasVisibilitySegment && typeof payload.access?.is_public === 'boolean') {
    facts.push({
      label: 'Repository',
      value: payload.access.is_public ? 'Public' : 'Private',
    })
  }

  return facts
}

/**
 * GitHub repository AI analysis for one submission.
 *
 * Entirely separate from the video AI evaluation on the same page: it has its
 * own enable flag, status field, and button, and a round may run either, both,
 * or neither. Visibility is driven by `show_github_ai_evaluation_button` from
 * the backend and never recomputed here.
 *
 * Staff-only: `result` and `error` are stripped for students server-side, so
 * this panel is only mounted on the evaluator and admin views.
 */
export default function GithubAiPanel({
  githubLink,
  status = 'none',
  result,
  error,
  canStart = false,
  starting = false,
  actionError = '',
  onStart,
}) {
  const processing = status === 'processing'
  const completed = status === 'completed'
  const failed = status === 'failed'
  const facts = completed && result ? analyzerFacts(result) : []

  return (
    <section className="github-ai">
      <header className="github-ai__head">
        <span className="github-ai__title">
          <Icon name="clipboard" size={16} />
          GitHub repository
        </span>
        {githubLink && (
          <a href={githubLink} target="_blank" rel="noopener noreferrer" className="github-ai__link">
            {githubLink}
            <Icon name="arrowRight" size={14} />
          </a>
        )}
      </header>

      {!githubLink && (
        <p className="text-sm text-muted">
          This submission has no repository link, so it cannot be analysed.
        </p>
      )}

      {actionError && <Alert variant="danger">{actionError}</Alert>}

      {processing && (
        <p className="github-ai__processing">
          <Spinner size="sm" />
          Analyzing repository… this can take 1–2 minutes.
        </p>
      )}

      {failed && error && (
        <Alert variant="danger" title="GitHub analysis failed">
          {error}
        </Alert>
      )}

      {completed && result && (
        <div className="github-ai__result">
          <div className="github-ai__score">
            <span>AI score</span>
            <strong className={MONO}>
              {result.score ?? '—'}
              {result.max_score != null ? ` / ${result.max_score}` : ''}
            </strong>
            {result.analyzed_at && (
              <small>Analyzed {formatDateTime(result.analyzed_at)}</small>
            )}
          </div>

          {!!result.segments?.length && (
            <div className="github-ai__segments">
              {result.segments.map((segment, index) => (
                <ResultSegment key={segment?.key || index} segment={segment} />
              ))}
            </div>
          )}

          {!!facts.length && (
            <dl className="github-ai__facts">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {result.rationale && <p className="github-ai__rationale">{result.rationale}</p>}

          {!!result.context?.rubrics?.length && (
            <details className="github-ai__context">
              <summary>Rubrics the AI was given</summary>
              <ul>
                {result.context.rubrics.map((rubric, index) => (
                  <li key={index}>{rubric}</li>
                ))}
              </ul>
            </details>
          )}

          <p className="text-sm text-muted">
            The GitHub metric below is pre-filled from this result. Edit it before submitting for
            review — your score is what gets saved.
          </p>
        </div>
      )}

      {/* The backend owns this decision, so say why the action is missing rather
          than rendering an empty box the evaluator cannot act on. */}
      {!canStart && !processing && status === 'none' && githubLink && (
        <p className="text-sm text-muted">
          Analysis is not available for this submission yet. It needs a problem statement, a
          solution description, and a repository link, and only the assigned evaluator or an
          admin can run it.
        </p>
      )}

      {/* Backend decides who may run this and when; never recomputed here. */}
      {canStart && !processing && (
        <div>
          <Button
            variant="secondary"
            size="sm"
            loading={starting}
            disabled={starting}
            onClick={onStart}
            leftIcon={<Icon name="sparkles" size={16} />}
          >
            {failed ? 'Retry GitHub AI' : completed ? 'Re-run GitHub AI' : 'Evaluate GitHub with AI'}
          </Button>
        </div>
      )}
    </section>
  )
}
