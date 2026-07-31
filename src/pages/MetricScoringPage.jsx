import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { metricScoringApi } from '../api/metricScoring'
import { evaluationRequirementsApi } from '../api/evaluationRequirements'
import { ApiError } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { ROLES } from '../utils/constants'
import {
  buildStandardScorecardPreset,
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

function normalizeMetric(metric) {
  return {
    field_key: metric.field_key || '',
    field_label: metric.field_label || metric.field_key || '',
    scoring_mode: metric.scoring_mode === 'manual' ? 'manual' : 'ai',
    scoring_prompt: metric.scoring_prompt || '',
    max_score: metric.max_score ?? 10,
    weight: metric.weight ?? 0,
    color: metric.color || '#2563EB',
    segments: (metric.segments || []).map((segment) => ({
      key: segment.key || '',
      label: segment.label || '',
      kind: segment.kind || 'score',
      max_score: segment.max_score ?? 0,
      options: segment.options || [],
      description: segment.description || '',
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
    if (metric.scoring_mode === 'ai' && !String(metric.scoring_prompt || '').trim()) {
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
  const navigate = useNavigate()
  const { evaluationRequirementId } = useParams()
  const [searchParams] = useSearchParams()
  const requirementId =
    evaluationRequirementId?.trim() ||
    searchParams.get('evaluation_requirement_id')?.trim() ||
    ''

  const [requirementIdInput, setRequirementIdInput] = useState(requirementId)
  const [requirement, setRequirement] = useState(null)
  const [scoring, setScoring] = useState(null)
  const [name, setName] = useState('')
  const [metrics, setMetrics] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
        const [loadedRequirement, configurations] = await Promise.all([
          evaluationRequirementsApi.get(requirementId, { signal: controller.signal }),
          metricScoringApi.list(requirementId, { signal: controller.signal }),
        ])
        if (!active) return
        const existing = configurations[0] || null
        setRequirement(loadedRequirement)
        setScoring(existing)
        setName(
          existing?.name ||
            `${loadedRequirement.name || loadedRequirement.title || 'Evaluation'} scorecard`,
        )
        setMetrics((existing?.metrics || []).map(normalizeMetric))
      } catch (error) {
        if (!active || error.name === 'AbortError') return
        setRequirement(null)
        setScoring(null)
        setMetrics([])
        setLoadError(error.message || 'Unable to load the evaluation requirement.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
      controller.abort()
    }
  }, [requirementId])

  const openRequirement = (event) => {
    event.preventDefault()
    const id = requirementIdInput.trim()
    if (!id) {
      setLoadError('Enter an evaluation requirement ID.')
      return
    }
    navigate(`/admin/evaluation-requirements/${encodeURIComponent(id)}/ai-scoring`)
  }

  const loadPreset = () => {
    if (!isAdmin || !requirementId) return
    const preset = buildStandardScorecardPreset(requirementId)
    setName(preset.name)
    setMetrics(preset.metrics.map(normalizeMetric))
    setErrors({})
    setSaveMessage('Loaded standard 15/15/20/20/30 scorecard. Review prompts, then save.')
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

    const payload = {
      name: name.trim(),
      metrics: toPayloadMetrics(metrics),
    }
    if (!scoring) payload.evaluation_requirement_id = requirementId

    setSaving(true)
    try {
      const saved = scoring
        ? await metricScoringApi.update(scoring.id, payload)
        : await metricScoringApi.create(payload)
      setScoring(saved)
      setName(saved.name || payload.name)
      setMetrics((saved.metrics || payload.metrics).map(normalizeMetric))
      setSaveMessage(scoring ? 'Scorecard updated.' : 'Scorecard created.')
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        try {
          const existing = (await metricScoringApi.list(requirementId))[0]
          if (existing) {
            setScoring(existing)
            setName(existing.name || name)
            setMetrics((existing.metrics || []).map(normalizeMetric))
            setSaveMessage('A scorecard already exists. It is now open for editing.')
            return
          }
        } catch {
          // fall through
        }
      }
      setErrors({ form: error.message || 'Unable to save the scorecard.' })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!scoring?.id || !isAdmin) return
    setDeleting(true)
    setErrors({})
    try {
      await metricScoringApi.delete(scoring.id)
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

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <header className="mb-7 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <span className={EYEBROW}>Evaluation setup</span>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink md:text-[36px]">
            Set scoring
          </h1>
          <p className="mt-2 text-[15px] text-muted md:text-base">
            Configure weighted AI and manual metrics for an evaluation requirement (total weight 100).
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

      <section className={`${PANEL} mb-6 p-4 sm:p-5`}>
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={openRequirement}
        >
          <div className="min-w-0 flex-1">
            <Input
              label="Evaluation requirement ID"
              value={requirementIdInput}
              onChange={(event) => {
                setRequirementIdInput(event.target.value)
                setLoadError('')
              }}
              placeholder="Paste the requirement ID"
            />
          </div>
          <button type="submit" className={`${BTN_GHOST} w-full shrink-0 sm:w-auto`}>
            <Icon name="search" size={17} />
            Load requirement
          </button>
        </form>
      </section>

      {requirementId && loadError && (
        <div className="mb-6">
          <Alert variant="danger" title="Unable to load requirement">
            {loadError}
          </Alert>
        </div>
      )}
      {requirementId && loading && (
        <LoadingBlock label="Loading requirement and scorecard…" />
      )}

      {requirementId && !loading && requirement && (
        <form className="flex flex-col gap-6 pb-28" onSubmit={save} noValidate>
          <section
            className={`${PANEL} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5`}
          >
            <div className="min-w-0">
              <span className={EYEBROW}>Scorecard for</span>
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
                  Load standard 15/15/20/20/30 scorecard
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
                      <Textarea
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

      {(!requirementId || (!loading && !requirement && !loadError)) && (
        <div
          className={`${PANEL} mt-2 flex min-h-[280px] flex-col items-center justify-center border-dashed px-6 py-14 text-center`}
        >
          <span className="mb-4 grid size-14 place-items-center rounded-drop border border-volt-edge bg-volt-tint text-volt">
            <Icon name="chart" size={26} />
          </span>
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">
            Choose an evaluation requirement
          </h2>
          <p className="mt-2 max-w-[48ch] text-[14.5px] text-muted">
            Open Set scoring from a requirement card, or paste a requirement ID above.
          </p>
        </div>
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
