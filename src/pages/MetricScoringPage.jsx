import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { evaluationRequirementsApi } from '../api/evaluationRequirements'
import { useAuth } from '../hooks/useAuth'
import { ROLES } from '../utils/constants'
import {
  alignMetricsToRequirement,
  buildStandardScorecardPreset,
  sortScorecardMetrics,
  sumWeights,
} from '../utils/scorecard'
import {
  BADGE,
  BADGE_CLOSED,
  BADGE_CLOSING,
  BADGE_OPEN,
  BTN_GHOST,
  EYEBROW,
  MONO,
  PANEL,
  WRAP_APP,
} from '../components/drop/theme'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import Input, { Select, Textarea } from '../components/ui/Input'
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

function isSolutionDescriptionKey(fieldKey) {
  return String(fieldKey || '').trim().toLowerCase() === 'solution_description'
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
      options: Array.isArray(segment?.options) ? segment.options : [],
      description: segment?.description || '',
    })),
  }
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
        if (!segment.key.trim()) {
          errors[`${prefix}.s${segmentIndex}.key`] = 'Segment key is required.'
        }
        if (segment.kind === 'enum' && !(segment.options || []).length) {
          errors[`${prefix}.s${segmentIndex}.options`] = 'Add enum options (comma-separated).'
        }
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
            ? String(segment.optionsText ?? (segment.options || []).join(', '))
                .split(',')
                .map((part) => part.trim())
                .filter(Boolean)
            : undefined,
        description: segment.description?.trim() || undefined,
      })),
    }
  })
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

  const updateSegment = (metricIndex, segmentIndex, patch) => {
    setMetrics((current) =>
      current.map((metric, index) => {
        if (index !== metricIndex) return metric
        const segments = (metric.segments || []).map((segment, sIndex) =>
          sIndex === segmentIndex ? { ...segment, ...patch } : segment,
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
        <form className="flex flex-col gap-6 pb-28" onSubmit={save} noValidate>
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
          {saveMessage && <Alert variant="success">{saveMessage}</Alert>}
          {(errors.form || errors.weights) && (
            <Alert variant="danger">{errors.form || errors.weights}</Alert>
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
                    <span className={`${MONO} text-volt`}>{String(index + 1).padStart(2, '0')}</span>
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
                    <Input
                      label="Color"
                      type="color"
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
                            className="font-medium text-ink underline decoration-hairline underline-offset-4 hover:text-volt hover:decoration-volt"
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
                            hint={
                              isSolutionDescriptionKey(metric.field_key)
                                ? 'Insert {Problem Statement} to give the model the student’s problem.'
                                : undefined
                            }
                            onChange={(event) =>
                              updateMetric(index, { scoring_prompt: event.target.value })
                            }
                          />
                          {promptPlaceholders.length > 0 && (
                            <div>
                              <p className="mb-1.5 text-[12px] text-muted">
                                Insert into prompt
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {promptPlaceholders.map((placeholder) => (
                                  <button
                                    key={placeholder.token}
                                    type="button"
                                    disabled={!isAdmin}
                                    title={
                                      placeholder.description ||
                                      `Insert ${placeholder.token} as literal text`
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
                          {segment.kind === 'enum' && (
                            <Input
                              label="Options (comma-separated)"
                              value={
                                segment.optionsText ??
                                (segment.options || []).join(', ')
                              }
                              disabled={!isAdmin}
                              error={errors[`m${index}.s${segmentIndex}.options`]}
                              onChange={(event) =>
                                updateSegment(index, segmentIndex, {
                                  optionsText: event.target.value,
                                  options: event.target.value
                                    .split(',')
                                    .map((part) => part.trim())
                                    .filter(Boolean),
                                })
                              }
                            />
                          )}
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
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {isAdmin && (
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 md:left-[264px]">
              <div className="pointer-events-auto mx-auto w-full max-w-[1480px] px-5 pb-4 md:px-8">
                <div
                  className={`${PANEL} flex flex-col-reverse gap-3 bg-surface/95 p-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:p-3.5`}
                >
                  {scoring ? (
                    <button
                      type="button"
                      className={`${BTN_GHOST} w-full border-transparent text-[#ff8a8a] hover:border-[#5a2222] hover:bg-[#2a1010] sm:w-auto`}
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Icon name="trash" size={17} />
                      Delete scorecard
                    </button>
                  ) : (
                    <span className="hidden text-[13px] text-muted sm:inline">
                      Weights must total 100 before saving.
                    </span>
                  )}
                  <Button
                    type="submit"
                    variant="accent"
                    loading={saving}
                    leftIcon={<Icon name="check" size={18} />}
                    className="w-full sm:w-auto sm:min-w-[200px]"
                  >
                    {scoring ? 'Save scorecard' : 'Create scorecard'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </form>
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
