import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { evaluationRequirementsApi } from '../api/evaluationRequirements'
import { useAuth } from '../hooks/useAuth'
import { ROLES } from '../utils/constants'
import {
  alignMetricsToRequirement,
  buildStandardScorecardPreset,
  enumOptionsAreScored,
  normalizeSegmentOptions,
  segmentEffectiveMax,
  sortScorecardMetrics,
  sumWeights,
} from '../utils/scorecard'
import {
  BADGE,
  BADGE_CLOSED,
  BADGE_CLOSING,
  BADGE_OPEN,
  EYEBROW,
  MONO,
  PANEL,
  WRAP_APP,
} from '../components/drop/theme'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import Input, { ColorInput, Select, Textarea } from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import { LoadingBlock } from '../components/ui/Spinner'

function emptySegment() {
  return {
    key: '',
    label: '',
    kind: 'boolean',
    max_score: 5,
    options: [],
    description: '',
  }
}

/** Video score uses analysis report + AI prompts analyze_video — not a scorecard prompt. */
function isVideoMetricKey(fieldKey) {
  const key = String(fieldKey || '').trim().toLowerCase()
  return key === 'video_explanation' || key === 'video'
}

function normalizePlaceholders(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((item) => {
      if (typeof item === 'string') {
        const token = item.trim()
        return token ? { token, label: token, description: '' } : null
      }
      const token = String(item?.token || '').trim()
      if (!token) return null
      return {
        token,
        label: String(item?.label || token).trim() || token,
        description: String(item?.description || '').trim(),
      }
    })
    .filter(Boolean)
}

/** Insert a literal placeholder token at the textarea caret (not resolved in the UI). */
function insertTokenAtCursor(textarea, value, token, onChange) {
  const current = String(value || '')
  if (!textarea) {
    onChange(current + token)
    return
  }
  const start = Number.isFinite(textarea.selectionStart) ? textarea.selectionStart : current.length
  const end = Number.isFinite(textarea.selectionEnd) ? textarea.selectionEnd : start
  const next = `${current.slice(0, start)}${token}${current.slice(end)}`
  onChange(next)
  requestAnimationFrame(() => {
    textarea.focus()
    const caret = start + token.length
    textarea.setSelectionRange(caret, caret)
  })
}

function normalizeMetric(metric) {
  const segments = Array.isArray(metric?.segments) ? metric.segments : []
  return {
    field_key: metric?.field_key || '',
    field_label: metric?.field_label || metric?.field_key || '',
    scoring_mode: metric?.scoring_mode === 'manual' ? 'manual' : 'ai',
    scoring_prompt: metric?.scoring_prompt || '',
    max_score: metric?.max_score ?? 10,
    weight: metric?.weight ?? 0,
    color: metric?.color || '#2563EB',
    segments: segments.map((segment) => ({
      key: segment?.key || '',
      label: segment?.label || '',
      kind: segment?.kind || 'score',
      max_score: segment?.max_score ?? 0,
      // Legacy scorecards store bare strings; normalizing here means the editor
      // only ever deals in {value, label, score}.
      options: normalizeSegmentOptions(segment?.options),
      description: segment?.description || '',
    })),
  }
}

function emptyOption() {
  return { value: '', label: '', score: 0 }
}

const trimNumber = (value) => {
  const number = Number(value) || 0
  return Number.isInteger(number) ? String(number) : String(Math.round(number * 100) / 100)
}

/**
 * Non-blocking warnings about marks that don't add up. Computed locally rather
 * than read from `metric.warnings[]` so they track what the admin is typing —
 * the API's copy goes stale the moment a field changes. Same formula as the
 * backend's `metric_segment_sum_warnings`.
 */
function segmentSumWarnings(metric) {
  const segments = metric.segments || []
  if (!segments.length) return []

  const warnings = []
  let total = 0

  segments.forEach((segment) => {
    const effective = segmentEffectiveMax(segment)
    total += effective
    if (segment.kind === 'enum' && enumOptionsAreScored(segment.options)) {
      const declared = Number(segment.max_score) || 0
      if (declared && Math.abs(declared - effective) > 0.01) {
        warnings.push(
          `${segment.label || segment.key || 'Segment'}: option marks top out at ` +
            `${trimNumber(effective)} but segment max score is ${trimNumber(declared)}.`,
        )
      }
    }
  })

  const metricMax = Number(metric.max_score) || 0
  if (Math.abs(total - metricMax) > 0.01) {
    warnings.push(
      `Segment marks add up to ${trimNumber(total)} but ` +
        `${metric.field_label || metric.field_key || 'this metric'} max score is ` +
        `${trimNumber(metricMax)}.`,
    )
  }

  return warnings
}

function validate(name, metrics) {
  const errors = {}
  if (!name.trim()) errors.name = 'Give this scorecard a name.'
  const weightTotal = sumWeights(metrics)
  if (Math.round(weightTotal) !== 100) {
    errors.weights = `Weights must sum to 100 (currently ${weightTotal}).`
  }

  metrics.forEach((metric, index) => {
    const prefix = `m${index}`
    if (!metric.field_key.trim()) errors[`${prefix}.field_key`] = 'Field key is required.'
    if (!Number.isFinite(Number(metric.max_score)) || Number(metric.max_score) < 0) {
      errors[`${prefix}.max_score`] = 'Enter a valid max score.'
    }
    if (!Number.isFinite(Number(metric.weight)) || Number(metric.weight) < 0) {
      errors[`${prefix}.weight`] = 'Enter a valid weight.'
    }
    if (
      metric.scoring_mode === 'ai' &&
      !isVideoMetricKey(metric.field_key) &&
      !String(metric.scoring_prompt || '').trim()
    ) {
      errors[`${prefix}.scoring_prompt`] = 'AI metrics need a scoring prompt.'
    }
    if (metric.scoring_mode === 'manual') {
      if (!metric.segments?.length) {
        errors[`${prefix}.segments`] = 'Add at least one segment for manual metrics.'
      }
      metric.segments?.forEach((segment, segmentIndex) => {
        const segmentPrefix = `${prefix}.s${segmentIndex}`
        if (!segment.key.trim()) {
          errors[`${segmentPrefix}.key`] = 'Segment key is required.'
        }
        if (segment.kind !== 'enum') return

        const options = segment.options || []
        if (!options.length) {
          errors[`${segmentPrefix}.options`] = 'Add at least one level for an enum segment.'
          return
        }

        // Options are mutually exclusive, so each one on its own must fit
        // inside the segment's max — they are never summed against it.
        const cap = Number(segment.max_score) || 0
        const seenValues = new Set()

        options.forEach((option, optionIndex) => {
          const optionPrefix = `${segmentPrefix}.o${optionIndex}`
          const value = String(option.value || '').trim()

          if (!value) {
            errors[`${optionPrefix}.value`] = 'Value is required.'
          } else if (seenValues.has(value)) {
            // A repeated value makes the evaluator's pick ambiguous, and the
            // backend resolves it to whichever option it finds first.
            errors[`${optionPrefix}.value`] = `Duplicate value “${value}”.`
          } else {
            seenValues.add(value)
          }

          if (!String(option.label || '').trim()) {
            errors[`${optionPrefix}.label`] = 'Label is required.'
          }

          const score = Number(option.score)
          if (option.score === '' || option.score == null || !Number.isFinite(score)) {
            errors[`${optionPrefix}.score`] = 'Marks are required.'
          } else if (score < 0) {
            errors[`${optionPrefix}.score`] = 'Marks must be 0 or more.'
          } else if (cap > 0 && score > cap) {
            errors[`${optionPrefix}.score`] = `Marks must be ≤ ${trimNumber(cap)}`
          }
        })
      })
    }
  })
  return errors
}

function toPayloadMetrics(metrics) {
  return metrics.map((metric) => {
    const base = {
      field_key: metric.field_key.trim(),
      field_label: metric.field_label.trim() || undefined,
      scoring_mode: metric.scoring_mode,
      max_score: Number(metric.max_score),
      weight: Number(metric.weight),
      color: metric.color || undefined,
    }
    if (metric.scoring_mode === 'ai') {
      if (isVideoMetricKey(metric.field_key)) {
        // Backend clears this; video scoring uses the analyze_video AI prompt.
        return { ...base, scoring_prompt: null }
      }
      return { ...base, scoring_prompt: metric.scoring_prompt.trim() }
    }
    return {
      ...base,
      segments: (metric.segments || []).map((segment) => ({
        key: segment.key.trim(),
        label: segment.label.trim() || segment.key.trim(),
        kind: segment.kind,
        max_score: Number(segment.max_score || 0),
        options:
          segment.kind === 'enum'
            ? (segment.options || []).map((option) => ({
                value: String(option.value || '').trim(),
                label: String(option.label || option.value || '').trim(),
                score: Number(option.score) || 0,
              }))
            : undefined,
        description: segment.description?.trim() || undefined,
      })),
    }
  })
}

/** Yellow, never blocking — an admin may be mid-edit, or may mean it. */
function SegmentSumWarning({ metric }) {
  const warnings = segmentSumWarnings(metric)
  if (!warnings.length) return null

  return (
    <Alert variant="warning" title="Marks don’t add up">
      <ul className="list-disc pl-4">
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
      <p className="mt-2">
        You can still save — evaluators just won’t be able to reach the metric’s full{' '}
        {trimNumber(metric.max_score)} marks.
      </p>
    </Alert>
  )
}

/**
 * Graded levels for an enum segment. The evaluator picks exactly ONE, so each
 * level's marks stand alone: Fully=5 on a max-5 segment awards 5/5, and the
 * four levels are never summed against that 5.
 */
function SegmentLevels({ segment, isAdmin, errors, errorPrefix, onAdd, onChange, onRemove }) {
  const options = segment.options || []
  const cap = Number(segment.max_score) || 0
  const graded = enumOptionsAreScored(options)

  return (
    <div className="sm:col-span-2 xl:col-span-4">
      <div className="row-between wrap mb-2 gap-2">
        <div>
          <h5 className="text-[13px] font-semibold text-ink">Levels / options</h5>
          <p className="text-[12.5px] text-muted">
            The evaluator picks one. Each level&rsquo;s marks must be{' '}
            {cap > 0 ? `≤ ${trimNumber(cap)}` : 'a number'} — they are not added together.
            {!graded && options.length > 0 && ' All marks are 0, so this is a plain choice.'}
          </p>
        </div>
        {isAdmin && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onAdd}
            leftIcon={<Icon name="plus" size={15} />}
          >
            Add option
          </Button>
        )}
      </div>

      {errors[`${errorPrefix}.options`] && (
        <Alert variant="danger">{errors[`${errorPrefix}.options`]}</Alert>
      )}

      <div className="stack-sm">
        {options.map((option, optionIndex) => (
          <div
            key={optionIndex}
            className="grid grid-cols-1 gap-3 rounded-drop border border-hairline bg-raised p-3 sm:grid-cols-[1fr_1.4fr_auto_auto] sm:items-end"
          >
            <Input
              label="Value"
              value={option.value || ''}
              disabled={!isAdmin}
              placeholder="full"
              error={errors[`${errorPrefix}.o${optionIndex}.value`]}
              hint="Stable id stored on the scorecard."
              onChange={(event) => onChange(optionIndex, { value: event.target.value })}
            />
            <Input
              label="Label"
              value={option.label || ''}
              disabled={!isAdmin}
              placeholder="Fully Authentication feature"
              error={errors[`${errorPrefix}.o${optionIndex}.label`]}
              hint="Shown to the evaluator."
              onChange={(event) => onChange(optionIndex, { label: event.target.value })}
            />
            <Input
              label="Marks"
              type="number"
              min="0"
              max={cap > 0 ? cap : undefined}
              step="1"
              value={option.score ?? ''}
              disabled={!isAdmin}
              error={errors[`${errorPrefix}.o${optionIndex}.score`]}
              hint={cap > 0 ? `of ${trimNumber(cap)}` : undefined}
              onChange={(event) =>
                onChange(optionIndex, {
                  score: event.target.value === '' ? '' : Number(event.target.value),
                })
              }
            />
            {isAdmin && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onRemove(optionIndex)}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MetricScoringPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === ROLES.ADMIN
  const { requirementId: requirementIdParam } = useParams()
  const requirementId = requirementIdParam?.trim() || ''

  const [requirement, setRequirement] = useState(null)
  const [scoring, setScoring] = useState(null)
  const [name, setName] = useState('')
  const [metrics, setMetrics] = useState([])
  const [promptPlaceholders, setPromptPlaceholders] = useState([])
  const [loading, setLoading] = useState(Boolean(requirementId))
  const [loadError, setLoadError] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const promptRefs = useRef({})

  const weightTotal = useMemo(() => sumWeights(metrics), [metrics])
  const saveFeedback = errors.form || errors.weights || saveMessage
  const saveFeedbackVariant = errors.form || errors.weights ? 'danger' : 'success'

  useEffect(() => {
    if (!requirementId) return undefined
    const controller = new AbortController()
    let active = true
    ;(async () => {
      setLoading(true)
      setLoadError('')
      setSaveMessage('')
      try {
        const setup = await evaluationRequirementsApi.getScoringSetup(requirementId, {
          signal: controller.signal,
        })
        if (!active) return
        const loadedRequirement = setup?.requirement || null
        const existing = setup?.scoring || null
        setRequirement(loadedRequirement)
        setScoring(existing)
        setPromptPlaceholders(normalizePlaceholders(setup?.scoring_prompt_placeholders))
        setName(
          existing?.name ||
            `${loadedRequirement?.name || loadedRequirement?.title || 'Evaluation'} scorecard`,
        )
        setMetrics(
          sortScorecardMetrics(
            alignMetricsToRequirement(
              (existing?.metrics || []).map(normalizeMetric),
              loadedRequirement?.fields,
            ),
          ),
        )
      } catch (error) {
        if (!active || error.name === 'AbortError') return
        setRequirement(null)
        setScoring(null)
        setPromptPlaceholders([])
        setMetrics([])
        setLoadError(error.message || 'Unable to load scoring setup.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
      controller.abort()
    }
  }, [requirementId])

  const loadPreset = () => {
    if (!isAdmin || !requirementId) return
    const preset = buildStandardScorecardPreset(requirementId, requirement?.fields)
    setName(preset.name)
    setMetrics(
      sortScorecardMetrics(
        alignMetricsToRequirement(preset.metrics.map(normalizeMetric), requirement?.fields),
      ),
    )
    setErrors({})
    setSaveMessage('Loaded standard scorecard. Review prompts, then save.')
  }

  const updateMetric = (index, patch) => {
    setMetrics((current) =>
      current.map((metric, metricIndex) =>
        metricIndex === index ? { ...metric, ...patch } : metric,
      ),
    )
    setErrors((current) => ({ ...current, form: undefined, weights: undefined }))
    setSaveMessage('')
  }

  /**
   * Patch one segment. `derive` covers patches that need the current segment
   * (the option list), so option edits don't each need their own setMetrics.
   */
  const updateSegment = (metricIndex, segmentIndex, patch, derive) => {
    setMetrics((current) =>
      current.map((metric, index) => {
        if (index !== metricIndex) return metric
        const segments = (metric.segments || []).map((segment, sIndex) =>
          sIndex === segmentIndex
            ? { ...segment, ...(derive ? derive(segment) : patch) }
            : segment,
        )
        return { ...metric, segments }
      }),
    )
  }

  const addSegment = (metricIndex) => {
    setMetrics((current) =>
      current.map((metric, index) =>
        index === metricIndex
          ? { ...metric, segments: [...(metric.segments || []), emptySegment()] }
          : metric,
      ),
    )
  }

  /** Patch one option inside one segment, leaving every sibling untouched. */
  const updateOption = (metricIndex, segmentIndex, optionIndex, patch) => {
    updateSegment(metricIndex, segmentIndex, null, (segment) => ({
      options: (segment.options || []).map((option, oIndex) =>
        oIndex === optionIndex ? { ...option, ...patch } : option,
      ),
    }))
  }

  const addOption = (metricIndex, segmentIndex) => {
    updateSegment(metricIndex, segmentIndex, null, (segment) => ({
      options: [...(segment.options || []), emptyOption()],
    }))
  }

  const removeOption = (metricIndex, segmentIndex, optionIndex) => {
    updateSegment(metricIndex, segmentIndex, null, (segment) => ({
      options: (segment.options || []).filter((_, oIndex) => oIndex !== optionIndex),
    }))
  }

  const removeSegment = (metricIndex, segmentIndex) => {
    setMetrics((current) =>
      current.map((metric, index) =>
        index === metricIndex
          ? {
              ...metric,
              segments: (metric.segments || []).filter((_, sIndex) => sIndex !== segmentIndex),
            }
          : metric,
      ),
    )
  }

  const save = async (event) => {
    event.preventDefault()
    if (!isAdmin) return
    const validation = validate(name, metrics)
    setErrors(validation)
    setSaveMessage('')
    if (Object.keys(validation).length) return

    const alignedMetrics = alignMetricsToRequirement(metrics, requirement?.fields)
    const payload = {
      name: name.trim(),
      metrics: toPayloadMetrics(sortScorecardMetrics(alignedMetrics)),
    }

    setSaving(true)
    try {
      const saved = await evaluationRequirementsApi.putMetricScoring(requirementId, payload)
      setScoring(saved)
      setName(saved.name || payload.name)
      setMetrics(
        sortScorecardMetrics(
          alignMetricsToRequirement(
            (saved.metrics || payload.metrics).map(normalizeMetric),
            requirement?.fields,
          ),
        ),
      )
      setSaveMessage(scoring ? 'Scorecard updated.' : 'Scorecard created.')
    } catch (error) {
      setErrors({ form: error.message || 'Unable to save the scorecard.' })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!scoring || !isAdmin) return
    setDeleting(true)
    setErrors({})
    try {
      await evaluationRequirementsApi.deleteMetricScoring(requirementId)
      setScoring(null)
      setMetrics([])
      setConfirmDelete(false)
      setSaveMessage('Scorecard deleted. Load the standard preset or build a new one.')
    } catch (error) {
      setErrors({ form: error.message || 'Unable to delete the scorecard.' })
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  if (!requirementId) {
    return <Navigate to="/admin/evaluation-requirements" replace />
  }

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <header className="mb-7 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <span className={EYEBROW}>Evaluation setup</span>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink md:text-[36px]">
            {requirement
              ? `Scorecard for ${requirement.name || requirement.title}`
              : 'Set scoring'}
          </h1>
          <p className="mt-2 text-[15px] text-muted md:text-base">
            Configure weighted AI and manual metrics for this requirement (total weight 100).
          </p>
        </div>
        <Button
          as={Link}
          to="/admin/evaluation-requirements"
          variant="secondary"
          leftIcon={<Icon name="arrowLeft" size={17} />}
        >
          Requirements
        </Button>
      </header>

      {loadError && (
        <div className="mb-6">
          <Alert variant="danger" title="Unable to load scoring setup">
            {loadError}
          </Alert>
        </div>
      )}
      {loading && <LoadingBlock label="Loading scorecard…" />}

      {!loading && requirement && (
        <>
        <form
          id="scorecard-form"
          className="flex flex-col gap-6 pb-36 md:pb-40"
          onSubmit={save}
          noValidate
        >
          <section
            className={`${PANEL} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5`}
          >
            <div className="min-w-0">
              <span className={EYEBROW}>Scorecard overview</span>
              <h2 className="mt-1 truncate text-[20px] font-semibold tracking-[-0.02em] text-ink">
                {requirement.name || requirement.title || 'Evaluation requirement'}
              </h2>
              <p className="mt-1 text-[13.5px] text-muted">
                Weight total{' '}
                <span className={MONO}>{weightTotal}</span>
                /100
                {' · '}
                {scoring ? 'Configuration saved' : 'Not saved yet'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`${BADGE} ${scoring ? BADGE_OPEN : BADGE_CLOSING}`}>
                {scoring ? 'Configured' : 'Draft'}
              </span>
              <span
                className={`${BADGE} ${Math.round(weightTotal) === 100 ? BADGE_OPEN : BADGE_CLOSED}`}
              >
                Weights {Math.round(weightTotal) === 100 ? 'OK' : 'incomplete'}
              </span>
            </div>
          </section>

          {!isAdmin && (
            <Alert variant="info">
              This is a read-only view. An administrator can update the scorecard.
            </Alert>
          )}

          <section className={`${PANEL} p-4 sm:p-5`}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <Input
                label="Configuration name"
                required
                maxLength={200}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setErrors((current) => ({ ...current, name: undefined }))
                }}
                error={errors.name}
                disabled={!isAdmin}
                className="sm:max-w-md"
              />
              {isAdmin && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={loadPreset}
                  leftIcon={<Icon name="sparkles" size={17} />}
                >
                  Load Standard Score and Weightage
                </Button>
              )}
            </div>
          </section>

          {!metrics.length ? (
            <Alert variant="warning" title="No metrics yet">
              Load the standard scorecard preset, or wait for an existing configuration.
            </Alert>
          ) : (
            <div className="stack-md">
              {metrics.map((metric, index) => (
                <article key={`${metric.field_key}-${index}`} className={`${PANEL} overflow-hidden`}>
                  <div
                    className="flex items-center gap-3 border-b border-hairline px-4 py-3.5 sm:px-5"
                    style={{ borderLeft: `4px solid ${metric.color || '#2563EB'}` }}
                  >
                    <span className={`${MONO} text-volt-ink`}>{String(index + 1).padStart(2, '0')}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[15.5px] font-semibold text-ink">
                        {metric.field_label || metric.field_key || 'Metric'}
                      </h3>
                      <code className={`${MONO} text-[12px] text-muted`}>{metric.field_key}</code>
                    </div>
                    <span className={`${BADGE} ${BADGE_CLOSED}`}>
                      {metric.scoring_mode === 'ai' ? 'AI' : 'Manual'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
                    <Input
                      label="Field key"
                      value={metric.field_key}
                      disabled={!isAdmin}
                      error={errors[`m${index}.field_key`]}
                      onChange={(event) => updateMetric(index, { field_key: event.target.value })}
                    />
                    <Input
                      label="Label"
                      value={metric.field_label}
                      disabled={!isAdmin}
                      onChange={(event) => updateMetric(index, { field_label: event.target.value })}
                    />
                    <Select
                      label="Scoring mode"
                      value={metric.scoring_mode}
                      disabled={!isAdmin}
                      onChange={(event) =>
                        updateMetric(index, {
                          scoring_mode: event.target.value,
                          segments:
                            event.target.value === 'manual' && !metric.segments?.length
                              ? [emptySegment()]
                              : metric.segments,
                        })
                      }
                    >
                      <option value="ai">AI</option>
                      <option value="manual">Manual</option>
                    </Select>
                    <ColorInput
                      label="Color"
                      value={metric.color || '#2563EB'}
                      disabled={!isAdmin}
                      onChange={(event) => updateMetric(index, { color: event.target.value })}
                    />
                    <Input
                      label="Max score"
                      type="number"
                      min="0"
                      max="100"
                      value={metric.max_score}
                      disabled={!isAdmin}
                      error={errors[`m${index}.max_score`]}
                      onChange={(event) => updateMetric(index, { max_score: event.target.value })}
                    />
                    <Input
                      label="Weight (%)"
                      type="number"
                      min="0"
                      max="100"
                      value={metric.weight}
                      disabled={!isAdmin}
                      error={errors[`m${index}.weight`]}
                      onChange={(event) => updateMetric(index, { weight: event.target.value })}
                    />
                  </div>

                  {metric.scoring_mode === 'ai' ? (
                    <div className="border-t border-hairline px-4 py-4 sm:px-5">
                      {isVideoMetricKey(metric.field_key) ? (
                        <p className="text-[13.5px] text-muted">
                          Video scoring uses the Working Demo Video Analysis prompt under{' '}
                          <Link
                            to="/admin/ai-prompts"
                            className="font-medium text-ink underline decoration-hairline underline-offset-4 hover:text-volt-ink hover:decoration-volt-ink"
                          >
                            AI prompts
                          </Link>
                          . No scorecard scoring prompt is required for this metric.
                        </p>
                      ) : (
                        <div className="stack-sm">
                          <Textarea
                            ref={(node) => {
                              if (node) promptRefs.current[index] = node
                              else delete promptRefs.current[index]
                            }}
                            label="Scoring prompt"
                            required
                            rows={5}
                            value={metric.scoring_prompt}
                            disabled={!isAdmin}
                            error={errors[`m${index}.scoring_prompt`]}
                            onChange={(event) =>
                              updateMetric(index, { scoring_prompt: event.target.value })
                            }
                          />
                          {promptPlaceholders.length > 0 && (
                            <div>
                              {/* Tokens are listed by the API, never hardcoded here —
                                  a new one appears the moment the backend ships it. */}
                              <p className="mb-1.5 text-[12px] text-muted">
                                Insert into prompt — each student&rsquo;s own values replace
                                these when their submission is scored.
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {promptPlaceholders.map((placeholder) => (
                                  <button
                                    key={placeholder.token}
                                    type="button"
                                    disabled={!isAdmin}
                                    title={
                                      placeholder.description
                                        ? `${placeholder.label}: ${placeholder.description}`
                                        : `Insert ${placeholder.token} as literal text`
                                    }
                                    className={`${MONO} rounded-full border border-hairline bg-raised px-2.5 py-1 text-[11px] text-muted transition hover:border-volt hover:text-ink disabled:cursor-not-allowed disabled:opacity-50`}
                                    onClick={() =>
                                      insertTokenAtCursor(
                                        promptRefs.current[index],
                                        metric.scoring_prompt,
                                        placeholder.token,
                                        (next) =>
                                          updateMetric(index, { scoring_prompt: next }),
                                      )
                                    }
                                  >
                                    {placeholder.token}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="stack-md border-t border-hairline px-4 py-4 sm:px-5">
                      <div className="row-between wrap">
                        <div>
                          <h4 className="text-[14px] font-semibold text-ink">Segments</h4>
                          <p className="text-sm text-muted">
                            Boolean, enum, or score inputs for evaluators.
                          </p>
                        </div>
                        {isAdmin && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => addSegment(index)}
                            leftIcon={<Icon name="plus" size={15} />}
                          >
                            Add segment
                          </Button>
                        )}
                      </div>
                      {errors[`m${index}.segments`] && (
                        <Alert variant="danger">{errors[`m${index}.segments`]}</Alert>
                      )}
                      {(metric.segments || []).map((segment, segmentIndex) => (
                        <div
                          key={`${segment.key}-${segmentIndex}`}
                          className={`${PANEL} grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4`}
                        >
                          <Input
                            label="Key"
                            value={segment.key}
                            disabled={!isAdmin}
                            error={errors[`m${index}.s${segmentIndex}.key`]}
                            onChange={(event) =>
                              updateSegment(index, segmentIndex, { key: event.target.value })
                            }
                          />
                          <Input
                            label="Label"
                            value={segment.label}
                            disabled={!isAdmin}
                            onChange={(event) =>
                              updateSegment(index, segmentIndex, { label: event.target.value })
                            }
                          />
                          <Select
                            label="Kind"
                            value={segment.kind}
                            disabled={!isAdmin}
                            onChange={(event) =>
                              updateSegment(index, segmentIndex, { kind: event.target.value })
                            }
                          >
                            <option value="boolean">boolean</option>
                            <option value="enum">enum</option>
                            <option value="score">score</option>
                          </Select>
                          <Input
                            label="Max score"
                            type="number"
                            value={segment.max_score}
                            disabled={!isAdmin}
                            onChange={(event) =>
                              updateSegment(index, segmentIndex, { max_score: event.target.value })
                            }
                          />
                          <Input
                            label="Description"
                            value={segment.description || ''}
                            disabled={!isAdmin}
                            onChange={(event) =>
                              updateSegment(index, segmentIndex, {
                                description: event.target.value,
                              })
                            }
                          />
                          {isAdmin && (
                            <div className="flex items-end">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => removeSegment(index, segmentIndex)}
                              >
                                Remove
                              </Button>
                            </div>
                          )}

                          {segment.kind === 'enum' && (
                            <SegmentLevels
                              segment={segment}
                              isAdmin={isAdmin}
                              errors={errors}
                              errorPrefix={`m${index}.s${segmentIndex}`}
                              onAdd={() => addOption(index, segmentIndex)}
                              onChange={(optionIndex, patch) =>
                                updateOption(index, segmentIndex, optionIndex, patch)
                              }
                              onRemove={(optionIndex) =>
                                removeOption(index, segmentIndex, optionIndex)
                              }
                            />
                          )}
                        </div>
                      ))}

                      <SegmentSumWarning metric={metric} />
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

        </form>

        {isAdmin && (
          <div className="scorecard-bottom-dock" aria-live="polite">
            {saveFeedback && (
              <Alert variant={saveFeedbackVariant} className="scorecard-feedback-banner">
                {saveFeedback}
              </Alert>
            )}
            <div className="scorecard-form-actions" role="region" aria-label="Scorecard actions">
              <div className="scorecard-form-actions__start">
                {scoring ? (
                  <button
                    type="button"
                    className="scorecard-form-actions__delete"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Icon name="trash" size={17} />
                    Delete scorecard
                  </button>
                ) : (
                  <p className="scorecard-form-actions__hint">
                    <Icon name="info" size={17} />
                    Weights must total 100 before saving.
                  </p>
                )}
              </div>
              <div className="scorecard-form-actions__end">
                <Button
                  type="submit"
                  form="scorecard-form"
                  variant="accent"
                  loading={saving}
                  leftIcon={<Icon name="check" size={18} />}
                  className="w-full sm:w-auto"
                >
                  {scoring ? 'Save scorecard' : 'Create scorecard'}
                </Button>
              </div>
            </div>
          </div>
        )}
        </>
      )}

      <Modal
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        title="Delete scorecard"
        footer={
          <>
            <Button variant="ghost" disabled={deleting} onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={remove}>
              Delete scorecard
            </Button>
          </>
        }
      >
        <p>
          Delete <strong>{scoring?.name}</strong>? The evaluation requirement will remain, but its
          scorecard configuration will be removed.
        </p>
      </Modal>
    </div>
  )
}
