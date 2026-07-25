import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import HackathonForm from '../../components/hackathons/HackathonForm'
import PageHeader from '../../components/layout/PageHeader'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import { LoadingBlock } from '../../components/ui/Spinner'

export default function HackathonFormPage() {
  const { hackathonId } = useParams()
  const navigate = useNavigate()
  const editing = !!hackathonId
  const { data, loading, error } = useAsync(() =>
    editing ? hackathonsApi.get(hackathonId) : Promise.resolve(null),
  )
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const save = async (fields) => {
    setSubmitting(true)
    setSubmitError('')
    try {
      const saved = editing
        ? await hackathonsApi.update(hackathonId, fields)
        : await hackathonsApi.create(fields)
      navigate(`/hackathons/${saved.id || hackathonId}`, { replace: true })
    } catch (err) {
      setSubmitError(err.message || `Unable to ${editing ? 'update' : 'create'} the hackathon.`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="container page">
        <LoadingBlock label={editing ? 'Loading hackathon…' : 'Preparing form…'} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container container--narrow page stack-md">
        <Alert variant="danger" title="Unable to load hackathon">{error.message}</Alert>
        <div>
          <Button variant="secondary" onClick={() => navigate('/hackathons')}>
            Back to hackathons
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container container--narrow page">
      <PageHeader
        eyebrow="Hackathons"
        title={editing ? 'Edit hackathon' : 'Create hackathon'}
        description={
          editing
            ? 'Only changed fields and a newly selected banner will be sent.'
            : 'Configure the event, prizes, timeline, guidelines, and optional banner.'
        }
        actions={
          <Button
            variant="secondary"
            onClick={() => navigate(editing ? `/hackathons/${hackathonId}` : '/hackathons')}
            leftIcon={<Icon name="arrowLeft" size={18} />}
          >
            Cancel
          </Button>
        }
      />
      <HackathonForm
        initialValue={editing ? data : null}
        onSubmit={save}
        submitting={submitting}
        submitError={submitError}
      />
    </div>
  )
}
