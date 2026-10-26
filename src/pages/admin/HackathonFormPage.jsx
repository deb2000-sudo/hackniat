import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import { BTN_GHOST, EYEBROW, WRAP_APP } from '../../components/drop/theme'
import HackathonForm from '../../components/hackathons/HackathonForm'
import HackathonStartChoice from '../../components/hackathons/HackathonStartChoice'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import { LoadingBlock } from '../../components/ui/Spinner'
import { trackEvent } from '../../lib/logrocket'

/**
 * Hosts the hackathon wizard in two modes.
 *
 * `/admin/hackathons/:id/edit` patches a published hackathon in one save, as
 * before. `/admin/hackathons/create` builds a server-side draft: every section
 * PATCHes as it is completed, so the work survives a reload, and the event only
 * becomes real on publish.
 *
 * With no draftId yet it first asks how to start — blank, or a copy of an
 * existing hackathon — and puts the resulting draft id in the URL. A draftId
 * already in the URL (a resumed draft, or a copy made by a hackathon's
 * Duplicate button) loads straight into the wizard.
 */
export default function HackathonFormPage({ draftFlow = false }) {
  const { hackathonId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const draftId = draftFlow ? searchParams.get('draftId') || '' : ''

  // The chosen start becomes ?draftId=, so a refresh (or a shared link)
  // resumes the same draft instead of opening another.
  const openDraft = (id) => setSearchParams({ draftId: id }, { replace: true })

  if (draftFlow && !draftId) {
    return (
      <div className={`${WRAP_APP} py-7 md:py-10`}>
        <header className="mb-7 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 max-w-3xl">
            <span className={EYEBROW}>Hackathons</span>
            <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink md:text-[36px]">
              Create hackathon
            </h1>
            <p className="mt-2 text-[15px] text-muted md:text-base">
              Start from scratch, or copy an existing hackathon and change what is different.
            </p>
          </div>
          <Link to="/hackathons" className={`${BTN_GHOST} w-full shrink-0 sm:w-auto`}>
            <Icon name="arrowLeft" size={17} />
            Cancel
          </Link>
        </header>
        <HackathonStartChoice onDraft={openDraft} />
      </div>
    )
  }

  // Keyed by what it edits: picking a start on this page only changes the
  // URL, so without a fresh mount the loader would never fetch the new draft
  // and the wizard (which reads its values once) would stay blank.
  return (
    <HackathonEditor
      key={hackathonId ? `hackathon:${hackathonId}` : `draft:${draftId}`}
      hackathonId={hackathonId}
      draftId={draftId}
    />
  )
}

/** Loads one hackathon (edit) or one draft (create), then hosts the wizard. */
function HackathonEditor({ hackathonId, draftId }) {
  const navigate = useNavigate()
  const editing = !!hackathonId

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  // The failed request itself, so the form can put a round-level validation
  // error (e.g. a team size the API rejected) under that round.
  const [submitErrorCause, setSubmitErrorCause] = useState(null)

  const load = useCallback(() => {
    if (editing) return hackathonsApi.get(hackathonId)
    if (draftId) return hackathonsApi.getDraft(draftId)
    return Promise.resolve(null)
  }, [editing, hackathonId, draftId])
  const { data, loading, error } = useAsync(load)

  const save = async (fields) => {
    setSubmitting(true)
    setSubmitError('')
    setSubmitErrorCause(null)
    try {
      const saved = editing
        ? await hackathonsApi.update(hackathonId, fields)
        : await hackathonsApi.create(fields)
      trackEvent(editing ? 'Hackathon Updated' : 'Hackathon Created', {
        hackathonId: String(saved?.id || hackathonId || ''),
      })
      navigate(`/hackathons/${saved.id || hackathonId}`, { replace: true })
    } catch (err) {
      setSubmitError(err.message || `Unable to ${editing ? 'update' : 'create'} the hackathon.`)
      setSubmitErrorCause(err)
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
    trackEvent('Hackathon Created', { hackathonId: String(publishedId), fromDraft: true })
    navigate(publishedId ? `/hackathons/${publishedId}` : '/hackathons', { replace: true })
  }

  const discard = async () => {
    await hackathonsApi.deleteDraft(draftId)
    navigate('/hackathons', { replace: true })
  }

  if (loading) {
    return (
      <div className={`${WRAP_APP} py-7 md:py-10`}>
        <LoadingBlock
          label={editing ? 'Loading hackathon…' : 'Loading draft…'}
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

      {/* A draft made by Duplicate remembers where it came from. Its name
          already ends in "(copy)"; the dates are the original's. */}
      {draftId && data?.source_hackathon_name && (
        <div className="mb-6">
          <Alert variant="info">
            Copied from <strong>{data.source_hackathon_name}</strong>. Change the name and dates,
            then publish.
          </Alert>
        </div>
      )}

      <HackathonForm
        initialValue={data}
        onSubmit={save}
        submitting={submitting}
        submitError={submitError}
        submitErrorCause={submitErrorCause}
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
