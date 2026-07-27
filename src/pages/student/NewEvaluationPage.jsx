import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { evaluationApi } from '../../api/evaluation'
import { evaluationRequirementsApi } from '../../api/evaluationRequirements'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import { formatFileSize } from '../../utils/format'
import Card, { CardBody, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import Alert from '../../components/ui/Alert'
import Input, { Select, Textarea } from '../../components/ui/Input'
import { LoadingBlock } from '../../components/ui/Spinner'
import ScreenRecorder from '../../components/evaluation/ScreenRecorder'

const STEPS = [
  { label: 'Requirements', short: 'Details' },
  { label: 'Record demo', short: 'Record' },
  { label: 'Upload video', short: 'Upload' },
  { label: 'Submit', short: 'Submit' },
]

function Stepper({ current }) {
  return (
    <ol className="submission-stepper" aria-label="Submission progress">
      {STEPS.map((step, index) => {
        const done = index < current
        return (
          <li
            className={`${index === current ? 'is-active' : ''} ${done ? 'is-done' : ''}`}
            key={step.label}
            aria-current={index === current ? 'step' : undefined}
          >
            <span className="submission-stepper__number">
              {done ? <Icon name="check" size={16} /> : index + 1}
            </span>
            <span>
              <small>Step {index + 1}</small>
              <strong className="submission-stepper__full">{step.label}</strong>
              <strong className="submission-stepper__short">{step.short}</strong>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function fieldValueIsEmpty(value) {
  if (value instanceof File) return !value.size
  return !String(value ?? '').trim()
}

function validateRequirement(requirement, answers) {
  const errors = {}
  ;(requirement?.fields || []).forEach((field) => {
    const value = answers[field.key]
    if (field.is_required && fieldValueIsEmpty(value)) {
      errors[field.key] = `${field.label} is required.`
      return
    }
    if (field.field_type === 'url' && !fieldValueIsEmpty(value)) {
      try {
        const url = new URL(String(value))
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol')
      } catch {
        errors[field.key] = 'Enter a complete URL beginning with http:// or https://.'
      }
    }
  })
  return errors
}

function serializeAnswers(requirement, answers) {
  return Object.fromEntries(
    (requirement?.fields || []).map((field) => {
      const value = answers[field.key]
      return [field.key, value instanceof File ? value.name : String(value ?? '').trim()]
    }),
  )
}

function buildLegacyDetails(requirement, answers) {
  const serialized = serializeAnswers(requirement, answers)
  const otherFields = (requirement?.fields || []).filter(
    (field) => !['problem_statement', 'solution_description'].includes(field.key),
  )
  const additional = otherFields
    .map((field) => `${field.label}: ${serialized[field.key] || 'Not provided'}`)
    .join('\n')

  const fallbackSummary = (requirement?.fields || [])
    .map((field) => `${field.label}: ${serialized[field.key] || 'Not provided'}`)
    .join('\n')

  return {
    problem_statement:
      serialized.problem_statement ||
      `Submission responses for ${requirement?.name || 'evaluation requirement'}`,
    solution_description: [
      serialized.solution_description || fallbackSummary,
      additional && serialized.solution_description
        ? `Additional requirement responses:\n${additional}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 5000),
  }
}

function RequirementField({ field, value, error, disabled, onChange }) {
  const common = {
    label: field.label,
    required: field.is_required,
    disabled,
    error,
    hint: field.description || undefined,
  }

  if (field.field_type === 'textarea') {
    return (
      <Textarea
        {...common}
        rows={5}
        maxLength={5000}
        placeholder={field.placeholder || undefined}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  if (field.field_type === 'file') {
    return (
      <div className="field">
        <label className="label">
          {field.label}{field.is_required && <span className="req">*</span>}
        </label>
        <label className={`submission-file-field ${error ? 'is-error' : ''}`}>
          <Icon name="upload" size={20} />
          <span>
            <strong>{value instanceof File ? value.name : 'Choose a file'}</strong>
            <small>
              {value instanceof File
                ? formatFileSize(value.size)
                : field.placeholder || 'Select the requested supporting file'}
            </small>
          </span>
          <input
            type="file"
            disabled={disabled}
            onChange={(event) => onChange(event.target.files?.[0] || null)}
          />
        </label>
        {error ? (
          <span className="field__error">{error}</span>
        ) : (
          field.description && <span className="field__hint">{field.description}</span>
        )}
      </div>
    )
  }

  const type = ['url', 'number', 'date'].includes(field.field_type)
    ? field.field_type
    : 'text'
  return (
    <Input
      {...common}
      type={type}
      maxLength={type === 'text' || type === 'url' ? 5000 : undefined}
      placeholder={field.placeholder || undefined}
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export default function NewEvaluationPage() {
  const navigate = useNavigate()
  const {
    data: requirements,
    loading: requirementsLoading,
    error: requirementsError,
    reload: reloadRequirements,
  } = useAsync(() => evaluationRequirementsApi.list())
  const {
    data: hackathons,
    loading: hackathonsLoading,
    error: hackathonsError,
    reload: reloadHackathons,
  } = useAsync(() => hackathonsApi.list())

  const [selectedHackathonId, setSelectedHackathonId] = useState('')
  const [selectedThemeId, setSelectedThemeId] = useState('')
  const [selectedRequirementId, setSelectedRequirementId] = useState('')
  const [answers, setAnswers] = useState({})
  const [answerErrors, setAnswerErrors] = useState({})
  const [file, setFile] = useState(null)
  const [step, setStep] = useState(0)
  const [phase, setPhase] = useState('idle')
  const [submittedSession, setSubmittedSession] = useState(null)
  const [error, setError] = useState('')

  const activeRequirement = useMemo(
    () =>
      requirements?.find((requirement) => requirement.id === selectedRequirementId) ||
      requirements?.[0] ||
      null,
    [requirements, selectedRequirementId],
  )
  const activeHackathon = useMemo(
    () =>
      hackathons?.find((hackathon) => hackathon.id === selectedHackathonId) ||
      hackathons?.[0] ||
      null,
    [hackathons, selectedHackathonId],
  )
  const activeTheme = useMemo(
    () =>
      activeHackathon?.themes?.find((theme) => theme.id === selectedThemeId) ||
      activeHackathon?.themes?.[0] ||
      null,
    [activeHackathon, selectedThemeId],
  )

  const busy = phase !== 'idle'

  const updateAnswer = (key, value) => {
    setAnswers((current) => ({ ...current, [key]: value }))
    setAnswerErrors((current) => ({ ...current, [key]: undefined }))
    setError('')
  }

  const completeRequirements = () => {
    if (!activeRequirement) {
      setError('No evaluation requirement is available for this submission.')
      return
    }
    if (!activeHackathon) {
      setError('Choose a hackathon before continuing.')
      return
    }
    if (!activeTheme) {
      setError('Choose a released theme before continuing.')
      return
    }
    const validation = validateRequirement(activeRequirement, answers)
    setAnswerErrors(validation)
    if (Object.keys(validation).length) {
      setError('Complete the required fields before continuing.')
      return
    }
    setError('')
    setStep(1)
  }

  const handleRecordingChange = (recordedFile) => {
    setFile(recordedFile)
    setSubmittedSession(null)
    setError('')
  }

  const continueToUpload = () => {
    if (!file) {
      setError('Record your working demo before continuing.')
      return
    }
    setError('')
    setStep(2)
  }

  const continueToSubmit = () => {
    if (!file) {
      setError('Record your working demo before continuing.')
      return
    }
    setError('')
    setStep(3)
  }

  const handleSubmit = async () => {
    if (!file || !activeRequirement) return
    setError('')
    try {
      setPhase('submitting')
      const submitted = await evaluationApi.createSubmission(file, {
        ...buildLegacyDetails(activeRequirement, answers),
        hackathon_id: activeHackathon.id,
        theme_id: activeTheme.id,
        evaluation_requirement_id: activeRequirement.id,
        requirement_responses: serializeAnswers(activeRequirement, answers),
      })
      setSubmittedSession(submitted)
    } catch (submitError) {
      setError(submitError.message || 'Your submission could not be recorded. Please try again.')
    } finally {
      setPhase('idle')
    }
  }

  if (submittedSession) {
    return (
      <div className="container container--narrow page">
        <Card className="student-submit-success">
          <CardBody>
            <span className="student-submit-success__icon">
              <Icon name="check" size={30} />
            </span>
            <div className="eyebrow">Submission recorded</div>
            <h1>Thank you for submitting</h1>
            <p>
              {submittedSession.message ||
                'Your submission has been recorded successfully. You will receive the evaluation result once the hackathon ends and the report is published by the admin.'}
            </p>
            <div className="student-submit-success__status">
              <Icon name="clock" size={18} />
              <span>
                <strong>Submitted — results pending</strong>
                <small>We will make the report available after an administrator publishes it.</small>
              </span>
            </div>
            <div className="row wrap">
              <Button
                variant="accent"
                onClick={() => navigate('/student/evaluations')}
                rightIcon={<Icon name="arrowRight" size={17} />}
              >
                View submissions
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate(`/student/submissions/${submittedSession.id}`)}
              >
                View uploaded video
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="container submission-wizard page">
      <div className="submission-wizard__intro">
        <div>
          <div className="eyebrow">Project submission</div>
          <h1>Submit your working demo</h1>
          <p>Complete every stage to send your project for AI evaluation.</p>
        </div>
        <div className="submission-wizard__secure">
          <Icon name="shield" size={17} />
          Progress stays on this page
        </div>
      </div>

      <Stepper current={step} />

      {error && <Alert variant="danger">{error}</Alert>}

      <section className="submission-panel" hidden={step !== 0}>
        <Card>
          <CardHeader className="submission-panel__header">
            <div>
              <span className="submission-panel__eyebrow">Step 1 of 4</span>
              <h2>Complete the requirements</h2>
              <p>Tell us about your project before recording the demo.</p>
            </div>
            <span className="submission-panel__icon"><Icon name="clipboard" size={22} /></span>
          </CardHeader>
          <CardBody className="stack-lg">
            {requirementsLoading || hackathonsLoading ? (
              <LoadingBlock label="Loading submission requirements…" />
            ) : requirementsError || hackathonsError ? (
              <Alert variant="danger" title="Requirements could not be loaded">
                {requirementsError?.message || hackathonsError?.message}
                <div className="submission-inline-action">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      reloadRequirements()
                      reloadHackathons()
                    }}
                  >
                    Try again
                  </Button>
                </div>
              </Alert>
            ) : !activeRequirement || !activeHackathon ? (
              <Alert variant="warning" title="No requirement configured">
                An administrator must configure a hackathon and evaluation requirement before you can submit.
              </Alert>
            ) : (
              <>
                <Select
                  label="Hackathon"
                  required
                  value={activeHackathon.id}
                  onChange={(event) => {
                    setSelectedHackathonId(event.target.value)
                    setSelectedThemeId('')
                    setError('')
                  }}
                  hint="Your submission will appear in this hackathon’s admin review queue."
                >
                  {hackathons.map((hackathon) => (
                    <option value={hackathon.id} key={hackathon.id}>
                      {hackathon.name}
                    </option>
                  ))}
                </Select>

                {activeHackathon.themes?.length ? (
                  <Select
                    label="Theme"
                    required
                    value={activeTheme?.id || ''}
                    onChange={(event) => {
                      setSelectedThemeId(event.target.value)
                      setError('')
                    }}
                    hint="Choose from the themes released for this hackathon."
                  >
                    {activeHackathon.themes.map((theme) => (
                      <option value={theme.id} key={theme.id}>
                        {theme.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Alert variant="warning" title="No themes released">
                    This hackathon is not accepting submissions until an administrator releases at least one theme.
                  </Alert>
                )}

                {(requirements?.length || 0) > 1 && (
                  <Select
                    label="Evaluation requirement"
                    value={activeRequirement.id}
                    onChange={(event) => {
                      setSelectedRequirementId(event.target.value)
                      setAnswerErrors({})
                      setError('')
                    }}
                    hint="Choose the field set assigned to your submission round."
                  >
                    {requirements.map((requirement) => (
                      <option value={requirement.id} key={requirement.id}>
                        {requirement.name}
                      </option>
                    ))}
                  </Select>
                )}

                <div className="submission-requirement-banner">
                  <span><Icon name="clipboard" size={19} /></span>
                  <div>
                    <strong>{activeRequirement.name}</strong>
                    <p>{activeRequirement.description || 'Complete the fields below.'}</p>
                  </div>
                  <small>{activeRequirement.fields?.length || 0} fields</small>
                </div>

                <div className="submission-requirement-fields">
                  {(activeRequirement.fields || []).map((field) => (
                    <RequirementField
                      key={field.key}
                      field={field}
                      value={answers[field.key]}
                      error={answerErrors[field.key]}
                      disabled={busy || !!submittedSession}
                      onChange={(value) => updateAnswer(field.key, value)}
                    />
                  ))}
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <div className="submission-panel__actions">
          <span>Required fields are marked with an asterisk.</span>
          <Button
            variant="accent"
            size="lg"
            disabled={!activeRequirement || !activeHackathon || !activeTheme || requirementsLoading || hackathonsLoading}
            onClick={completeRequirements}
            rightIcon={<Icon name="arrowRight" size={18} />}
          >
            Continue to recording
          </Button>
        </div>
      </section>

      <section className="submission-panel" hidden={step !== 1}>
        <Card>
          <CardHeader className="submission-panel__header">
            <div>
              <span className="submission-panel__eyebrow">Step 2 of 4</span>
              <h2>Record your working demo</h2>
              <p>Share your screen and demonstrate the core project experience.</p>
            </div>
            <span className="submission-panel__icon"><Icon name="monitor" size={22} /></span>
          </CardHeader>
          <CardBody>
            <ScreenRecorder onChange={handleRecordingChange} disabled={busy || !!submittedSession} />
          </CardBody>
        </Card>

        <div className="submission-panel__actions">
          <Button variant="ghost" onClick={() => setStep(0)} leftIcon={<Icon name="arrowLeft" size={17} />}>
            Back to requirements
          </Button>
          <Button
            variant="accent"
            size="lg"
            disabled={!file}
            onClick={continueToUpload}
            rightIcon={<Icon name="arrowRight" size={18} />}
          >
            Continue to upload
          </Button>
        </div>
      </section>

      <section className="submission-panel" hidden={step !== 2}>
        <Card>
          <CardHeader className="submission-panel__header">
            <div>
              <span className="submission-panel__eyebrow">Step 3 of 4</span>
              <h2>Upload your demo video</h2>
              <p>Confirm the recording and upload it securely to your submission.</p>
            </div>
            <span className="submission-panel__icon"><Icon name="upload" size={22} /></span>
          </CardHeader>
          <CardBody className="stack-lg">
            <div className="submission-video-ready">
              <span><Icon name="video" size={24} /></span>
              <div>
                <strong>{file?.name || 'Recorded working demo'}</strong>
                <p>{file ? `${formatFileSize(file.size)} · Ready to upload` : 'No recording selected'}</p>
              </div>
              <span className="submission-video-ready__status">
                <Icon name="checkCircle" size={15} /> Ready
              </span>
            </div>

            <div className="submission-upload-summary">
              <div>
                <span>Hackathon</span>
                <strong>{activeHackathon?.name}</strong>
              </div>
              <div>
                <span>Requirement</span>
                <strong>{activeRequirement?.name}</strong>
              </div>
              <div>
                <span>Theme</span>
                <strong>{activeTheme?.name}</strong>
              </div>
              <div>
                <span>Fields completed</span>
                <strong>{activeRequirement?.fields?.length || 0}</strong>
              </div>
              <div>
                <span>Video</span>
                <strong>{file ? formatFileSize(file.size) : '—'}</strong>
              </div>
            </div>

            <Alert variant="info">
              Review the recording details, then continue. Nothing is submitted until the final step.
            </Alert>
          </CardBody>
        </Card>

        <div className="submission-panel__actions">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setStep(1)}
            leftIcon={<Icon name="arrowLeft" size={17} />}
          >
            Back to recording
          </Button>
          <Button
            variant="accent"
            size="lg"
            onClick={continueToSubmit}
            rightIcon={<Icon name="arrowRight" size={18} />}
          >
            Continue to submit
          </Button>
        </div>
      </section>

      <section className="submission-panel" hidden={step !== 3}>
        <Card>
          <CardHeader className="submission-panel__header">
            <div>
              <span className="submission-panel__eyebrow">Step 4 of 4</span>
              <h2>Submit for evaluation</h2>
              <p>Review everything once more and record your final submission.</p>
            </div>
            <span className="submission-panel__icon is-success"><Icon name="check" size={22} /></span>
          </CardHeader>
          <CardBody className="stack-lg">
            <Alert variant="success" title="Your submission is ready">
              Your requirement responses and working demo will be uploaded together.
            </Alert>

            <div className="submission-final-summary">
              <div>
                <Icon name="trophy" size={19} />
                <span><small>Hackathon</small><strong>{activeHackathon?.name}</strong></span>
                <Icon name="checkCircle" size={18} />
              </div>
              <div>
                <Icon name="clipboard" size={19} />
                <span><small>Requirement</small><strong>{activeRequirement?.name}</strong></span>
                <Icon name="checkCircle" size={18} />
              </div>
              <div>
                <Icon name="sparkles" size={19} />
                <span><small>Theme</small><strong>{activeTheme?.name}</strong></span>
                <Icon name="checkCircle" size={18} />
              </div>
              <div>
                <Icon name="video" size={19} />
                <span><small>Working demo</small><strong>{file?.name}</strong></span>
                <Icon name="checkCircle" size={18} />
              </div>
            </div>

            <Alert variant="info">
              AI evaluation is run by the administrator after submissions close. Results remain
              private until the report is published.
            </Alert>
          </CardBody>
        </Card>

        <div className="submission-panel__actions submission-panel__actions--final">
          <span>
            <Icon name="info" size={16} />
            You cannot change this submission after it is recorded.
          </span>
          <Button
            variant="accent"
            size="lg"
            loading={phase === 'submitting'}
            onClick={handleSubmit}
            rightIcon={phase !== 'submitting' && <Icon name="check" size={18} />}
          >
            {phase === 'submitting' ? 'Submitting…' : 'Submit your project'}
          </Button>
        </div>
      </section>
    </div>
  )
}
