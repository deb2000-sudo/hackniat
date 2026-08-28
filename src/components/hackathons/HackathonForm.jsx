import { useEffect, useMemo, useRef, useState } from 'react'
import { evaluationRequirementsApi } from '../../api/evaluationRequirements'
import { themesApi } from '../../api/themes'
import { useAsync } from '../../hooks/useAsync'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Card, { CardBody, CardHeader } from '../ui/Card'
import Icon from '../ui/Icon'
import Input, { Select, Textarea } from '../ui/Input'
import { hackathonsApi } from '../../api/hackathons'
import { draftErrorStep, participationErrorMessage } from './errorCodes'
import {
  DRAFT_STEPS,
  draftStepFields,
  draftStepIndex,
  withStepCompleted,
} from './draftSteps'
import { roundStatusBadge } from './roundStatus'
import { BADGE } from '../drop/theme'

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
  evaluator_guidelines: '',
  working_demo_video_required: true,
  auto_ai_evaluation: false,
  prizes: EMPTY_PRIZES,
  theme_ids: [],
  timeline: [],
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const SCALAR_FIELDS = ['name', 'description', 'start_date', 'end_date', 'guidelines']
const PATCH_SCALAR_FIELDS = [...SCALAR_FIELDS, 'evaluator_guidelines']
const FORM_STEPS = DRAFT_STEPS
const REVIEW_INDEX = FORM_STEPS.length - 1
const BASICS_FIELDS = ['name', 'description', 'start_date', 'end_date', 'hackathon_url']
const GUIDELINE_FIELDS = ['guidelines', 'evaluator_guidelines']
const TEAM_SIZE_OPTIONS = [
  { value: '1', label: 'Solo' },
  { value: '2', label: '2 Members' },
  { value: '3', label: '3 Members' },
  { value: '4', label: '4 Members' },
]
// Round 1 is the hackathon itself, so it is always present and cannot be
// removed. Everything from round 2 onwards is optional and deletable.
const REQUIRED_ROUNDS = 1

function emptyRound() {
  return {
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    evaluation_requirement_id: '',
    max_team_size: '1',
    working_demo_video_required: true,
    auto_ai_evaluation: false,
    github_ai_evaluation: false,
    published: false,
    round_status: '',
  }
}

function createInitialForm(initialValue) {
  if (!initialValue) {
    return {
      ...EMPTY_FORM,
      prizes: { ...EMPTY_PRIZES },
      timeline: [emptyRound()],
    }
  }
  return {
    name: initialValue.name || '',
    description: initialValue.description || '',
    start_date: initialValue.start_date || '',
    end_date: initialValue.end_date || '',
    hackathon_url: initialValue.hackathon_url || '',
    guidelines: initialValue.guidelines || '',
    evaluator_guidelines: initialValue.evaluator_guidelines || '',
    working_demo_video_required: initialValue.working_demo_video_required !== false,
    auto_ai_evaluation: initialValue.auto_ai_evaluation === true,
    prizes: { ...EMPTY_PRIZES, ...(initialValue.prizes || {}) },
    theme_ids: initialValue.theme_ids || initialValue.themes?.map((theme) => theme.id) || [],
    timeline: clampTimelineDates(
      (initialValue.timeline?.length ? initialValue.timeline : [emptyRound()]).map((round) => ({
        title: round.title || '',
        description: round.description || '',
        start_date: round.start_date || '',
        end_date: round.end_date || '',
        evaluation_requirement_id: round.evaluation_requirement_id || '',
        // Backward compatibility: rounds saved before per-round settings
        // existed inherit the hackathon-level flags.
        max_team_size: String(round.max_team_size || initialValue.max_team_size || 1),
        published: round.published === true,
        round_status: round.round_status || '',
        working_demo_video_required:
          round.working_demo_video_required ?? initialValue.working_demo_video_required !== false,
        auto_ai_evaluation: round.auto_ai_evaluation ?? initialValue.auto_ai_evaluation === true,
        github_ai_evaluation:
          round.github_ai_evaluation ?? initialValue.github_ai_evaluation === true,
      })),
      initialValue.start_date || '',
      initialValue.end_date || '',
    ),
  }
}

function clampDate(value, min, max) {
  if (!value) return value
  if (min && value < min) return min
  if (max && value > max) return max
  return value
}

function normalizeRoundDates(round, hackathonStart, hackathonEnd) {
  if (!hackathonStart || !hackathonEnd) return round
  let start_date = round.start_date
  let end_date = round.end_date
  if (start_date) start_date = clampDate(start_date, hackathonStart, hackathonEnd)
  if (end_date) end_date = clampDate(end_date, hackathonStart, hackathonEnd)
  if (start_date && end_date && end_date < start_date) end_date = start_date
  return { ...round, start_date, end_date }
}

function clampTimelineDates(timeline, hackathonStart, hackathonEnd) {
  return timeline.map((round) => normalizeRoundDates(round, hackathonStart, hackathonEnd))
}

function validate(form, banner, { editing = false, initialForm = null } = {}) {
  const errors = {}
  SCALAR_FIELDS.forEach((field) => {
    if (!String(form[field] || '').trim()) errors[field] = 'This field is required'
  })
  const needsEvaluatorGuidelines =
    !editing || !String(initialForm?.evaluator_guidelines || '').trim()
  if (needsEvaluatorGuidelines && !String(form.evaluator_guidelines || '').trim()) {
    errors.evaluator_guidelines = 'This field is required'
  }
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
    if (form.start_date && form.end_date) {
      if (round.start_date && round.start_date < form.start_date) {
        errors[`timeline.${index}.start_date`] =
          'Round start must be on or after the hackathon start date'
      }
      if (round.start_date && round.start_date > form.end_date) {
        errors[`timeline.${index}.start_date`] =
          'Round start must be on or before the hackathon end date'
      }
      if (round.end_date && round.end_date > form.end_date) {
        errors[`timeline.${index}.end_date`] =
          'Round end must be on or before the hackathon end date'
      }
      if (round.end_date && round.end_date < form.start_date) {
        errors[`timeline.${index}.end_date`] =
          'Round end must be on or after the hackathon start date'
      }
    }
  })

  if (banner && !IMAGE_TYPES.includes(banner.type)) {
    errors.banner = 'Choose a JPEG, PNG, WebP, or GIF image'
  }
  return errors
}

/**
 * Every required input on the form, as filled / not-filled booleans.
 *
 * Deliberately ignores the optional fields (banner, hackathon URL): counting
 * them would let an untouched form claim progress for work nobody has to do.
 */
function completionChecks(form, { editing = false, initialForm = null } = {}) {
  const checks = SCALAR_FIELDS.map((field) => Boolean(String(form[field] || '').trim()))

  const needsEvaluatorGuidelines =
    !editing || !String(initialForm?.evaluator_guidelines || '').trim()
  if (needsEvaluatorGuidelines) {
    checks.push(Boolean(String(form.evaluator_guidelines || '').trim()))
  }

  Object.values(form.prizes).forEach((value) => checks.push(Boolean(String(value || '').trim())))
  checks.push(form.theme_ids.length > 0)
  form.timeline.forEach((round) => checks.push(Boolean(String(round.title || '').trim())))

  return checks
}

/**
 * Share of the required form that is actually filled in.
 *
 * This used to be (step + 1) / stepCount, which measured where the user was
 * standing rather than what they had done — a brand-new form opened claiming
 * "20% complete" before a single character was typed.
 */
function completionPercent(form, options) {
  const checks = completionChecks(form, options)
  if (!checks.length) return 0
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

/** Trim and normalise every field to the shape the API expects. */
function cleanForm(form) {
  return {
    ...form,
    name: form.name.trim(),
    description: form.description.trim(),
    hackathon_url: form.hackathon_url.trim(),
    guidelines: form.guidelines.trim(),
    evaluator_guidelines: form.evaluator_guidelines.trim(),

    prizes: Object.fromEntries(
      Object.entries(form.prizes).map(([key, value]) => [key, value.trim()]),
    ),
    timeline: form.timeline.map((round) => ({
      title: round.title.trim(),
      description: round.description.trim() || null,
      start_date: round.start_date || null,
      end_date: round.end_date || null,
      evaluation_requirement_id: round.evaluation_requirement_id || null,
      max_team_size: Number(round.max_team_size || 1),
      working_demo_video_required: round.working_demo_video_required !== false,
      auto_ai_evaluation: round.auto_ai_evaluation === true,
      github_ai_evaluation: round.github_ai_evaluation === true,
    })),
  }
}

/** Body for PATCH /hackathons/drafts/{id} — only this section's own fields. */
function draftPatch(stepKey, form) {
  const cleaned = cleanForm(form)
  return Object.fromEntries(draftStepFields(stepKey).map((field) => [field, cleaned[field]]))
}

/** Which section an error belongs to, by wizard index. */
function errorBelongsToStep(key, step) {
  if (step === 0) return BASICS_FIELDS.includes(key)
  if (step === 1) return GUIDELINE_FIELDS.includes(key)
  if (step === 2) return key === 'theme_ids'
  if (step === 3) return key.startsWith('timeline.')
  if (step === 4) return key.startsWith('prizes.')
  if (step === 5) return key === 'banner'
  return true
}

function validateStep(form, banner, step, options = {}) {
  const allErrors = validate(form, banner, options)
  return Object.fromEntries(
    Object.entries(allErrors).filter(([key]) => errorBelongsToStep(key, step)),
  )
}

/** First section holding an outstanding error — where publish should land. */
function firstStepWithError(errors) {
  const keys = Object.keys(errors || {})
  if (!keys.length) return -1
  for (let index = 0; index < FORM_STEPS.length; index += 1) {
    if (keys.some((key) => errorBelongsToStep(key, index) && index !== REVIEW_INDEX)) return index
  }
  return -1
}

export default function HackathonForm({
  initialValue,
  onSubmit,
  submitting,
  submitError,
  /* Draft mode: the wizard persists each section as it goes and finishes with
     publish, instead of holding everything in memory until one final POST. */
  draftId = '',
  initialStep = '',
  initialCompletedSteps,
  onSaveStep,
  onPublish,
  onDiscard,
}) {
  // Opt out of the React Compiler for this component. The footer's
  // "Save and continue" / "Create hackathon" button occupies the same JSX
  // position across a step change, and this component has enough
  // conditional state (5 steps, dynamic validation) that a memoization
  // mismatch here would let a stale render of that button survive into the
  // next step — silently submitting the form instead of just advancing.
  'use no memo'
  const draftMode = Boolean(draftId)
  const editing = !!initialValue && !draftMode
  const initialForm = useMemo(() => createInitialForm(initialValue), [initialValue])
  const validationOptions = useMemo(() => ({ editing, initialForm }), [editing, initialForm])
  const missingEvaluatorGuidelines =
    editing && !String(initialForm.evaluator_guidelines || '').trim()
  const [form, setForm] = useState(initialForm)
  const [banner, setBanner] = useState(null)
  const [errors, setErrors] = useState({})
  const [step, setStep] = useState(() => draftStepIndex(initialStep))
  /** Always-current step for form onSubmit — avoids a race where Enter/submit
   *  fires after a "Save and continue" click has already advanced the step. */
  const stepRef = useRef(draftStepIndex(initialStep))
  const [completedSteps, setCompletedSteps] = useState(() => initialCompletedSteps || [])
  const [savingStep, setSavingStep] = useState(false)
  const [stepError, setStepError] = useState('')
  const [discarding, setDiscarding] = useState(false)
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
    setForm((current) => {
      const next = { ...current, [key]: event.target.value }
      if (key === 'start_date' || key === 'end_date') {
        next.timeline = clampTimelineDates(next.timeline, next.start_date, next.end_date)
      }
      return next
    })
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }))
  }

  const updatePrize = (key) => (event) => {
    setForm((current) => ({
      ...current,
      prizes: { ...current.prizes, [key]: event.target.value },
    }))
    setErrors((current) => ({ ...current, [`prizes.${key}`]: undefined, form: undefined }))
  }

  /**
   * Append a round. The button sits below a long list of fields, so adding one
   * silently appended a row far off screen with no sign anything happened —
   * hence the confirmation and the jump to the new row's first field.
   */
  const addRound = () => {
    const nextIndex = form.timeline.length
    pendingRoundFocus.current = nextIndex
    setRoundNotice(`Round ${nextIndex + 1} added.`)
    setForm((current) => ({
      ...current,
      timeline: [...current.timeline, emptyRound()],
    }))
  }

  const [publishing, setPublishing] = useState('')
  const [publishError, setPublishError] = useState('')
  const [roundNotice, setRoundNotice] = useState('')
  /** Index of a just-added round awaiting focus; -1 when there is none. */
  const pendingRoundFocus = useRef(-1)

  // Focus and reveal the round that was just appended, once it is in the DOM.
  // Removing a round also changes the length, but leaves the ref at -1.
  useEffect(() => {
    const index = pendingRoundFocus.current
    if (index < 0) return
    pendingRoundFocus.current = -1
    const field = document.getElementById(`round-title-${index}`)
    if (!field) return
    field.focus({ preventScroll: true })
    field.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [form.timeline.length])

  useEffect(() => {
    if (!roundNotice) return undefined
    const id = setTimeout(() => setRoundNotice(''), 4000)
    return () => clearTimeout(id)
  }, [roundNotice])

  const publishRound = async (index) => {
    if (!initialValue?.id) return
    setPublishing(String(index))
    setPublishError('')
    try {
      const updated = await hackathonsApi.publishRound(initialValue.id, index)
      setForm((current) => ({
        ...current,
        timeline: current.timeline.map((round, roundIndex) =>
          roundIndex === index
            ? {
                ...round,
                published: true,
                round_status: updated?.round_status || round.round_status || 'scheduled',
              }
            : round,
        ),
      }))
    } catch (err) {
      // ALREADY_PUBLISHED / ROUND_ENDED both land here.
      setPublishError(participationErrorMessage(err, 'Could not publish this round.'))
    } finally {
      setPublishing('')
    }
  }

  const updateRoundFlag = (index, key) => (event) => {
    const { checked } = event.target
    setForm((current) => ({
      ...current,
      timeline: current.timeline.map((round, roundIndex) =>
        roundIndex === index ? { ...round, [key]: checked } : round,
      ),
    }))
  }

  const updateRound = (index, key) => (event) => {
    setForm((current) => ({
      ...current,
      timeline: current.timeline.map((round, roundIndex) => {
        if (roundIndex !== index) return round
        return normalizeRoundDates(
          { ...round, [key]: event.target.value },
          current.start_date,
          current.end_date,
        )
      }),
    }))
    setErrors((current) => ({
      ...current,
      [`timeline.${index}.${key}`]: undefined,
      form: undefined,
    }))
  }

  const removeRound = (index) => {
    if (!editing && index < REQUIRED_ROUNDS) return
    setForm((current) => ({
      ...current,
      timeline: current.timeline.filter((_, roundIndex) => roundIndex !== index),
    }))
  }

  const canRemoveRound = (index) => editing || index >= REQUIRED_ROUNDS

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
    stepRef.current = nextStep
    setStep(nextStep)
    setErrors({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const continueToNextStep = async (event) => {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    const current = stepRef.current
    const nextIndex = Math.min(current + 1, REVIEW_INDEX)

    // Editing a live hackathon still gates every section. A draft is allowed to
    // be half-written — it saves whatever is there and lets publish run the
    // strict pass — so blocking here would contradict the whole point of it.
    if (!draftMode) {
      const validation = validateStep(form, banner, current, validationOptions)
      setErrors(validation)
      if (Object.keys(validation).length) return
      moveToStep(nextIndex)
      return
    }

    const stepKey = FORM_STEPS[current].key
    const nextCompleted = withStepCompleted(completedSteps, stepKey)
    setSavingStep(true)
    setStepError('')
    try {
      await onSaveStep?.({
        stepKey,
        patch: draftPatch(stepKey, form),
        currentStep: FORM_STEPS[nextIndex].key,
        completedSteps: nextCompleted,
        banner,
      })
      setCompletedSteps(nextCompleted)
      moveToStep(nextIndex)
    } catch (err) {
      setStepError(err.message || 'Could not save this section. Try again.')
    } finally {
      setSavingStep(false)
    }
  }

  const publishDraft = async (event) => {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    // Check locally first so gaps land as inline field errors on the section
    // that owns them, rather than as one opaque message from the server.
    const validation = validate(form, banner, validationOptions)
    setErrors(validation)
    const incompleteStep = firstStepWithError(validation)
    if (incompleteStep !== -1) {
      setStepError(
        `${FORM_STEPS[incompleteStep].label} is incomplete. Finish it before publishing.`,
      )
      moveToStep(incompleteStep)
      return
    }

    setSavingStep(true)
    setStepError('')
    try {
      await onPublish?.()
    } catch (err) {
      const blamed = draftErrorStep(err)
      if (blamed) moveToStep(draftStepIndex(blamed))
      setStepError(err.message || 'The draft could not be published.')
    } finally {
      setSavingStep(false)
    }
  }

  const discardDraft = async () => {
    setStepError('')
    setDiscarding(true)
    try {
      await onDiscard?.()
    } catch (err) {
      setStepError(err.message || 'Could not discard this draft.')
      setDiscarding(false)
    }
  }

  const submitForm = (event) => {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    if (stepRef.current < FORM_STEPS.length - 1) return
    const validation = validate(form, banner, validationOptions)
    setErrors(validation)
    if (Object.keys(validation).length) return

    const cleaned = cleanForm(form)

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
    PATCH_SCALAR_FIELDS.forEach((field) => {
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

  /* Enter in a field may submit the form — only advance steps, never create. */
  const handleSubmit = (event) => {
    event.preventDefault()
    if (stepRef.current < FORM_STEPS.length - 1) {
      continueToNextStep(event)
    }
  }

  return (
    <form className="stack-lg" onSubmit={handleSubmit} noValidate>
      {(submitError || errors.form || stepError) && (
        <Alert variant="danger">{submitError || errors.form || stepError}</Alert>
      )}

      <ol className="hackathon-form-stepper" aria-label="Hackathon creation progress">
        {FORM_STEPS.map((item, index) => {
          const completed =
            index < step && !Object.keys(validateStep(form, banner, index, validationOptions)).length
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
        <em>{completionPercent(form, validationOptions)}% complete</em>
      </div>

      <Card className={`hackathon-form-card ${step !== 0 ? 'wizard-step-hidden' : ''}`}>
        <CardHeader>
          <div className="hackathon-form-heading">
            <span className="hackathon-form-heading__number">01</span>
            <div><h3>Event information</h3><p>Define the hackathon identity and schedule.</p></div>
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
          <Input
            label="Hackathon URL"
            type="url"
            maxLength={2000}
            hint="Optional · Official website"
            placeholder="https://drop.example.com"
            value={form.hackathon_url}
            onChange={update('hackathon_url')}
            error={errors.hackathon_url}
          />
        </CardBody>
      </Card>

      <Card className={`hackathon-form-card ${step !== 1 ? 'wizard-step-hidden' : ''}`}>
        <CardHeader>
          <div className="hackathon-form-heading">
            <span className="hackathon-form-heading__number">02</span>
            <div><h3>Guidelines</h3><p>Tell students how to take part, and evaluators how to judge.</p></div>
          </div>
          <span className="hackathon-form-heading__icon"><Icon name="shield" size={20} /></span>
        </CardHeader>
        <CardBody className="stack-md">
          {missingEvaluatorGuidelines && (
            <Alert variant="warning" title="Evaluator guidelines missing">
              This hackathon was saved before evaluator guidelines existed. Add them below and
              save once so evaluators can review submissions with the right context.
            </Alert>
          )}
          <Textarea
            label="Participation guidelines"
            hint="Shown to students. Markdown formatting is supported on the detail page."
            required
            maxLength={10000}
            value={form.guidelines}
            onChange={update('guidelines')}
            error={errors.guidelines}
            style={{ minHeight: 180 }}
          />
          <Textarea
            label="Evaluator guidelines"
            hint="Shown to evaluators when they review submissions."
            required={!editing || missingEvaluatorGuidelines}
            maxLength={10000}
            value={form.evaluator_guidelines}
            onChange={update('evaluator_guidelines')}
            error={errors.evaluator_guidelines}
            style={{ minHeight: 180 }}
          />
        </CardBody>
      </Card>

      <Card className={`hackathon-form-card ${step !== 4 ? 'wizard-step-hidden' : ''}`}>
        <CardHeader>
          <div className="hackathon-form-heading">
            <span className="hackathon-form-heading__number">05</span>
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
              <p>
                {editing
                  ? 'Add each round or milestone in chronological order.'
                  : 'Configure two competition rounds (required).'}
                {form.start_date && form.end_date
                  ? ` Round dates must fall between ${form.start_date} and ${form.end_date}.`
                  : ' Set hackathon dates in step 1 first.'}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardBody className="stack-md">
          {publishError && <Alert variant="danger">{publishError}</Alert>}
          {form.timeline.length ? (
            form.timeline.map((round, index) => (
              <div className="timeline-round-editor" key={index}>
                <div className="row-between">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong>Round {index + 1}</strong>
                    {/* Publish state only exists for a saved hackathon. */}
                    {editing && (
                      <span className={`${BADGE} ${roundStatusBadge(round).tone}`}>
                        {round.published ? roundStatusBadge(round).label : 'Draft'}
                      </span>
                    )}
                    {editing && !round.published && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        loading={publishing === String(index)}
                        onClick={() => publishRound(index)}
                      >
                        Publish
                      </Button>
                    )}
                  </span>
                  {canRemoveRound(index) ? (
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => removeRound(index)}
                      aria-label={`Remove round ${index + 1}`}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  ) : null}
                </div>
                <Input
                  id={`round-title-${index}`}
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
                    min={form.start_date || undefined}
                    max={
                      round.end_date && form.end_date
                        ? round.end_date < form.end_date
                          ? round.end_date
                          : form.end_date
                        : form.end_date || undefined
                    }
                    value={round.start_date}
                    onChange={updateRound(index, 'start_date')}
                    error={errors[`timeline.${index}.start_date`]}
                    disabled={!form.start_date || !form.end_date}
                    hint={
                      form.start_date && form.end_date
                        ? `Within ${form.start_date} – ${form.end_date}`
                        : 'Complete step 1 dates first'
                    }
                  />
                  <Input
                    label="End date"
                    type="date"
                    min={round.start_date || form.start_date || undefined}
                    max={form.end_date || undefined}
                    value={round.end_date}
                    onChange={updateRound(index, 'end_date')}
                    error={errors[`timeline.${index}.end_date`]}
                    disabled={!form.start_date || !form.end_date}
                    hint={
                      form.start_date && form.end_date
                        ? `Within ${form.start_date} – ${form.end_date}`
                        : 'Complete step 1 dates first'
                    }
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

                {/* Per-round participation and evaluation settings. These used
                    to be hackathon-wide; each round now carries its own. */}
                <Select
                  label="Team size"
                  value={round.max_team_size}
                  onChange={updateRound(index, 'max_team_size')}
                  hint="Solo lets each student submit alone. Larger sizes need a team leader who submits for the team; the count includes the leader."
                >
                  {TEAM_SIZE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>

                <label className="hackathon-video-toggle">
                  <input
                    type="checkbox"
                    checked={round.working_demo_video_required !== false}
                    onChange={updateRoundFlag(index, 'working_demo_video_required')}
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
                    checked={round.auto_ai_evaluation === true}
                    onChange={updateRoundFlag(index, 'auto_ai_evaluation')}
                  />
                  <span>
                    <strong>Auto AI evaluation on assign</strong>
                    <small>
                      When enabled, AI analysis starts automatically after assignment. When off,
                      evaluators trigger AI Evaluation manually.
                    </small>
                  </span>
                </label>

                <label className="hackathon-video-toggle">
                  <input
                    type="checkbox"
                    checked={round.github_ai_evaluation === true}
                    onChange={updateRoundFlag(index, 'github_ai_evaluation')}
                  />
                  <span>
                    <strong>AI GitHub analysis</strong>
                    <small>
                      When enabled, evaluators can analyse the submitted repository with AI and
                      pre-fill the GitHub scorecard metric. Independent of video AI evaluation.
                    </small>
                  </span>
                </label>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">No timeline rounds added.</p>
          )}

          {/* Below the rounds, not in the header: you add a round after reading
              the ones already there. */}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-hairline pt-4">
            {roundNotice && (
              <span
                className="flex items-center gap-1.5 text-sm font-medium text-emerald-600"
                role="status"
              >
                <Icon name="checkCircle" size={15} />
                {roundNotice}
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={addRound}
              leftIcon={<Icon name="plus" size={16} />}
            >
              Add round
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className={`hackathon-form-card ${step !== 5 ? 'wizard-step-hidden' : ''}`}>
        <CardHeader>
          <div className="hackathon-form-heading">
            <span className="hackathon-form-heading__number">06</span>
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
          </div>
          {banner && (
            <div className="selected-file-row">
              <span><Icon name="checkCircle" size={18} /></span>
              <div><strong>{banner.name}</strong><small>Ready to upload</small></div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className={`hackathon-form-card ${step !== REVIEW_INDEX ? 'wizard-step-hidden' : ''}`}>
        <CardHeader>
          <div className="hackathon-form-heading">
            <span className="hackathon-form-heading__number">07</span>
            <div><h3>Review and publish</h3><p>Check every section, then publish the hackathon.</p></div>
          </div>
          <span className="hackathon-form-heading__icon"><Icon name="checkCircle" size={20} /></span>
        </CardHeader>
        <CardBody className="stack-md">
          <ul className="draft-review-list">
            {FORM_STEPS.slice(0, REVIEW_INDEX).map((item, index) => {
              const missing = Object.keys(validateStep(form, banner, index, validationOptions))
              return (
                <li className={`draft-review-row ${missing.length ? 'is-missing' : ''}`} key={item.key}>
                  <span className="draft-review-row__icon">
                    <Icon name={missing.length ? 'alert' : 'checkCircle'} size={18} />
                  </span>
                  <div className="draft-review-row__copy">
                    <strong>{item.label}</strong>
                    <small>
                      {missing.length
                        ? `${missing.length} field${missing.length === 1 ? '' : 's'} still needed`
                        : item.blurb}
                    </small>
                  </div>
                  <button type="button" onClick={() => moveToStep(index)}>
                    Edit
                  </button>
                </li>
              )
            })}
          </ul>
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
          <p>
            <Icon name="shield" size={17} />
            {draftMode ? 'Saved as a draft as you go.' : 'Complete each section to continue.'}
          </p>
        )}
        <div className="hackathon-form-actions__buttons">
          {draftMode && (
            <Button variant="ghost" onClick={discardDraft} loading={discarding}>
              Discard draft
            </Button>
          )}
          {/* Keep both footer buttons mounted; hide the inactive one. Swapping a
              single button in/out let production form.submit fire after the step
              advanced, which hit onSubmit → create on the banner step. */}
          <Button
            key="wizard-next"
            type="button"
            variant="accent"
            size="lg"
            className={step < REVIEW_INDEX ? '' : 'hidden'}
            aria-hidden={step >= REVIEW_INDEX}
            tabIndex={step < REVIEW_INDEX ? 0 : -1}
            loading={savingStep}
            onClick={continueToNextStep}
            rightIcon={<Icon name="arrowRight" size={17} />}
          >
            Save and continue
          </Button>
          <Button
            key="wizard-submit"
            type="button"
            variant="accent"
            size="lg"
            className={step >= REVIEW_INDEX ? '' : 'hidden'}
            aria-hidden={step < REVIEW_INDEX}
            tabIndex={step >= REVIEW_INDEX ? 0 : -1}
            loading={submitting || savingStep}
            onClick={draftMode ? publishDraft : submitForm}
          >
            {draftMode ? 'Publish hackathon' : editing ? 'Save changes' : 'Create hackathon'}
          </Button>
        </div>
      </div>
    </form>
  )
}
