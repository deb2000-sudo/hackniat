import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { evaluationApi } from '../../api/evaluation'
import PageHeader from '../../components/layout/PageHeader'
import Card, { CardBody, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import Alert from '../../components/ui/Alert'
import Input, { Textarea } from '../../components/ui/Input'
import ScreenRecorder from '../../components/evaluation/ScreenRecorder'
import { isUrl } from '../../utils/validators'

const STEPS = ['Record video', 'Upload your video', 'Analyze']

function Stepper({ current }) {
  return (
    <div className="stepper">
      {STEPS.map((label, i) => (
        <div className="step" key={label}>
          <div
            className={`step ${i === current ? 'step--active' : ''} ${i < current ? 'step--done' : ''}`}
          >
            <span className="step__num">{i < current ? <Icon name="check" size={16} /> : i + 1}</span>
            <span className="step__label">{label}</span>
          </div>
          {i < STEPS.length - 1 && <span className="step__divider" />}
        </div>
      ))}
    </div>
  )
}

export default function NewEvaluationPage() {
  const navigate = useNavigate()

  const [file, setFile] = useState(null)
  const [context, setContext] = useState({
    problem_statement: '',
    solution_description: '',
    github_repo_link: '',
    project_link: '',
    criteria: '',
  })
  const [phase, setPhase] = useState('idle') // idle | uploading | analyzing
  const [uploadedSession, setUploadedSession] = useState(null)
  const [error, setError] = useState('')

  const update = (key) => (e) => setContext((c) => ({ ...c, [key]: e.target.value }))

  const busy = phase !== 'idle'
  const currentStep = uploadedSession ? 2 : file ? 1 : 0
  const canUpload =
    !!file &&
    !!context.problem_statement.trim() &&
    !!context.solution_description.trim() &&
    isUrl(context.github_repo_link) &&
    (!context.project_link.trim() || isUrl(context.project_link))

  const handleRecordingChange = (recordedFile) => {
    setFile(recordedFile)
    setUploadedSession(null)
    setError('')
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please record your submission video before uploading.')
      return
    }
    if (!context.problem_statement.trim() || !context.solution_description.trim()) {
      setError('Problem statement and solution description are required.')
      return
    }
    if (!isUrl(context.github_repo_link)) {
      setError('Enter a valid GitHub repository link.')
      return
    }
    if (context.project_link.trim() && !isUrl(context.project_link)) {
      setError('Enter a valid project link, or leave it blank.')
      return
    }
    setError('')

    try {
      setPhase('uploading')
      const uploaded = await evaluationApi.createSubmission(file, {
        problem_statement: context.problem_statement.trim(),
        solution_description: context.solution_description.trim(),
        github_repo_link: context.github_repo_link.trim(),
        project_link: context.project_link.trim(),
      })
      setUploadedSession(uploaded)
      setPhase('idle')
    } catch (err) {
      setError(err.message || 'The video could not be uploaded. Please try again.')
      setPhase('idle')
    }
  }

  const handleAnalyze = async () => {
    if (!uploadedSession) return
    setError('')

    try {
      setPhase('analyzing')
      await evaluationApi.evaluateSubmission(uploadedSession.id, context.criteria.trim() || null)
      navigate(`/student/evaluations/${uploadedSession.id}`)
    } catch (err) {
      setError(err.message || 'Analysis could not be started. Your video is still uploaded; please try again.')
      setPhase('idle')
    }
  }

  return (
    <div className="container container--narrow page">
      <PageHeader
        eyebrow="Submission"
        title="Record a project video"
        description="Record up to 5 minutes of your screen presenting your project, then submit it for AI evaluation."
      />

      <Stepper current={currentStep} />

      {error && (
        <div style={{ marginBottom: 20 }}>
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      {uploadedSession && (
        <div style={{ marginBottom: 20 }}>
          <Alert variant="success" title="Video uploaded successfully">
            {[uploadedSession.team_name, uploadedSession.theme_chosen].filter(Boolean).join(' · ')}
            {uploadedSession.team_name || uploadedSession.theme_chosen ? '. ' : ''}
            Your full recording is ready. Select Analyze when you want to send it for analysis.
          </Alert>
        </div>
      )}

      <div className="stack-lg">
        <Card>
          <CardHeader>
            <h3>1. Record submission</h3>
            <Icon name="monitor" size={20} className="text-muted" />
          </CardHeader>
          <CardBody>
            <ScreenRecorder onChange={handleRecordingChange} disabled={busy || !!uploadedSession} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3>2. Project details</h3>
            <Icon name="clipboard" size={20} className="text-muted" />
          </CardHeader>
          <CardBody className="stack-md">
            <Alert variant="info">
              Team name and theme are taken automatically from your registered team profile.
            </Alert>
            <Textarea
              label="Problem statement"
              placeholder="What problem does your project solve?"
              value={context.problem_statement}
              onChange={update('problem_statement')}
              disabled={busy || !!uploadedSession}
              maxLength={5000}
              required
            />
            <Textarea
              label="Solution description"
              placeholder="Describe your solution and how it works."
              value={context.solution_description}
              onChange={update('solution_description')}
              disabled={busy || !!uploadedSession}
              maxLength={5000}
              required
            />
            <Input
              type="url"
              label="GitHub repository link"
              placeholder="https://github.com/your-team/your-project"
              value={context.github_repo_link}
              onChange={update('github_repo_link')}
              disabled={busy || !!uploadedSession}
              error={
                context.github_repo_link && !isUrl(context.github_repo_link)
                  ? 'Enter a valid URL'
                  : ''
              }
              required
            />
            <Input
              type="url"
              label="Project Link (optional)"
              placeholder="https://your-project-demo.example.com"
              value={context.project_link}
              onChange={update('project_link')}
              disabled={busy || !!uploadedSession}
              error={
                context.project_link && !isUrl(context.project_link) ? 'Enter a valid URL' : ''
              }
            />
            <Textarea
              label="Additional comments (optional)"
              placeholder="Any additional comments related to your project"
              value={context.criteria}
              onChange={update('criteria')}
              disabled={busy}
              maxLength={2000}
            />
          </CardBody>
        </Card>

        <div className="row-between wrap">
          <p className="text-sm text-muted">
            {uploadedSession
              ? 'Your video has been uploaded. Analysis starts only when you select Analyze.'
              : 'Preview the complete recording, then upload it when you are ready.'}
          </p>
          {uploadedSession ? (
            <Button
              variant="accent"
              size="lg"
              onClick={handleAnalyze}
              loading={phase === 'analyzing'}
              rightIcon={phase !== 'analyzing' && <Icon name="sparkles" size={18} />}
            >
              {phase === 'analyzing' ? 'Starting analysis…' : 'Analyze'}
            </Button>
          ) : (
            <Button
              variant="accent"
              size="lg"
              onClick={handleUpload}
              loading={phase === 'uploading'}
              disabled={!canUpload}
              rightIcon={phase !== 'uploading' && <Icon name="upload" size={18} />}
            >
              {phase === 'uploading' ? 'Uploading recording…' : 'Upload video'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
