import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import { BTN_GHOST, EYEBROW, WRAP_APP } from '../../components/drop/theme'
import HackathonForm from '../../components/hackathons/HackathonForm'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import { LoadingBlock } from '../../components/ui/Spinner'

/**
 * Hosts the hackathon wizard in two modes.
 *
 * `/admin/hackathons/:id/edit` patches a published hackathon in one save, as
 * before. `/admin/hackathons/create` builds a server-side draft: every section
 * PATCHes as it is completed, so the work survives a reload, and the event only
 * becomes real on publish.
 */
export default function HackathonFormPage({ draftFlow = false }) {
  const { hackathonId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const editing = !!hackathonId
  const draftId = draftFlow ? searchParams.get('draftId') || '' : ''

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [bootstrapError, setBootstrapError] = useState('')

  // Landing on /create with no draft opens one and puts its id in the URL, so a
  // refresh (or a shared link) resumes the same draft instead of orphaning it.
  const creatingDraftRef = useRef(false)
  useEffect(() => {
    if (!draftFlow || draftId || creatingDraftRef.current) return
    creatingDraftRef.current = true
    ;(async () => {
      try {
        const draft = await hackathonsApi.createDraft()
        setSearchParams({ draftId: draft.id }, { replace: true })
      } catch (err) {
        setBootstrapError(err.message || 'Could not start a new hackathon draft.')
        creatingDraftRef.current = false
      }
    })()
  }, [draftFlow, draftId, setSearchParams])

  const load = useCallback(() => {
    if (editing) return hackathonsApi.get(hackathonId)
    if (draftId) return hackathonsApi.getDraft(draftId)
    return Promise.resolve(null)
  }, [editing, hackathonId, draftId])
  const { data, loading, error } = useAsync(load)

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

  /**
   * One section finished. The banner is multipart so it goes first on its own
   * endpoint; the PATCH then records the fields plus where the wizard now is.
   */
  const saveStep = async ({ stepKey, patch, currentStep, completedSteps, banner }) => {
    if (stepKey === 'banner' && banner) {
      await hackathonsApi.uploadDraftBanner(draftId, banner)
    }
    await hackathonsApi.patchDraft(draftId, {
      ...patch,
      current_step: currentStep,
      completed_steps: completedSteps,
    })
  }

  const publish = async () => {
    const hackathon = await hackathonsApi.publishDraft(draftId)
    // The detail page lives at /hackathons/:id — there is no
    // /admin/hackathons/:id route, and sending the admin there after a
    // successful publish dropped them on the 404 page for a hackathon that
    // had in fact been created. Fall back to the list if the id is missing
    // rather than navigating to /hackathons/undefined.
    const publishedId = hackathon?.id || hackathon?.hackathon_id || ''
    navigate(publishedId ? `/hackathons/${publishedId}` : '/hackathons', { replace: true })
  }

  const discard = async () => {
    await hackathonsApi.deleteDraft(draftId)
    navigate('/hackathons', { replace: true })
  }

  if (bootstrapError) {
    return (
      <div className={`${WRAP_APP} py-7 md:py-10`}>
        <Alert variant="danger" title="Unable to start a draft">
          {bootstrapError}
        </Alert>
        <div className="mt-5">
          <Button variant="secondary" onClick={() => navigate('/hackathons')}>
            Back to hackathons
          </Button>
        </div>
      </div>
    )
  }

  if (loading || (draftFlow && !draftId)) {
    return (
      <div className={`${WRAP_APP} py-7 md:py-10`}>
        <LoadingBlock
          label={
            editing ? 'Loading hackathon…' : draftId ? 'Loading draft…' : 'Starting a new draft…'
          }
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${WRAP_APP} py-7 md:py-10`}>
        <Alert variant="danger" title={draftId ? 'Unable to load draft' : 'Unable to load hackathon'}>
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
              : 'Each section saves as you finish it. Publish when every section is complete.'}
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
        initialValue={data}
        onSubmit={save}
        submitting={submitting}
        submitError={submitError}
        draftId={draftId}
        initialStep={data?.current_step || ''}
        initialCompletedSteps={data?.completed_steps || []}
        onSaveStep={saveStep}
        onPublish={publish}
        onDiscard={discard}
      />
    </div>
  )
}
