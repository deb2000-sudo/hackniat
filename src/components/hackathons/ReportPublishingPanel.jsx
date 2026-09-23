import { useEffect, useState } from 'react'
import { hackathonsApi } from '../../api/hackathons'
import { MONO, PANEL } from '../drop/theme'
import Alert from '../ui/Alert'
import Icon from '../ui/Icon'
import { LoadingBlock } from '../ui/Spinner'

/**
 * Auto-publishing for this hackathon's approved reports.
 *
 * Approving a submission records the decision; publishing is what a student
 * can actually see. Turning this on releases every approved report that is
 * still hidden — all hundred of them, in the one request — and keeps later
 * approvals publishing as they happen. Turning it off only stops future
 * automatic publishing: reports already out stay out, which is why switching
 * off says nothing about hiding anything.
 *
 * Written without try/finally so the React Compiler can optimise it.
 */
export default function ReportPublishingPanel({ hackathonId }) {
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    hackathonsApi
      .reportPublishing(hackathonId, { signal: controller.signal })
      .then((payload) => {
        if (!active) return
        setState(payload)
        setLoading(false)
      })
      .catch((error) => {
        if (!active || error?.name === 'AbortError') return
        setLoadError(error?.message || 'Unable to load report publishing settings.')
        setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [hackathonId])

  const setAutoPublish = async (next) => {
    setSaving(true)
    setActionError('')
    setMessage('')

    const payload = await hackathonsApi
      .updateReportPublishing(hackathonId, next)
      .catch((error) => {
        setActionError(error?.message || 'Unable to update report publishing.')
        return null
      })

    setSaving(false)
    if (!payload) return

    // The response carries the refreshed counts, so there is nothing to refetch.
    setState(payload)

    if (!next) {
      setMessage('Auto publishing is off. New approvals stay hidden until you publish them.')
      return
    }
    const releasedNow = Number(payload.published_now_count) || 0
    setMessage(
      releasedNow
        ? `${releasedNow} report${releasedNow === 1 ? '' : 's'} published.`
        : 'Auto publishing is on. Approved reports are released as they are approved.',
    )
  }

  if (loading) return <LoadingBlock label="Loading report publishing…" />

  if (loadError) {
    return (
      <Alert variant="danger" title="Unable to load report publishing">
        {loadError}
      </Alert>
    )
  }

  const autoPublish = Boolean(state?.auto_publish_reports)
  const approved = Number(state?.approved_count) || 0
  const hidden = Number(state?.unpublished_approved_count) || 0
  const published = Number(state?.published_count) || 0

  return (
    <section className={`${PANEL} p-4 sm:p-5`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
            Report publishing
          </h2>
          <p className="mt-1 text-[13.5px] text-muted">
            Approving records your decision. Publishing is what students can see.
          </p>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-drop border border-hairline bg-raised text-volt-ink">
          <Icon name="upload" size={18} />
        </span>
      </div>

      {actionError && (
        <div className="mb-4">
          <Alert variant="danger">{actionError}</Alert>
        </div>
      )}
      {message && (
        <div className="mb-4">
          <Alert variant="success">{message}</Alert>
        </div>
      )}

      <label className="hackathon-video-toggle">
        <input
          type="checkbox"
          checked={autoPublish}
          disabled={saving}
          onChange={(event) => setAutoPublish(event.target.checked)}
        />
        <span>
          <strong>Publish reports automatically</strong>
          <small>
            <span className={MONO}>{approved}</span> approved.
            {hidden > 0
              ? autoPublish
                ? ` ${hidden} still hidden.`
                : ` ${hidden} will be published when this is turned on.`
              : ''}
          </small>
        </span>
      </label>

      <p className="mt-3 text-[12.5px] text-muted">
        <span className={MONO}>{published}</span> report{published === 1 ? '' : 's'} visible to
        students.
      </p>
    </section>
  )
}
