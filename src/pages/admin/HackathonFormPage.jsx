import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import { BTN_GHOST, EYEBROW, WRAP_APP } from '../../components/drop/theme'
import HackathonForm from '../../components/hackathons/HackathonForm'
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
      <div className={`${WRAP_APP} py-7 md:py-10`}>
        <LoadingBlock label={editing ? 'Loading hackathon…' : 'Preparing form…'} />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${WRAP_APP} py-7 md:py-10`}>
        <Alert variant="danger" title="Unable to load hackathon">
          {error.message}
        </Alert>
        <div className="mt-5">
          <Button variant="secondary" onClick={() => navigate('/hackathons')}>
            Back to hackathons
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <header className="mb-7 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-3xl">
          <span className={EYEBROW}>Hackathons</span>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink md:text-[36px]">
            {editing ? 'Edit hackathon' : 'Create hackathon'}
          </h1>
          <p className="mt-2 text-[15px] text-muted md:text-base">
            {editing
              ? 'Only changed fields and a newly selected banner will be sent.'
              : 'Configure the event, prizes, timeline, participation and evaluator guidelines, and optional banner.'}
          </p>
        </div>
        <Link
          to={editing ? `/hackathons/${hackathonId}` : '/hackathons'}
          className={`${BTN_GHOST} w-full shrink-0 sm:w-auto`}
        >
          <Icon name="arrowLeft" size={17} />
          Cancel
        </Link>
      </header>

      <HackathonForm
        initialValue={editing ? data : null}
        onSubmit={save}
        submitting={submitting}
        submitError={submitError}
      />
    </div>
  )
}
