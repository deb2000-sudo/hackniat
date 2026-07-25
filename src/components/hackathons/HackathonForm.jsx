import { useMemo, useState } from 'react'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Card, { CardBody, CardHeader } from '../ui/Card'
import Icon from '../ui/Icon'
import Input, { Textarea } from '../ui/Input'

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
  guidelines: '',
  prizes: EMPTY_PRIZES,
  timeline: [],
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const SCALAR_FIELDS = ['name', 'description', 'start_date', 'end_date', 'guidelines']

function createInitialForm(initialValue) {
  if (!initialValue) return { ...EMPTY_FORM, prizes: { ...EMPTY_PRIZES }, timeline: [] }
  return {
    name: initialValue.name || '',
    description: initialValue.description || '',
    start_date: initialValue.start_date || '',
    end_date: initialValue.end_date || '',
    guidelines: initialValue.guidelines || '',
    prizes: { ...EMPTY_PRIZES, ...(initialValue.prizes || {}) },
    timeline: (initialValue.timeline || []).map((round) => ({
      title: round.title || '',
      description: round.description || '',
      start_date: round.start_date || '',
      end_date: round.end_date || '',
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

  Object.entries(form.prizes).forEach(([key, value]) => {
    if (!String(value || '').trim()) errors[`prizes.${key}`] = 'Prize details are required'
  })

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

export default function HackathonForm({ initialValue, onSubmit, submitting, submitError }) {
  const editing = !!initialValue
  const initialForm = useMemo(() => createInitialForm(initialValue), [initialValue])
  const [form, setForm] = useState(initialForm)
  const [banner, setBanner] = useState(null)
  const [errors, setErrors] = useState({})

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
        { title: '', description: '', start_date: '', end_date: '' },
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

  const handleSubmit = (event) => {
    event.preventDefault()
    const validation = validate(form, banner)
    setErrors(validation)
    if (Object.keys(validation).length) return

    const cleaned = {
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      guidelines: form.guidelines.trim(),
      prizes: Object.fromEntries(
        Object.entries(form.prizes).map(([key, value]) => [key, value.trim()]),
      ),
      timeline: form.timeline.map((round) => ({
        title: round.title.trim(),
        description: round.description.trim() || null,
        start_date: round.start_date || null,
        end_date: round.end_date || null,
      })),
    }

    if (!editing) {
      onSubmit({
        ...cleaned,
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
    const normalizedInitialTimeline = initialForm.timeline.map((round) => ({
      title: round.title.trim(),
      description: round.description.trim() || null,
      start_date: round.start_date || null,
      end_date: round.end_date || null,
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

      <Card className="hackathon-form-card">
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
        </CardBody>
      </Card>

      <Card className="hackathon-form-card">
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

      <Card className="hackathon-form-card">
        <CardHeader>
          <div className="hackathon-form-heading">
            <span className="hackathon-form-heading__number">03</span>
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
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">No timeline rounds added.</p>
          )}
        </CardBody>
      </Card>

      <Card className="hackathon-form-card">
        <CardHeader>
          <div className="hackathon-form-heading">
            <span className="hackathon-form-heading__number">04</span>
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
                {editing ? 'Choose a new image only to replace the current banner.' : 'JPEG, PNG, WebP, or GIF.'}
              </span>
            )}
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
        <p><Icon name="shield" size={17} /> Changes are securely saved to the hackathon workspace.</p>
        <Button type="submit" variant="accent" size="lg" loading={submitting}>
          {editing ? 'Save changes' : 'Create hackathon'}
        </Button>
      </div>
    </form>
  )
}
