import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { evaluationRequirementsApi } from '../../api/evaluationRequirements'
import { useAsync } from '../../hooks/useAsync'
import { BTN_GHOST, EYEBROW, WRAP_APP } from '../../components/drop/theme'
import RequirementForm from '../../components/evaluation-requirements/RequirementForm'
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
    return (
      <div className={`${WRAP_APP} py-7 md:py-10`}>
        <LoadingBlock label="Loading requirement…" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${WRAP_APP} py-7 md:py-10 stack-md`}>
        <Alert variant="danger" title="Unable to load requirement">
          {error.message}
        </Alert>
        <div>
          <Link to="/admin/evaluation-requirements" className={BTN_GHOST}>
            <Icon name="arrowLeft" size={17} />
            Back to requirements
          </Link>
        </div>
      </div>
    )
  }

  if (created) {
    return (
      <div className={`${WRAP_APP} py-7 md:py-10`}>
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
                Set scoring
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
    <div className={`${WRAP_APP} py-7 md:py-10 requirement-form-page`}>
      <header className="mb-7 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <span className={EYEBROW}>Evaluation requirements</span>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink md:text-[36px]">
            {editing ? 'Edit requirement' : 'Create requirement'}
          </h1>
          <p className="mt-2 text-[15px] text-muted md:text-base">
            {editing
              ? 'Update the reusable fields. Sending fields replaces the existing field list.'
              : 'Build a reusable set of submission fields for one or more hackathon rounds.'}
          </p>
        </div>
        <Link to="/admin/evaluation-requirements" className={`${BTN_GHOST} w-full shrink-0 sm:w-auto`}>
          <Icon name="arrowLeft" size={17} />
          Cancel
        </Link>
      </header>
      <RequirementForm
        initialValue={editing ? data : null}
        onSubmit={save}
        submitting={submitting}
        submitError={submitError}
      />
    </div>
  )
}
