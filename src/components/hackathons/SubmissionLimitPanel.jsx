import { useEffect, useState } from 'react'
import { hackathonsApi } from '../../api/hackathons'
import { PANEL } from '../drop/theme'
import Alert from '../ui/Alert'
import Icon from '../ui/Icon'
import { Select } from '../ui/Input'
import { LoadingBlock } from '../ui/Spinner'

/** The API accepts 1–3; anything else comes back rejected. */
const CHOICES = [1, 2, 3]

/**
 * How many times a student or team may submit for a round.
 *
 * The cap is per round rather than per hackathon, so a team that spends its
 * attempts in round 1 starts round 2 with the full allowance again. New
 * hackathons sit at 1 until an admin changes it here.
 *
 * Written without try/finally so the React Compiler can optimise it.
 */
export default function SubmissionLimitPanel({ hackathonId }) {
  const [maxSubmissions, setMaxSubmissions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    hackathonsApi
      .submissionLimit(hackathonId, { signal: controller.signal })
      .then((payload) => {
        if (!active) return
        setMaxSubmissions(Number(payload?.max_submissions) || 1)
        setLoading(false)
      })
      .catch((error) => {
        if (!active || error?.name === 'AbortError') return
        setLoadError(error?.message || 'Unable to load the submission limit.')
        setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [hackathonId])

  const save = async (next) => {
    setSaving(true)
    setActionError('')
    setMessage('')

    const payload = await hackathonsApi
      .updateSubmissionLimit(hackathonId, next)
      .catch((error) => {
        setActionError(error?.message || 'Unable to update the submission limit.')
        return null
      })

    setSaving(false)
    if (!payload) return

    const saved = Number(payload.max_submissions) || next
    setMaxSubmissions(saved)
    setMessage(
      saved === 1
        ? 'Each student or team gets one submission per round.'
        : `Each student or team gets ${saved} submissions per round.`,
    )
  }

  if (loading) return <LoadingBlock label="Loading submission limit…" />

  if (loadError) {
    return (
      <Alert variant="danger" title="Unable to load the submission limit">
        {loadError}
      </Alert>
    )
  }

  return (
    <section className={`${PANEL} p-4 sm:p-5`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Submissions</h2>
          <p className="mt-1 text-[13.5px] text-muted">
            How many times a student or team may submit for a round.
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

      <div className="max-w-[260px]">
        <Select
          label="Maximum submissions"
          value={String(maxSubmissions ?? 1)}
          disabled={saving}
          onChange={(event) => save(Number(event.target.value))}
          hint="Counted per round — round 2 starts from zero again."
        >
          {CHOICES.map((choice) => (
            <option key={choice} value={String(choice)}>
              {choice}
            </option>
          ))}
        </Select>
      </div>
    </section>
  )
}
