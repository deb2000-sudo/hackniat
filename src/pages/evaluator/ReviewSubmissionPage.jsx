import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/layout/PageHeader'
import Card, { CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import Input from '../../components/ui/Input'
import Alert from '../../components/ui/Alert'

export default function ReviewSubmissionPage() {
  const navigate = useNavigate()
  const [sessionId, setSessionId] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const id = sessionId.trim()
    if (!id) {
      setError('Enter a session ID to review.')
      return
    }
    navigate(`/evaluator/evaluations/${id}`)
  }

  return (
    <div className="container container--narrow page">
      <PageHeader
        eyebrow="Review"
        title="Review a submission"
        description="Enter the evaluation session ID shared with you to view its status and AI results."
      />
      <Card>
        <CardBody className="stack-md">
          <Alert variant="info">
            Evaluators can read any evaluation session. Ask the student for their session ID, or use one
            from your recently reviewed list.
          </Alert>
          <form className="stack-md" onSubmit={handleSubmit}>
            <Input
              label="Session ID"
              placeholder="e.g. 3f9a1c2e-…"
              value={sessionId}
              onChange={(e) => {
                setSessionId(e.target.value)
                setError('')
              }}
              error={error}
              required
            />
            <Button type="submit" variant="accent" leftIcon={<Icon name="arrowRight" size={18} />}>
              Open evaluation
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
