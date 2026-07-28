import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { evaluationApi } from '../../api/evaluation'
import { evaluationRequirementsApi } from '../../api/evaluationRequirements'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import { queryKeys } from '../../lib/queryKeys'
import { invalidateQueries } from '../../lib/queryCache'
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
  { label: 'Working demo', short: 'Demo' },
  { label: 'Review video', short: 'Review' },
  { label: 'Submit', short: 'Submit' },
]

const DEFAULT_VIDEO_ACCEPT = 'video/webm,video/mp4,video/quicktime,.webm,.mp4,.mov'
const DEFAULT_MAX_VIDEO_BYTES = 500 * 1024 * 1024
const DEFAULT_VIDEO_MIME_TYPES = ['video/webm', 'video/mp4', 'video/quicktime']
const DEFAULT_VIDEO_EXTENSIONS = ['.webm', '.mp4', '.mov']

const UPLOAD_PHASE = {
  preparing: {
    label: 'Preparing secure upload…',
    detail: 'Creating a temporary upload link for your recording.',
  },
  uploading: {
    label: 'Uploading video…',
    detail: 'Your recording is uploading directly to secure cloud storage. Keep this page open.',
  },
  finalizing: {
    label: 'Recording submission…',
    detail: 'The video is uploaded. We are saving your project details now.',
  },
}

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
  } = useAsync(
    (opts) => evaluationRequirementsApi.list(opts),
    { key: queryKeys.evaluationRequirements, staleTime: 60_000 },
  )
  const {
    data: hackathons,
    loading: hackathonsLoading,
    error: hackathonsError,
    reload: reloadHackathons,
  } = useAsync(
    (opts) => hackathonsApi.list(opts),
    { key: queryKeys.hackathons, staleTime: 60_000 },
  )
  const {
    data: videoMeta,
    error: videoMetaError,
  } = useAsync(
    (opts) => evaluationApi.getAcceptedVideoTypes(opts),
    { key: queryKeys.acceptedVideoTypes, staleTime: 5 * 60_000 },
  )

  const [selectedHackathonId, setSelectedHackathonId] = useState('')
  const [selectedThemeId, setSelectedThemeId] = useState('')
  const [selectedRequirementId, setSelectedRequirementId] = useState('')
  const [answers, setAnswers] = useState({})
  const [answerErrors, setAnswerErrors] = useState({})
  const [file, setFile] = useState(null)
  const [videoSource, setVideoSource] = useState(null)
  const [demoPreviewUrl, setDemoPreviewUrl] = useState('')
  const [step, setStep] = useState(0)
  const [phase, setPhase] = useState('idle')
  const [submittedSession, setSubmittedSession] = useState(null)
  const [error, setError] = useState('')
  const previewUrlRef = useRef('')

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    },
    [],
  )

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
  const videoAccept =
    videoMeta?.file_input_accept ||
    videoMeta?.accept ||
    DEFAULT_VIDEO_ACCEPT
  const maxVideoBytes =
    Number(videoMeta?.max_upload_bytes) || DEFAULT_MAX_VIDEO_BYTES
  const rawMimeTypes =
    videoMeta?.mime_types ||
    videoMeta?.accepted_mime_types ||
    videoMeta?.accepted_content_types ||
    DEFAULT_VIDEO_MIME_TYPES
  const rawExtensions =
    videoMeta?.extensions ||
    videoMeta?.accepted_extensions ||
    videoMeta?.file_extensions ||
    DEFAULT_VIDEO_EXTENSIONS
  const acceptedMimeTypes = Array.isArray(rawMimeTypes)
    ? rawMimeTypes
    : String(rawMimeTypes).split(',').map((value) => value.trim()).filter(Boolean)
  const acceptedExtensions = Array.isArray(rawExtensions)
    ? rawExtensions
    : String(rawExtensions).split(',').map((value) => value.trim()).filter(Boolean)

  const setDemoFile = (nextFile, source) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const nextUrl = nextFile ? URL.createObjectURL(nextFile) : ''
    previewUrlRef.current = nextUrl
    setDemoPreviewUrl(nextUrl)
    setFile(nextFile)
    setVideoSource(source)
    setSubmittedSession(null)
    setError('')
  }

  const chooseVideoSource = (source) => {
    if (videoSource !== source) setDemoFile(null, source)
    else setVideoSource(source)
  }

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
    if (recordedFile) {
      if (recordedFile.size > maxVideoBytes) {
        setDemoFile(null, 'recorded')
        setError(
          `The recording is larger than ${formatFileSize(maxVideoBytes)}. Please record a shorter demo or upload a smaller video.`,
        )
        return
      }
      setDemoFile(recordedFile, 'recorded')
    } else if (videoSource === 'recorded') {
      setDemoFile(null, 'recorded')
    }
  }

  const handleVideoFilePicked = (event) => {
    const pickedFile = event.target.files?.[0]
    event.target.value = ''
    if (!pickedFile) return

    const extension = pickedFile.name.includes('.')
      ? `.${pickedFile.name.split('.').pop().toLowerCase()}`
      : ''
    const normalizedMimeTypes = acceptedMimeTypes.map((value) =>
      String(value).toLowerCase().split(';')[0],
    )
    const normalizedExtensions = acceptedExtensions.map((value) =>
      String(value).toLowerCase().startsWith('.')
        ? String(value).toLowerCase()
        : `.${String(value).toLowerCase()}`,
    )

    if (!pickedFile.size) {
      setError('The selected video is empty. Choose another recording.')
      return
    }
    if (pickedFile.size > maxVideoBytes) {
      setError(
        `Choose a video smaller than ${formatFileSize(maxVideoBytes)}. The selected file is ${formatFileSize(pickedFile.size)}.`,
      )
      return
    }
    if (
      pickedFile.type &&
      normalizedMimeTypes.length &&
      !normalizedMimeTypes.includes(pickedFile.type.toLowerCase().split(';')[0])
    ) {
      setError('This video format is not supported. Choose one of the accepted video types.')
      return
    }
    if (
      !pickedFile.type &&
      normalizedExtensions.length &&
      !normalizedExtensions.includes(extension)
    ) {
      setError('This video file extension is not supported.')
      return
    }

    setDemoFile(pickedFile, 'uploaded')
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
    if (!file || !videoSource || !activeRequirement) return
    setError('')
    try {
      setPhase('preparing')
      const submitted = await evaluationApi.createSubmission(file, {
        ...buildLegacyDetails(activeRequirement, answers),
        hackathon_id: activeHackathon.id,
        theme_id: activeTheme.id,
        video_source: videoSource,
        evaluation_requirement_id: activeRequirement.id,
        requirement_responses: serializeAnswers(activeRequirement, answers),
      }, {
        onStageChange: setPhase,
      })
      invalidateQueries(queryKeys.submissionsMine)
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
            Continue to demo
          </Button>
        </div>
      </section>

      <section className="submission-panel" hidden={step !== 1}>
        <Card>
          <CardHeader className="submission-panel__header">
            <div>
              <span className="submission-panel__eyebrow">Step 2 of 4</span>
              <h2>Add your working demo</h2>
              <p>Record your screen or choose an existing video from your device.</p>
            </div>
            <span className="submission-panel__icon"><Icon name="video" size={22} /></span>
          </CardHeader>
          <CardBody className="stack-lg">
            <div className="demo-source-options" role="group" aria-label="Choose demo video source">
              <button
                type="button"
                className={videoSource === 'recorded' ? 'is-active' : ''}
                onClick={() => chooseVideoSource('recorded')}
                disabled={busy}
              >
                <span><Icon name="monitor" size={22} /></span>
                <div>
                  <strong>Record demo</strong>
                  <small>Share your screen and record in the browser.</small>
                </div>
                {videoSource === 'recorded' && <Icon name="checkCircle" size={19} />}
              </button>
              <button
                type="button"
                className={videoSource === 'uploaded' ? 'is-active' : ''}
                onClick={() => chooseVideoSource('uploaded')}
                disabled={busy}
              >
                <span><Icon name="upload" size={22} /></span>
                <div>
                  <strong>Upload video</strong>
                  <small>Choose a previously recorded demo from your device.</small>
                </div>
                {videoSource === 'uploaded' && <Icon name="checkCircle" size={19} />}
              </button>
            </div>

            {!videoSource && (
              <div className="demo-source-empty">
                <Icon name="video" size={28} />
                <strong>How would you like to add your demo?</strong>
                <p>Both options use the same secure upload and evaluation process.</p>
              </div>
            )}

            {videoSource === 'recorded' && (
              <ScreenRecorder
                onChange={handleRecordingChange}
                disabled={busy || !!submittedSession}
              />
            )}

            {videoSource === 'uploaded' && (
              <div className="stack-md">
                {videoMetaError && (
                  <Alert variant="warning">
                    Video limits could not be refreshed. Standard video formats up to 500 MiB
                    are still available.
                  </Alert>
                )}

                {file && demoPreviewUrl ? (
                  <div className="uploaded-demo-preview">
                    <video
                      src={demoPreviewUrl}
                      controls
                      playsInline
                      preload="metadata"
                      aria-label="Uploaded demo preview"
                    />
                    <div>
                      <span>
                        <Icon name="checkCircle" size={17} />
                        <span>
                          <strong>{file.name}</strong>
                          <small>{formatFileSize(file.size)} · Uploaded from device</small>
                        </span>
                      </span>
                      <label className="btn btn--secondary btn--sm">
                        <Icon name="refresh" size={16} />
                        Replace video
                        <input
                          type="file"
                          accept={videoAccept}
                          onChange={handleVideoFilePicked}
                          disabled={busy}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="demo-file-picker">
                    <span><Icon name="upload" size={26} /></span>
                    <strong>Choose your demo video</strong>
                    <p>Accepted video formats · Maximum {formatFileSize(maxVideoBytes)}</p>
                    <span className="btn btn--accent">Browse videos</span>
                    <input
                      type="file"
                      accept={videoAccept}
                      onChange={handleVideoFilePicked}
                      disabled={busy}
                    />
                  </label>
                )}
              </div>
            )}
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
            Continue to review
          </Button>
        </div>
      </section>

      <section className="submission-panel" hidden={step !== 2}>
        <Card>
          <CardHeader className="submission-panel__header">
            <div>
              <span className="submission-panel__eyebrow">Step 3 of 4</span>
              <h2>Review your demo video</h2>
              <p>Confirm the preview and details before continuing to submission.</p>
            </div>
            <span className="submission-panel__icon"><Icon name="video" size={22} /></span>
          </CardHeader>
          <CardBody className="stack-lg">
            <div className="submission-video-ready">
              <span><Icon name="video" size={24} /></span>
              <div>
                <strong>{file?.name || 'Working demo'}</strong>
                <p>{file ? `${formatFileSize(file.size)} · Ready to upload` : 'No video selected'}</p>
              </div>
              <span className="submission-video-ready__status">
                <Icon name="checkCircle" size={15} /> Ready
              </span>
            </div>

            {demoPreviewUrl && (
              <div className="submission-demo-review">
                <video
                  src={demoPreviewUrl}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label="Working demo preview"
                />
                <span>
                  <Icon name={videoSource === 'recorded' ? 'monitor' : 'upload'} size={16} />
                  {videoSource === 'recorded' ? 'Recorded in browser' : 'Uploaded from device'}
                </span>
              </div>
            )}

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
              Review the video details, then continue. Nothing is submitted until the final step.
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
            Replace video
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
                <span>
                  <small>{videoSource === 'recorded' ? 'Recorded demo' : 'Uploaded demo'}</small>
                  <strong>{file?.name}</strong>
                </span>
                <Icon name="checkCircle" size={18} />
              </div>
            </div>

            <Alert variant="info">
              AI evaluation is run by the administrator after submissions close. Results remain
              private until the report is published.
            </Alert>

            {busy && (
              <Alert variant="info" title={UPLOAD_PHASE[phase]?.label}>
                {UPLOAD_PHASE[phase]?.detail}
              </Alert>
            )}
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
            loading={busy}
            disabled={busy}
            onClick={handleSubmit}
            rightIcon={!busy && <Icon name="check" size={18} />}
          >
            {busy ? UPLOAD_PHASE[phase]?.label || 'Submitting…' : 'Submit your project'}
          </Button>
        </div>
      </section>
    </div>
  )
}
