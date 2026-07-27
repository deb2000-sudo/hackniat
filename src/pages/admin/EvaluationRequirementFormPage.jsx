import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { evaluationRequirementsApi } from '../../api/evaluationRequirements'
import { useAsync } from '../../hooks/useAsync'
import RequirementForm from '../../components/evaluation-requirements/RequirementForm'
import PageHeader from '../../components/layout/PageHeader'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Card, { CardBody } from '../../components/ui/Card'
import Icon from '../../components/ui/Icon'
import { LoadingBlock } from '../../components/ui/Spinner'

export default function EvaluationRequirementFormPage() {
  const { requirementId } = useParams()
  const navigate = useNavigate()
  const editing = !!requirementId
  const { data, loading, error } = useAsync(() =>
    editing ? evaluationRequirementsApi.get(requirementId) : Promise.resolve(null),
  )
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [created, setCreated] = useState(null)

  const save = async (payload) => {
    setSubmitting(true)
    setSubmitError('')
    try {
      const saved = editing
        ? await evaluationRequirementsApi.update(requirementId, payload)
        : await evaluationRequirementsApi.create(payload)
      if (editing) {
        navigate('/admin/evaluation-requirements', { replace: true })
      } else {
        setCreated(saved)
      }
    } catch (saveError) {
      setSubmitError(saveError.message || `Unable to ${editing ? 'update' : 'create'} requirement.`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="container page"><LoadingBlock label="Loading requirement…" /></div>
  }

  if (error) {
    return (
      <div className="container container--narrow page stack-md">
        <Alert variant="danger" title="Unable to load requirement">{error.message}</Alert>
        <div><Button as={Link} to="/admin/evaluation-requirements" variant="secondary">Back to requirements</Button></div>
      </div>
    )
  }

  if (created) {
    return (
      <div className="container container--narrow page">
        <Card className="requirement-created-card">
          <CardBody>
            <span className="requirement-created-card__icon">
              <Icon name="check" size={28} />
            </span>
            <div className="eyebrow">Requirement created</div>
            <h1>{created.name}</h1>
            <p>
              {created.fields?.length || 0} submission fields are ready. Set the AI scoring
              prompts now, or return to the requirement library.
            </p>
            <div className="row wrap">
              <Button
                as={Link}
                to={`/admin/evaluation-requirements/${created.id}/ai-scoring`}
                variant="accent"
                leftIcon={<Icon name="sparkles" size={18} />}
              >
                Set AI scoring
              </Button>
              <Button as={Link} to="/admin/evaluation-requirements" variant="secondary">
                Back to requirements
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="container requirement-form-page page">
      <PageHeader
        eyebrow="Evaluation requirements"
        title={editing ? 'Edit requirement' : 'Create requirement'}
        description={
          editing
            ? 'Update the reusable fields. Sending fields replaces the existing field list.'
            : 'Build a reusable set of submission fields for one or more hackathon rounds.'
        }
        actions={
          <Button
            as={Link}
            to="/admin/evaluation-requirements"
            variant="secondary"
            leftIcon={<Icon name="arrowLeft" size={17} />}
          >
            Cancel
          </Button>
        }
      />
      <RequirementForm
        initialValue={editing ? data : null}
        onSubmit={save}
        submitting={submitting}
        submitError={submitError}
      />
    </div>
  )
}
