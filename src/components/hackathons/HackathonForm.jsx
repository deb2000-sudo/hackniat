import { useMemo, useState } from 'react'
import { evaluationRequirementsApi } from '../../api/evaluationRequirements'
import { themesApi } from '../../api/themes'
import { useAsync } from '../../hooks/useAsync'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Card, { CardBody, CardHeader } from '../ui/Card'
import Icon from '../ui/Icon'
import Input, { Select, Textarea } from '../ui/Input'

const EMPTY_PRIZES = {
  winner: '',
  first_runner_up: '',
  second_runner_up: '',
}

const EMPTY_FORM = {
  name: '',
  description: '',
  start_date: '',
  end_date: '',
  hackathon_url: '',
  guidelines: '',
  working_demo_video_required: true,
  auto_ai_evaluation: false,
  prizes: EMPTY_PRIZES,
  theme_ids: [],
  timeline: [],
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const SCALAR_FIELDS = ['name', 'description', 'start_date', 'end_date', 'guidelines']
const FORM_STEPS = [
  { label: 'Event details', icon: 'calendar' },
  { label: 'Prizes', icon: 'gift' },
  { label: 'Themes', icon: 'sparkles' },
  { label: 'Timeline', icon: 'clock' },
  { label: 'Banner', icon: 'image' },
]

function createInitialForm(initialValue) {
  if (!initialValue) return { ...EMPTY_FORM, prizes: { ...EMPTY_PRIZES }, timeline: [] }
  return {
    name: initialValue.name || '',
    description: initialValue.description || '',
    start_date: initialValue.start_date || '',
    end_date: initialValue.end_date || '',
    hackathon_url: initialValue.hackathon_url || '',
    guidelines: initialValue.guidelines || '',
    working_demo_video_required: initialValue.working_demo_video_required !== false,
    auto_ai_evaluation: initialValue.auto_ai_evaluation === true,
    prizes: { ...EMPTY_PRIZES, ...(initialValue.prizes || {}) },
    theme_ids: initialValue.theme_ids || initialValue.themes?.map((theme) => theme.id) || [],
    timeline: (initialValue.timeline || []).map((round) => ({
      title: round.title || '',
      description: round.description || '',
      start_date: round.start_date || '',
      end_date: round.end_date || '',
      evaluation_requirement_id: round.evaluation_requirement_id || '',
    })),
  }
}

function validate(form, banner) {
  const errors = {}
  SCALAR_FIELDS.forEach((field) => {
    if (!String(form[field] || '').trim()) errors[field] = 'This field is required'
  })
  if (form.start_date && form.end_date && form.end_date < form.start_date) {
    errors.end_date = 'End date must be on or after the start date'
  }
  if (form.hackathon_url.trim()) {
    try {
      const url = new URL(form.hackathon_url.trim())
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL')
    } catch {
      errors.hackathon_url = 'Enter a complete URL beginning with http:// or https://'
    }
  }

  Object.entries(form.prizes).forEach(([key, value]) => {
    if (!String(value || '').trim()) errors[`prizes.${key}`] = 'Prize details are required'
  })
  if (!form.theme_ids.length) errors.theme_ids = 'Select at least one released theme'

  form.timeline.forEach((round, index) => {
    if (!round.title.trim()) errors[`timeline.${index}.title`] = 'Round title is required'
    if (round.start_date && round.end_date && round.end_date < round.start_date) {
      errors[`timeline.${index}.end_date`] = 'Round end date must be on or after its start date'
    }
  })

  if (banner && !IMAGE_TYPES.includes(banner.type)) {
    errors.banner = 'Choose a JPEG, PNG, WebP, or GIF image'
  }
  return errors
}

function validateStep(form, banner, step) {
  const allErrors = validate(form, banner)
  return Object.fromEntries(
    Object.entries(allErrors).filter(([key]) => {
      if (step === 0) return SCALAR_FIELDS.includes(key)
      if (step === 1) return key.startsWith('prizes.')
      if (step === 2) return key === 'theme_ids'
      if (step === 3) return key.startsWith('timeline.')
      return key === 'banner' || key === 'hackathon_url'
    }),
  )
}

export default function HackathonForm({ initialValue, onSubmit, submitting, submitError }) {
  const editing = !!initialValue
  const initialForm = useMemo(() => createInitialForm(initialValue), [initialValue])
  const [form, setForm] = useState(initialForm)
  const [banner, setBanner] = useState(null)
  const [errors, setErrors] = useState({})
  const [step, setStep] = useState(0)
  const {
    data: requirements,
    loading: requirementsLoading,
    error: requirementsError,
  } = useAsync(() => evaluationRequirementsApi.list())
  const {
    data: themes,
    loading: themesLoading,
    error: themesError,
  } = useAsync(() => themesApi.list())

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }))
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }))
  }

  const updatePrize = (key) => (event) => {
    setForm((current) => ({
      ...current,
      prizes: { ...current.prizes, [key]: event.target.value },
    }))
    setErrors((current) => ({ ...current, [`prizes.${key}`]: undefined, form: undefined }))
  }

  const addRound = () => {
    setForm((current) => ({
      ...current,
      timeline: [
        ...current.timeline,
        {
          title: '',
          description: '',
          start_date: '',
          end_date: '',
          evaluation_requirement_id: '',
        },
      ],
    }))
  }

  const updateRound = (index, key) => (event) => {
    setForm((current) => ({
      ...current,
      timeline: current.timeline.map((round, roundIndex) =>
        roundIndex === index ? { ...round, [key]: event.target.value } : round,
      ),
    }))
    setErrors((current) => ({
      ...current,
      [`timeline.${index}.${key}`]: undefined,
      form: undefined,
    }))
  }

  const removeRound = (index) => {
    setForm((current) => ({
      ...current,
      timeline: current.timeline.filter((_, roundIndex) => roundIndex !== index),
    }))
  }

  const toggleTheme = (themeId) => {
    setForm((current) => ({
      ...current,
      theme_ids: current.theme_ids.includes(themeId)
        ? current.theme_ids.filter((id) => id !== themeId)
        : [...current.theme_ids, themeId],
    }))
    setErrors((current) => ({ ...current, theme_ids: undefined, form: undefined }))
  }

  const moveToStep = (nextStep) => {
    setStep(nextStep)
    setErrors({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const continueToNextStep = () => {
    const validation = validateStep(form, banner, step)
    setErrors(validation)
    if (Object.keys(validation).length) return
    moveToStep(Math.min(step + 1, FORM_STEPS.length - 1))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (step < FORM_STEPS.length - 1) {
      continueToNextStep()
      return
    }
    const validation = validate(form, banner)
    setErrors(validation)
    if (Object.keys(validation).length) return

    const cleaned = {
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      hackathon_url: form.hackathon_url.trim(),
      guidelines: form.guidelines.trim(),
      working_demo_video_required: form.working_demo_video_required ? 'true' : 'false',
      auto_ai_evaluation: form.auto_ai_evaluation ? 'true' : 'false',
      prizes: Object.fromEntries(
        Object.entries(form.prizes).map(([key, value]) => [key, value.trim()]),
      ),
      timeline: form.timeline.map((round) => ({
        title: round.title.trim(),
        description: round.description.trim() || null,
        start_date: round.start_date || null,
        end_date: round.end_date || null,
        evaluation_requirement_id: round.evaluation_requirement_id || null,
      })),
    }

    if (!editing) {
      onSubmit({
        ...cleaned,
        hackathon_url: cleaned.hackathon_url || undefined,
        timeline: cleaned.timeline.length ? cleaned.timeline : undefined,
        banner: banner || undefined,
      })
      return
    }

    const changes = {}
    SCALAR_FIELDS.forEach((field) => {
      if (cleaned[field] !== initialForm[field]) changes[field] = cleaned[field]
    })
    if (JSON.stringify(cleaned.prizes) !== JSON.stringify(initialForm.prizes)) {
      changes.prizes = cleaned.prizes
    }
    if (JSON.stringify(cleaned.theme_ids) !== JSON.stringify(initialForm.theme_ids)) {
      changes.theme_ids = cleaned.theme_ids
    }
    if (cleaned.hackathon_url !== initialForm.hackathon_url.trim()) {
      changes.hackathon_url = cleaned.hackathon_url
    }
    if (
      Boolean(form.working_demo_video_required) !==
      Boolean(initialForm.working_demo_video_required)
    ) {
      changes.working_demo_video_required = cleaned.working_demo_video_required
    }
    if (Boolean(form.auto_ai_evaluation) !== Boolean(initialForm.auto_ai_evaluation)) {
      changes.auto_ai_evaluation = cleaned.auto_ai_evaluation
    }
    const normalizedInitialTimeline = initialForm.timeline.map((round) => ({
      title: round.title.trim(),
      description: round.description.trim() || null,
      start_date: round.start_date || null,
      end_date: round.end_date || null,
      evaluation_requirement_id: round.evaluation_requirement_id || null,
    }))
    if (JSON.stringify(cleaned.timeline) !== JSON.stringify(normalizedInitialTimeline)) {
      changes.timeline = cleaned.timeline
    }
    if (banner) changes.banner = banner

    if (!Object.keys(changes).length) {
      setErrors({ form: 'Make at least one change before saving.' })
      return
    }
    onSubmit(changes)
  }

  return (
    <form className="stack-lg" onSubmit={handleSubmit} noValidate>
      {(submitError || errors.form) && (
        <Alert variant="danger">{submitError || errors.form}</Alert>
      )}

      <ol className="hackathon-form-stepper" aria-label="Hackathon creation progress">
        {FORM_STEPS.map((item, index) => {
          const completed = index < step && !Object.keys(validateStep(form, banner, index)).length
          return (
            <li
              className={`${index === step ? 'is-active' : ''} ${completed ? 'is-complete' : ''}`}
              key={item.label}
            >
              <button
                type="button"
                onClick={() => index <= step && moveToStep(index)}
                disabled={index > step}
                aria-current={index === step ? 'step' : undefined}
              >
                <span>{completed ? <Icon name="check" size={16} /> : <Icon name={item.icon} size={16} />}</span>
                <small>Step {index + 1}</small>
                <strong>{item.label}</strong>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="hackathon-wizard-status">
        <span>{String(step + 1).padStart(2, '0')}</span>
        <div>
          <small>Current section</small>
          <strong>{FORM_STEPS[step].label}</strong>
        </div>
        <em>{Math.round(((step + 1) / FORM_STEPS.length) * 100)}% complete</em>
      </div>

      <Card className={`hackathon-form-card ${step !== 0 ? 'wizard-step-hidden' : ''}`}>
        <CardHeader>
          <div className="hackathon-form-heading">
            <span className="hackathon-form-heading__number">01</span>
            <div><h3>Event information</h3><p>Define the hackathon identity, schedule, and participation rules.</p></div>
          </div>
          <span className="hackathon-form-heading__icon"><Icon name="calendar" size={20} /></span>
        </CardHeader>
        <CardBody className="stack-md">
          <Input
            label="Name"
            required
            maxLength={200}
            value={form.name}
            onChange={update('name')}
            error={errors.name}
          />
          <Textarea
            label="Description"
            required
            maxLength={10000}
            value={form.description}
            onChange={update('description')}
            error={errors.description}
          />
          <div className="grid grid-2">
            <Input
              label="Start date"
              type="date"
              required
              value={form.start_date}
              onChange={update('start_date')}
              error={errors.start_date}
            />
            <Input
              label="End date"
              type="date"
              min={form.start_date || undefined}
              required
              value={form.end_date}
              onChange={update('end_date')}
              error={errors.end_date}
            />
          </div>
          <Textarea
            label="Guidelines"
            hint="Markdown formatting is supported on the detail page."
            required
            maxLength={10000}
            value={form.guidelines}
            onChange={update('guidelines')}
            error={errors.guidelines}
            style={{ minHeight: 180 }}
          />
          <label className="hackathon-video-toggle">
            <input
              type="checkbox"
              checked={form.working_demo_video_required}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  working_demo_video_required: event.target.checked,
                }))
              }
            />
            <span>
              <strong>Working demo video required</strong>
              <small>
                When enabled, students must record or upload a demo. Turn off to allow
                text-only submissions.
              </small>
            </span>
          </label>
          <label className="hackathon-video-toggle">
            <input
              type="checkbox"
              checked={form.auto_ai_evaluation}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  auto_ai_evaluation: event.target.checked,
                }))
              }
            />
            <span>
              <strong>Auto AI evaluation on assign</strong>
              <small>
                When enabled, AI analysis starts automatically after assignment. When off,
                evaluators trigger AI Evaluation manually.
              </small>
            </span>
          </label>
        </CardBody>
      </Card>

      <Card className={`hackathon-form-card ${step !== 1 ? 'wizard-step-hidden' : ''}`}>
        <CardHeader>
          <div className="hackathon-form-heading">
            <span className="hackathon-form-heading__number">02</span>
            <div><h3>Prize structure</h3><p>Showcase the rewards available to the top three teams.</p></div>
          </div>
          <span className="hackathon-form-heading__icon"><Icon name="gift" size={20} /></span>
        </CardHeader>
        <CardBody className="grid grid-3">
          <Input
            label="Winner"
            placeholder="₹1,00,000"
            required
            maxLength={500}
            value={form.prizes.winner}
            onChange={updatePrize('winner')}
            error={errors['prizes.winner']}
          />
          <Input
            label="First runner-up"
            placeholder="₹50,000"
            required
            maxLength={500}
            value={form.prizes.first_runner_up}
            onChange={updatePrize('first_runner_up')}
            error={errors['prizes.first_runner_up']}
          />
          <Input
            label="Second runner-up"
            placeholder="₹25,000"
            required
            maxLength={500}
            value={form.prizes.second_runner_up}
            onChange={updatePrize('second_runner_up')}
            error={errors['prizes.second_runner_up']}
          />
        </CardBody>
      </Card>

      <Card className={`hackathon-form-card ${step !== 2 ? 'wizard-step-hidden' : ''}`}>
        <CardHeader>
          <div className="hackathon-form-heading">
            <span className="hackathon-form-heading__number">03</span>
            <div><h3>Released themes</h3><p>Select the themes students can choose for this hackathon.</p></div>
          </div>
          <span className="hackathon-form-heading__icon"><Icon name="sparkles" size={20} /></span>
        </CardHeader>
        <CardBody className="stack-md">
          {themesLoading ? (
            <p className="text-sm text-muted">Loading themes…</p>
          ) : themesError ? (
            <Alert variant="danger">Themes could not be loaded: {themesError.message}</Alert>
          ) : themes?.length ? (
            <div className="hackathon-theme-picker">
              {themes.map((theme) => {
                const selected = form.theme_ids.includes(theme.id)
                return (
                  <label className={`hackathon-theme-option ${selected ? 'is-selected' : ''}`} key={theme.id}>
                    <input type="checkbox" checked={selected} onChange={() => toggleTheme(theme.id)} />
                    <span><Icon name={selected ? 'checkCircle' : 'sparkles'} size={19} /></span>
                    <div><strong>{theme.name}</strong></div>
                  </label>
                )
              })}
            </div>
          ) : (
            <Alert variant="warning">Create themes from the Admin Themes screen before publishing this hackathon.</Alert>
          )}
          {errors.theme_ids && <span className="field__error">{errors.theme_ids}</span>}
        </CardBody>
      </Card>

      <Card className={`hackathon-form-card ${step !== 3 ? 'wizard-step-hidden' : ''}`}>
        <CardHeader>
          <div className="hackathon-form-heading">
            <span className="hackathon-form-heading__number">04</span>
            <div>
              <h3>Competition timeline</h3>
              <p>Optional — add each round or milestone in chronological order.</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={addRound}
            leftIcon={<Icon name="plus" size={16} />}
          >
            Add round
          </Button>
        </CardHeader>
        <CardBody className="stack-md">
          {form.timeline.length ? (
            form.timeline.map((round, index) => (
              <div className="timeline-round-editor" key={index}>
                <div className="row-between">
                  <strong>Round {index + 1}</strong>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => removeRound(index)}
                    aria-label={`Remove round ${index + 1}`}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
                <Input
                  label="Title"
                  required
                  maxLength={100}
                  value={round.title}
                  onChange={updateRound(index, 'title')}
                  error={errors[`timeline.${index}.title`]}
                />
                <Textarea
                  label="Description"
                  maxLength={2000}
                  value={round.description}
                  onChange={updateRound(index, 'description')}
                />
                <div className="grid grid-2">
                  <Input
                    label="Start date"
                    type="date"
                    value={round.start_date}
                    onChange={updateRound(index, 'start_date')}
                  />
                  <Input
                    label="End date"
                    type="date"
                    min={round.start_date || undefined}
                    value={round.end_date}
                    onChange={updateRound(index, 'end_date')}
                    error={errors[`timeline.${index}.end_date`]}
                  />
                </div>
                <Select
                  label="Evaluation requirement"
                  value={round.evaluation_requirement_id}
                  onChange={updateRound(index, 'evaluation_requirement_id')}
                  hint={
                    requirementsError
                      ? 'Requirements could not be loaded. You can save this round without one.'
                      : 'Optional. Students will use this field set for the round.'
                  }
                  disabled={requirementsLoading}
                >
                  <option value="">
                    {requirementsLoading ? 'Loading requirements…' : 'No requirement'}
                  </option>
                  {(requirements || []).map((requirement) => (
                    <option value={requirement.id} key={requirement.id}>
                      {requirement.name} ({requirement.fields?.length || 0} fields)
                    </option>
                  ))}
                </Select>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">No timeline rounds added.</p>
          )}
        </CardBody>
      </Card>

      <Card className={`hackathon-form-card ${step !== 4 ? 'wizard-step-hidden' : ''}`}>
        <CardHeader>
          <div className="hackathon-form-heading">
            <span className="hackathon-form-heading__number">05</span>
            <div><h3>Event banner</h3><p>Add a high-quality visual for cards and the event header.</p></div>
          </div>
          <span className="hackathon-form-heading__icon"><Icon name="image" size={20} /></span>
        </CardHeader>
        <CardBody className="stack-md">
          {initialValue?.banner_url && !banner && (
            <img
              className="hackathon-banner-preview"
              src={initialValue.banner_url}
              alt={`${initialValue.name} banner`}
            />
          )}
          <div className="grid grid-2 hackathon-banner-fields">
            <div className="field">
              <label className="label" htmlFor="hackathon-banner">Banner image</label>
              <input
                id="hackathon-banner"
                className={`input ${errors.banner ? 'input--error' : ''}`}
                type="file"
                accept={IMAGE_TYPES.join(',')}
                onChange={(event) => {
                  const file = event.target.files?.[0] || null
                  setBanner(file)
                  setErrors((current) => ({ ...current, banner: undefined, form: undefined }))
                }}
              />
              {errors.banner ? (
                <span className="field__error">{errors.banner}</span>
              ) : (
                <span className="field__hint">
                  {editing ? 'Choose a new image only to replace the current banner.' : 'Optional · JPEG, PNG, WebP, or GIF.'}
                </span>
              )}
            </div>
            <Input
              label="Hackathon URL"
              type="url"
              maxLength={2000}
              placeholder="https://drop.example.com"
              hint="Optional · Official website"
              value={form.hackathon_url}
              onChange={update('hackathon_url')}
              error={errors.hackathon_url}
            />
          </div>
          {banner && (
            <div className="selected-file-row">
              <span><Icon name="checkCircle" size={18} /></span>
              <div><strong>{banner.name}</strong><small>Ready to upload</small></div>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="hackathon-form-actions">
        {step > 0 ? (
          <Button
            variant="ghost"
            onClick={() => moveToStep(step - 1)}
            leftIcon={<Icon name="arrowLeft" size={17} />}
          >
            Back
          </Button>
        ) : (
          <p><Icon name="shield" size={17} /> Complete each section to continue.</p>
        )}
        {step < FORM_STEPS.length - 1 ? (
          <Button
            variant="accent"
            size="lg"
            onClick={continueToNextStep}
            rightIcon={<Icon name="arrowRight" size={17} />}
          >
            Save and continue
          </Button>
        ) : (
          <Button type="submit" variant="accent" size="lg" loading={submitting}>
            {editing ? 'Save changes' : 'Create hackathon'}
          </Button>
        )}
      </div>
    </form>
  )
}
