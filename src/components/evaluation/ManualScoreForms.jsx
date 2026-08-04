import Badge from '../ui/Badge'
import Input from '../ui/Input'
import { isGithubFieldKey, isMvpFieldKey } from '../../utils/scorecard'

const STRUCTURE_PRESETS = [20, 10, 5]

function readDraftValue(entry) {
  if (entry == null) return ''
  if (typeof entry === 'object' && !Array.isArray(entry) && 'value' in entry) {
    const value = entry.value
    return value == null || value === '' ? '' : String(value)
  }
  return String(entry)
}

function readDraftScore(entry) {
  if (entry == null || entry === '') return ''
  if (typeof entry === 'object' && !Array.isArray(entry)) {
    const raw = entry.score ?? entry.value
    return raw == null || raw === '' ? '' : raw
  }
  return entry
}

function formatScoreBadge(score, maxScore) {
  const max = Number(maxScore) || 0
  return `${score != null && score !== '' ? score : '—'}/${max}`
}

function ExternalLink({ href, label }) {
  if (!href) {
    return <p className="text-sm text-muted">No link provided by the student.</p>
  }
  return (
    <a
      className="manual-score-link"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {label || href}
    </a>
  )
}

function GitHubManualForm({ metric, draft, link, disabled, onChange }) {
  const visibility = readDraftValue(draft?.visibility)
  const structure = readDraftScore(draft?.structure_score)
  const isPrivate = visibility === 'private'
  const isPublic = visibility === 'public'
  const structureDef =
    metric.segments?.find((segment) => segment.key === 'structure_score') || {}
  const visibilityDef =
    metric.segments?.find((segment) => segment.key === 'visibility') || {}

  return (
    <div className="manual-metric-card" style={{ '--metric-color': metric.color || '#059669' }}>
      <header>
        <div>
          <span className="manual-metric-card__mode">Manual</span>
          <h3>{metric.field_label || 'GitHub Full Stack'}</h3>
          <p>Max {metric.max_score} · Weight {metric.weight ?? 0}%</p>
        </div>
        <Badge variant="success">{formatScoreBadge(metric.score, metric.max_score)}</Badge>
      </header>

      <div className="manual-metric-card__link">
        <span>Student GitHub</span>
        <ExternalLink href={link} label={link} />
      </div>

      <fieldset disabled={disabled} className="manual-metric-card__fieldset">
        <legend>{visibilityDef.label || 'Repository visibility'}</legend>
        <div className="manual-choice-row">
          {['public', 'private'].map((option) => (
            <label key={option} className={visibility === option ? 'is-active' : ''}>
              <input
                type="radio"
                name={`${metric.field_key}-visibility`}
                value={option}
                checked={visibility === option}
                onChange={() =>
                  onChange({
                    ...draft,
                    visibility: { value: option },
                    structure_score:
                      option === 'private' ? { score: 0 } : draft?.structure_score,
                  })
                }
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {isPrivate && (
        <p className="manual-metric-card__hint">
          Private repositories score 0 for GitHub Full Stack.
        </p>
      )}

      <div
        className={`manual-metric-card__structure${!isPublic ? ' is-disabled' : ''}`}
        aria-disabled={!isPublic || disabled}
      >
        <div className="manual-metric-card__structure-head">
          <strong>{structureDef.label || 'Full Stack Verification'}</strong>
          {structureDef.description && <small>{structureDef.description}</small>}
          {!visibility && (
            <small className="manual-metric-card__hint">
              Choose Public or Private above before scoring structure.
            </small>
          )}
          {isPublic && (
            <small className="manual-metric-card__hint">
              Select a preset or enter a custom score (max {structureDef.max_score ?? 20}).
            </small>
          )}
        </div>
        <div className="manual-choice-row">
          {STRUCTURE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={Number(structure) === preset ? 'is-active' : ''}
              disabled={disabled || !isPublic}
              onClick={() =>
                onChange({
                  ...draft,
                  visibility: { value: 'public' },
                  structure_score: { score: preset },
                })
              }
            >
              {preset}
            </button>
          ))}
        </div>
        <Input
          label="Custom structure score"
          type="number"
          min="0"
          max={structureDef.max_score ?? 20}
          step="1"
          value={structure === '' || structure == null ? '' : structure}
          disabled={disabled || !isPublic}
          onChange={(event) =>
            onChange({
              ...draft,
              visibility: { value: 'public' },
              structure_score: {
                score: event.target.value === '' ? '' : Number(event.target.value),
              },
            })
          }
        />
      </div>
    </div>
  )
}

function MvpManualForm({ metric, draft, link, disabled, onChange }) {
  const segments = metric.segments || []
  const liveScore = metric.score

  return (
    <div className="manual-metric-card" style={{ '--metric-color': metric.color || '#D97706' }}>
      <header>
        <div>
          <span className="manual-metric-card__mode">Manual</span>
          <h3>{metric.field_label || 'MVP Features'}</h3>
          <p>Max {metric.max_score} · Weight {metric.weight ?? 0}%</p>
        </div>
        <Badge variant="warning">{formatScoreBadge(liveScore, metric.max_score)}</Badge>
      </header>

      <div className="manual-metric-card__link">
        <span>Student MVP</span>
        <ExternalLink href={link} label={link} />
      </div>

      <ul className="manual-boolean-list">
        {segments.map((segment) => {
          const raw = draft?.[segment.key]?.value ?? draft?.[segment.key]
          const checked = raw === true || raw === 'true'
          return (
            <li key={segment.key}>
              <label>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      [segment.key]: { value: event.target.checked },
                    })
                  }
                />
                <span>
                  <strong>{segment.label || segment.key}</strong>
                  <small>+{segment.max_score ?? 5} pts when present</small>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function GenericManualForm({ metric, draft, disabled, onChange }) {
  return (
    <div className="manual-metric-card" style={{ '--metric-color': metric.color || '#8a8a94' }}>
      <header>
        <div>
          <span className="manual-metric-card__mode">Manual</span>
          <h3>{metric.field_label || metric.field_key}</h3>
        </div>
        <Badge variant="neutral">{formatScoreBadge(metric.score, metric.max_score)}</Badge>
      </header>
      <div className="stack-sm">
        {(metric.segments || []).map((segment) => {
          if (segment.kind === 'boolean') {
            const checked =
              draft?.[segment.key]?.value === true || draft?.[segment.key] === true
            return (
              <label key={segment.key} className="manual-boolean-list li-label">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      [segment.key]: { value: event.target.checked },
                    })
                  }
                />
                <span>{segment.label || segment.key}</span>
              </label>
            )
          }
          if (segment.kind === 'enum') {
            const value = draft?.[segment.key]?.value ?? ''
            return (
              <div key={segment.key} className="manual-choice-row">
                {(segment.options || []).map((option) => (
                  <label key={option} className={value === option ? 'is-active' : ''}>
                    <input
                      type="radio"
                      name={`${metric.field_key}-${segment.key}`}
                      checked={value === option}
                      disabled={disabled}
                      onChange={() =>
                        onChange({ ...draft, [segment.key]: { value: option } })
                      }
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            )
          }
          const score = draft?.[segment.key]?.score ?? draft?.[segment.key]?.value ?? ''
          return (
            <Input
              key={segment.key}
              label={segment.label || segment.key}
              type="number"
              min="0"
              max={segment.max_score}
              value={score === '' || score == null ? '' : score}
              disabled={disabled}
              hint={segment.description}
              onChange={(event) =>
                onChange({
                  ...draft,
                  [segment.key]: {
                    score: event.target.value === '' ? '' : Number(event.target.value),
                  },
                })
              }
            />
          )
        })}
      </div>
    </div>
  )
}

/** Manual scorecard inputs for evaluator (GitHub + MVP specialized). */
export default function ManualScoreForms({
  scorecard,
  draftByFieldKey,
  githubLink,
  mvpLink,
  disabled,
  onDraftChange,
}) {
  const manualMetrics = (scorecard?.metrics || []).filter(
    (metric) => metric.scoring_mode === 'manual',
  )
  if (!manualMetrics.length) return null

  return (
    <div className="stack-md">
      {manualMetrics.map((metric) => {
        const draft = draftByFieldKey[metric.field_key] || {}
        const setDraft = (next) => onDraftChange(metric.field_key, next)

        if (isGithubFieldKey(metric.field_key)) {
          return (
            <GitHubManualForm
              key={metric.field_key}
              metric={metric}
              draft={draft}
              link={githubLink}
              disabled={disabled}
              onChange={setDraft}
            />
          )
        }
        if (isMvpFieldKey(metric.field_key)) {
          return (
            <MvpManualForm
              key={metric.field_key}
              metric={metric}
              draft={draft}
              link={mvpLink}
              disabled={disabled}
              onChange={setDraft}
            />
          )
        }
        return (
          <GenericManualForm
            key={metric.field_key}
            metric={metric}
            draft={draft}
            disabled={disabled}
            onChange={setDraft}
          />
        )
      })}
    </div>
  )
}
