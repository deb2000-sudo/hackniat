import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  metricScoringApi,
} from '../api/metricScoring'
import { evaluationRequirementsApi } from '../api/evaluationRequirements'
import { ApiError } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { ROLES } from '../utils/constants'
import PageHeader from '../components/layout/PageHeader'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import Card, { CardBody, CardHeader } from '../components/ui/Card'
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
    <div className="container page metric-scoring-page">
      <PageHeader
        eyebrow="Evaluation setup"
        title="AI metric scoring"
        description={
          isAdmin
            ? 'Define a natural-language scoring instruction for every field in an evaluation requirement.'
            : 'Review the field-level instructions used to score this evaluation requirement.'
        }
      />

      <Card className="metric-scoring-lookup">
        <CardBody>
          <form className="metric-scoring-lookup__form" onSubmit={openRequirement}>
            <Input
              label="Evaluation requirement ID"
              value={requirementIdInput}
              onChange={(event) => {
                setRequirementIdInput(event.target.value)
                setLoadError('')
              }}
              placeholder="Paste the requirement ID"
            />
            <Button
              type="submit"
              variant="secondary"
              leftIcon={<Icon name="search" size={17} />}
            >
              Load requirement
            </Button>
          </form>
        </CardBody>
      </Card>

      {requirementId && loadError && (
        <Alert variant="danger" title="Unable to load requirement">{loadError}</Alert>
      )}
      {requirementId && loading && <LoadingBlock label="Loading requirement and AI scoring…" />}

      {requirementId && !loading && requirement && (
        <form className="stack-lg metric-scoring-form" onSubmit={save} noValidate>
          <div className="metric-scoring-context">
            <div className="metric-scoring-context__icon">
              <Icon name="sparkles" size={22} />
            </div>
            <div>
              <span className="text-xs text-muted">SCORING FOR</span>
              <h2>{requirement.name || requirement.title || 'Evaluation requirement'}</h2>
              <p>
                {fields.length} {fields.length === 1 ? 'field' : 'fields'} ·{' '}
                {scoring ? 'Configuration saved' : 'Not configured yet'}
              </p>
            </div>
            <span className={`metric-scoring-status ${scoring ? 'is-configured' : ''}`}>
              {scoring ? 'Configured' : 'Draft'}
            </span>
          </div>

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
              <Card>
                <CardHeader className="metric-scoring-name-header">
                  <div>
                    <h3>Configuration details</h3>
                    <p>Name this set of field-level scoring instructions.</p>
                  </div>
                  {scoring?.id && <code>{scoring.id}</code>}
                </CardHeader>
                <CardBody>
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
                </CardBody>
              </Card>

              <div className="metric-scoring-fields-heading">
                <div>
                  <h2>Field scoring prompts</h2>
                  <p>Each prompt tells the AI what to assess for that submission field.</p>
                </div>
                <span>{metrics.length} prompts</span>
              </div>

              <div className="metric-scoring-grid">
                {metrics.map((metric, index) => (
                  <Card className="metric-card" key={metric.field_key}>
                    <CardHeader className="metric-card__header">
                      <span className="metric-card__number">{String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <h3>{metric.field_label}</h3>
                        <code>{metric.field_key}</code>
                      </div>
                    </CardHeader>
                    <CardBody className="stack-md">
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
                      <div className="grid grid-2 metric-card__numbers">
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
                    </CardBody>
                  </Card>
                ))}
              </div>

              {isAdmin && (
                <div className="metric-scoring-actions">
                  {scoring && (
                    <Button
                      variant="ghost"
                      className="metric-scoring-delete"
                      leftIcon={<Icon name="trash" size={17} />}
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete configuration
                    </Button>
                  )}
                  <Button
                    type="submit"
                    variant="accent"
                    loading={saving}
                    leftIcon={<Icon name="sparkles" size={18} />}
                  >
                    {scoring ? 'Save changes' : 'Create AI scoring'}
                  </Button>
                </div>
              )}
            </>
          )}
        </form>
      )}

      {(!requirementId || (!loading && !requirement && !loadError)) && (
        <div className="metric-scoring-empty">
          <span><Icon name="sparkles" size={28} /></span>
          <h2>Choose an evaluation requirement</h2>
          <p>Load a requirement to create or review its field-by-field AI scoring prompts.</p>
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
