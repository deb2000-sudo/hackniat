import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { metricScoringApi } from '../api/metricScoring'
import { evaluationRequirementsApi } from '../api/evaluationRequirements'
import { ApiError } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { ROLES } from '../utils/constants'
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
import Input, { Textarea } from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import { LoadingBlock } from '../components/ui/Spinner'

function getFields(requirement) {
  const fields =
    requirement?.fields ||
    requirement?.required_fields ||
    requirement?.submission_fields ||
    []

  return fields
    .map((field) => ({
      key: field.key || field.field_key,
      label: field.label || field.field_label || field.name || field.key || field.field_key,
    }))
    .filter((field) => field.key)
}

function createMetrics(fields, scoring) {
  const savedByKey = new Map(
    (scoring?.metrics || []).map((metric) => [metric.field_key, metric]),
  )
  return fields.map((field) => {
    const saved = savedByKey.get(field.key)
    return {
      field_key: field.key,
      field_label: saved?.field_label || field.label,
      scoring_prompt: saved?.scoring_prompt || '',
      max_score: saved?.max_score ?? 10,
      weight: saved?.weight ?? '',
    }
  })
}

function validate(name, metrics) {
  const errors = {}
  if (!name.trim()) errors.name = 'Give this scoring configuration a name.'

  metrics.forEach((metric) => {
    if (!metric.scoring_prompt.trim()) {
      errors[`${metric.field_key}.scoring_prompt`] = 'Add a scoring prompt for this field.'
    }
    const maxScore = Number(metric.max_score)
    if (
      metric.max_score === '' ||
      !Number.isFinite(maxScore) ||
      maxScore < 0 ||
      maxScore > 100
    ) {
      errors[`${metric.field_key}.max_score`] = 'Enter a score from 0 to 100.'
    }
    if (
      metric.weight !== '' &&
      (!Number.isFinite(Number(metric.weight)) || Number(metric.weight) < 0)
    ) {
      errors[`${metric.field_key}.weight`] = 'Enter a positive number or leave this blank.'
    }
  })
  return errors
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

  const fields = useMemo(() => getFields(requirement), [requirement])

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
        const loadedFields = getFields(loadedRequirement)
        setRequirement(loadedRequirement)
        setScoring(existing)
        setName(existing?.name || `${loadedRequirement.name || loadedRequirement.title || 'Evaluation'} scoring`)
        setMetrics(createMetrics(loadedFields, existing))
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
    navigate(`/ai-scoring?evaluation_requirement_id=${encodeURIComponent(id)}`)
  }

  const updateMetric = (fieldKey, property) => (event) => {
    const value = event.target.value
    setMetrics((current) =>
      current.map((metric) =>
        metric.field_key === fieldKey ? { ...metric, [property]: value } : metric,
      ),
    )
    setErrors((current) => ({
      ...current,
      [`${fieldKey}.${property}`]: undefined,
      form: undefined,
    }))
    setSaveMessage('')
  }

  const save = async (event) => {
    event.preventDefault()
    if (!isAdmin) return
    const validation = validate(name, metrics)
    setErrors(validation)
    setSaveMessage('')
    if (Object.keys(validation).length) return

    const cleanedMetrics = metrics.map((metric) => ({
      field_key: metric.field_key,
      scoring_prompt: metric.scoring_prompt.trim(),
      max_score: Number(metric.max_score),
      weight: metric.weight === '' ? null : Number(metric.weight),
    }))
    const payload = { name: name.trim(), metrics: cleanedMetrics }
    if (!scoring) payload.evaluation_requirement_id = requirementId

    setSaving(true)
    try {
      const saved = scoring
        ? await metricScoringApi.update(scoring.id, payload)
        : await metricScoringApi.create(payload)
      setScoring(saved)
      setName(saved.name || payload.name)
      setMetrics(createMetrics(fields, saved))
      setSaveMessage(scoring ? 'AI scoring updated.' : 'AI scoring created.')
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        try {
          const existing = (await metricScoringApi.list(requirementId))[0]
          if (existing) {
            setScoring(existing)
            setName(existing.name || name)
            setMetrics(createMetrics(fields, existing))
            setSaveMessage('A scoring configuration already exists. It is now open for editing.')
            return
          }
        } catch {
          // Preserve the original conflict if the recovery request fails.
        }
      }
      setErrors({ form: error.message || 'Unable to save the scoring configuration.' })
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
      setName(`${requirement?.name || requirement?.title || 'Evaluation'} scoring`)
      setMetrics(createMetrics(fields, null))
      setConfirmDelete(false)
      setSaveMessage('AI scoring deleted. You can create a new configuration below.')
    } catch (error) {
      setErrors({ form: error.message || 'Unable to delete the scoring configuration.' })
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <header className="mb-7 max-w-3xl sm:mb-9">
        <span className={EYEBROW}>Evaluation setup</span>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink md:text-[36px]">
          AI metric scoring
        </h1>
        <p className="mt-2 text-[15px] text-muted md:text-base">
          {isAdmin
            ? 'Define a natural-language scoring instruction for every field in an evaluation requirement.'
            : 'Review the field-level instructions used to score this evaluation requirement.'}
        </p>
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
        <LoadingBlock label="Loading requirement and AI scoring…" />
      )}

      {requirementId && !loading && requirement && (
        <form className="flex flex-col gap-6 pb-28" onSubmit={save} noValidate>
          <section
            className={`${PANEL} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5`}
          >
            <div className="flex min-w-0 items-start gap-3.5 sm:items-center">
              <span className="grid size-11 shrink-0 place-items-center rounded-drop border border-volt-edge bg-volt-tint text-volt">
                <Icon name="sparkles" size={20} />
              </span>
              <div className="min-w-0">
                <span className={`${EYEBROW} !tracking-[0.1em]`}>Scoring for</span>
                <h2 className="mt-1 truncate text-[20px] font-semibold tracking-[-0.02em] text-ink md:text-[22px]">
                  {requirement.name || requirement.title || 'Evaluation requirement'}
                </h2>
                <p className="mt-1 text-[13.5px] text-muted">
                  <span className={MONO}>{fields.length}</span>{' '}
                  {fields.length === 1 ? 'field' : 'fields'}
                  {' · '}
                  {scoring ? 'Configuration saved' : 'Not configured yet'}
                </p>
              </div>
            </div>
            <span className={`${BADGE} ${scoring ? BADGE_OPEN : BADGE_CLOSING}`}>
              {scoring ? 'Configured' : 'Draft'}
            </span>
          </section>

          {!isAdmin && (
            <Alert variant="info">
              This is a read-only view. An administrator can update these scoring instructions.
            </Alert>
          )}
          {saveMessage && <Alert variant="success">{saveMessage}</Alert>}
          {errors.form && <Alert variant="danger">{errors.form}</Alert>}

          {fields.length === 0 ? (
            <Alert variant="warning" title="No fields found">
              Add fields to this evaluation requirement before configuring AI scoring.
            </Alert>
          ) : (
            <>
              <section className={`${PANEL} overflow-hidden`}>
                <div className="flex flex-col gap-2 border-b border-hairline px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                  <div>
                    <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">
                      Configuration details
                    </h3>
                    <p className="mt-1 text-[13.5px] text-muted">
                      Name this set of field-level scoring instructions.
                    </p>
                  </div>
                  {scoring?.id ? (
                    <code
                      className={`${MONO} max-w-full truncate rounded-drop border border-hairline bg-raised px-2.5 py-1.5 text-[11.5px] text-muted sm:max-w-[280px]`}
                      title={scoring.id}
                    >
                      {scoring.id}
                    </code>
                  ) : null}
                </div>
                <div className="p-4 sm:p-5 sm:max-w-xl">
                  <Input
                    label="Configuration name"
                    required
                    maxLength={200}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value)
                      setErrors((current) => ({ ...current, name: undefined, form: undefined }))
                    }}
                    error={errors.name}
                    disabled={!isAdmin}
                  />
                </div>
              </section>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink md:text-[24px]">
                    Field scoring prompts
                  </h2>
                  <p className="mt-1 text-[13.5px] text-muted">
                    Each prompt tells the AI what to assess for that submission field.
                  </p>
                </div>
                <span className={`${BADGE} ${BADGE_CLOSED}`}>
                  <span className={`${MONO} mr-1`}>{metrics.length}</span> prompts
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {metrics.map((metric, index) => (
                  <article
                    key={metric.field_key}
                    className={`${PANEL} flex flex-col overflow-hidden transition-[border-color] focus-within:border-volt-edge`}
                  >
                    <div className="flex items-start gap-3 border-b border-hairline bg-raised/50 px-4 py-3.5 sm:px-5">
                      <span
                        className={`${MONO} grid size-9 shrink-0 place-items-center rounded-drop border border-hairline bg-surface text-[12px] font-semibold text-volt`}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-[15.5px] font-semibold tracking-[-0.015em] text-ink">
                          {metric.field_label}
                        </h3>
                        <code className={`${MONO} mt-0.5 block truncate text-[12px] text-muted`}>
                          {metric.field_key}
                        </code>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
                      <Textarea
                        label="Scoring prompt"
                        required
                        value={metric.scoring_prompt}
                        onChange={updateMetric(metric.field_key, 'scoring_prompt')}
                        error={errors[`${metric.field_key}.scoring_prompt`]}
                        placeholder={`Describe how the AI should score ${metric.field_label.toLowerCase()}…`}
                        disabled={!isAdmin}
                        rows={5}
                      />
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Input
                          label="Maximum score"
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          required
                          value={metric.max_score}
                          onChange={updateMetric(metric.field_key, 'max_score')}
                          error={errors[`${metric.field_key}.max_score`]}
                          disabled={!isAdmin}
                        />
                        <Input
                          label="Weight"
                          type="number"
                          min="0"
                          step="any"
                          value={metric.weight}
                          onChange={updateMetric(metric.field_key, 'weight')}
                          error={errors[`${metric.field_key}.weight`]}
                          hint="Optional"
                          placeholder="—"
                          disabled={!isAdmin}
                        />
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {isAdmin && (
                <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 md:left-[264px]">
                  <div className="pointer-events-auto mx-auto w-full max-w-[1480px] px-5 pb-4 md:px-8">
                    <div
                      className={`${PANEL} flex flex-col-reverse gap-3 bg-surface/95 p-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-3.5`}
                    >
                      {scoring ? (
                        <button
                          type="button"
                          className={`${BTN_GHOST} w-full border-transparent text-[#ff8a8a] hover:border-[#5a2222] hover:bg-[#2a1010] sm:w-auto`}
                          onClick={() => setConfirmDelete(true)}
                        >
                          <Icon name="trash" size={17} />
                          Delete configuration
                        </button>
                      ) : (
                        <span className="hidden text-[13px] text-muted sm:inline">
                          Changes apply to this requirement only.
                        </span>
                      )}
                      <Button
                        type="submit"
                        variant="accent"
                        loading={saving}
                        leftIcon={<Icon name="sparkles" size={18} />}
                        className="w-full sm:w-auto sm:min-w-[200px]"
                      >
                        {scoring ? 'Save changes' : 'Create AI scoring'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </form>
      )}

      {(!requirementId || (!loading && !requirement && !loadError)) && (
        <div
          className={`${PANEL} mt-2 flex min-h-[280px] flex-col items-center justify-center border-dashed px-6 py-14 text-center`}
        >
          <span className="mb-4 grid size-14 place-items-center rounded-drop border border-volt-edge bg-volt-tint text-volt">
            <Icon name="sparkles" size={26} />
          </span>
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">
            Choose an evaluation requirement
          </h2>
          <p className="mt-2 max-w-[48ch] text-[14.5px] text-muted">
            Load a requirement to create or review its field-by-field AI scoring prompts.
          </p>
        </div>
      )}

      <Modal
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        title="Delete AI scoring"
        footer={
          <>
            <Button variant="ghost" disabled={deleting} onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={remove}>
              Delete configuration
            </Button>
          </>
        }
      >
        <p>
          Delete <strong>{scoring?.name}</strong>? The evaluation requirement will remain
          unchanged, but its scoring prompts will be removed.
        </p>
      </Modal>
    </div>
  )
}
