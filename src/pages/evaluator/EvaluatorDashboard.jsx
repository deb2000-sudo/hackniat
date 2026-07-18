import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import PageHeader from '../../components/layout/PageHeader'
import Card, { CardBody, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import Input from '../../components/ui/Input'

export default function EvaluatorDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [sessionId, setSessionId] = useState('')
  const [error, setError] = useState('')

  const openSession = (e) => {
    e.preventDefault()
    const id = sessionId.trim()
    if (!id) {
      setError('Enter a session ID to review.')
      return
    }
    navigate(`/evaluator/evaluations/${id}`)
  }

  return (
    <div className="container page">
      <PageHeader
        eyebrow={`Welcome, ${user?.name?.split(' ')[0] || 'evaluator'}`}
        title="Evaluator workspace"
        description="Review hackathon submissions and their AI evaluations."
      />

      <div className="grid" style={{ gridTemplateColumns: '1fr', marginBottom: 24 }}>
        <Card>
          <CardHeader>
            <h3>Review a submission</h3>
            <Icon name="search" size={20} className="text-muted" />
          </CardHeader>
          <CardBody>
            <form className="row wrap" style={{ alignItems: 'flex-end', gap: 12 }} onSubmit={openSession}>
              <div className="grow" style={{ minWidth: 260 }}>
                <Input
                  label="Session ID"
                  placeholder="Paste an evaluation session ID"
                  value={sessionId}
                  onChange={(e) => {
                    setSessionId(e.target.value)
                    setError('')
                  }}
                  error={error}
                />
              </div>
              <Button type="submit" variant="accent" leftIcon={<Icon name="arrowRight" size={18} />}>
                Open evaluation
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>

      <div style={{ marginTop: 24 }}>
        <Button as={Link} to="/evaluator/review" variant="ghost" leftIcon={<Icon name="search" size={18} />}>
          Go to review page
        </Button>
      </div>
    </div>
  )
}
