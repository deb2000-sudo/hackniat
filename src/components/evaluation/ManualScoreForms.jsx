import Badge from '../ui/Badge'
import Input, { Select } from '../ui/Input'
import {
  enumOptionsAreScored,
  isGithubFieldKey,
  isMvpFieldKey,
  normalizeSegmentOptions,
} from '../../utils/scorecard'

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

      {/* Rendered by kind, not assumed boolean: an MVP-group metric such as
          Project Deployed Link can carry graded enum levels too. */}
      <div className="stack-sm">
        {segments.map((segment) => (
          <SegmentField
            key={segment.key}
            metric={metric}
            segment={segment}
            draft={draft}
            disabled={disabled}
            onChange={onChange}
            showBooleanPoints
          />
        ))}
      </div>

      <MetricRunningTotal metric={metric} />
    </div>
  )
}

/**
 * One enum segment.
 *
 * Graded levels get a radio group showing what each pick is worth; an ungraded
 * enum (GitHub public/private) is just a labelled choice, so it stays a select
 * rather than pretending marks are on offer.
 *
 * Only the chosen `value` is submitted — the backend awards that option's
 * marks and caps them, so the UI never invents a score.
 */
function EnumSegmentField({ metric, segment, draft, disabled, onChange }) {
  const options = normalizeSegmentOptions(segment.options)
  const value = draft?.[segment.key]?.value ?? ''
  const cap = Number(segment.max_score) || 0
  const pick = (next) => onChange({ ...draft, [segment.key]: { value: next } })

  if (!enumOptionsAreScored(options)) {
    return (
      <Select
        label={segment.label || segment.key}
        value={value}
        disabled={disabled}
        hint={segment.description}
        onChange={(event) => pick(event.target.value)}
      >
        <option value="">Select…</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    )
  }

  return (
    <fieldset disabled={disabled} className="manual-metric-card__fieldset">
      <legend>
        {segment.label || segment.key}
        {cap > 0 && <span className="manual-segment-cap"> (max {cap})</span>}
      </legend>
      {segment.description && (
        <p className="manual-metric-card__hint">{segment.description}</p>
      )}
      <div className="manual-choice-row manual-choice-row--levels">
        {options.map((option) => {
          // Mirror the backend cap so the evaluator is never shown marks that
          // an option could not actually award.
          const awarded = cap > 0 ? Math.min(option.score, cap) : option.score
          return (
            <label
              key={option.value}
              className={value === option.value ? 'is-active' : ''}
            >
              <input
                type="radio"
                name={`${metric.field_key}-${segment.key}`}
                value={option.value}
                checked={value === option.value}
                disabled={disabled}
                onChange={() => pick(option.value)}
              />
              <span>
                {option.label}
                <small>
                  {awarded}/{cap || awarded}
                </small>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/**
 * One segment, rendered by its kind.
 *
 * Shared by the MVP and generic forms: MVP metrics used to assume every segment
 * was a boolean checkbox, which silently swallowed graded enums on exactly the
 * metric (Project Deployed Link) that needs them most.
 */
function SegmentField({ metric, segment, draft, disabled, onChange, showBooleanPoints }) {
  if (segment.kind === 'enum') {
    return (
      <EnumSegmentField
        metric={metric}
        segment={segment}
        draft={draft}
        disabled={disabled}
        onChange={onChange}
      />
    )
  }

  if (segment.kind === 'boolean') {
    const raw = draft?.[segment.key]?.value ?? draft?.[segment.key]
    const checked = raw === true || raw === 'true'
    return (
      <label className="manual-segment-check">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...draft, [segment.key]: { value: event.target.checked } })
          }
        />
        <span>
          <strong>{segment.label || segment.key}</strong>
          {showBooleanPoints && <small>+{segment.max_score ?? 5} pts when present</small>}
          {!showBooleanPoints && segment.description && <small>{segment.description}</small>}
        </span>
      </label>
    )
  }

  const score = draft?.[segment.key]?.score ?? draft?.[segment.key]?.value ?? ''
  return (
    <Input
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
}

/** Running total of what the evaluator has picked so far, capped at the max. */
function MetricRunningTotal({ metric }) {
  const segments = metric.segments || []
  const hasGradedEnum = segments.some(
    (segment) => segment.kind === 'enum' && enumOptionsAreScored(segment.options),
  )
  if (!hasGradedEnum) return null

  // Runs off the previewed segment scores rather than metric.score, which stays
  // null until every segment is answered — a running total has to show progress.
  const total = segments.reduce((sum, segment) => sum + (Number(segment.score) || 0), 0)
  const max = Number(metric.max_score) || 0

  return (
    <p className="manual-metric-total">
      <span>Selected levels</span>
      <strong>
        {max > 0 ? Math.min(total, max) : total} / {max}
      </strong>
    </p>
  )
}

function GenericManualForm({ metric, draft, disabled, onChange }) {
  const metricMax = Number(metric.max_score) || 0

  return (
    <div className="manual-metric-card" style={{ '--metric-color': metric.color || '#8a8a94' }}>
      <header>
        <div>
          <span className="manual-metric-card__mode">Manual</span>
          <h3>{metric.field_label || metric.field_key}</h3>
          {metricMax > 0 && (
            <p>
              Max {metricMax} · Weight {metric.weight ?? 0}%
            </p>
          )}
        </div>
        <Badge variant="neutral">{formatScoreBadge(metric.score, metric.max_score)}</Badge>
      </header>

      <div className="stack-sm">
        {(metric.segments || []).map((segment) => (
          <SegmentField
            key={segment.key}
            metric={metric}
            segment={segment}
            draft={draft}
            disabled={disabled}
            onChange={onChange}
          />
        ))}
      </div>

      <MetricRunningTotal metric={metric} />
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
