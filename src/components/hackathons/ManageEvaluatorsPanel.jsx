import { useEffect, useState } from 'react'
import { hackathonsApi } from '../../api/hackathons'
import { MONO } from '../drop/theme'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import { LoadingBlock } from '../ui/Spinner'

/** Ids of the rows the server says are on the roster. */
function assignedIds(payload) {
  const rows = Array.isArray(payload?.evaluators) ? payload.evaluators : []
  return new Set(rows.filter((item) => item.assigned).map((item) => item.id))
}

/**
 * The evaluators this hackathon's submissions may be assigned to.
 *
 * A new hackathon starts with everyone already approved; people approved later
 * appear here unchecked until an admin saves them on. Saving replaces the
 * roster, and saving with nothing checked means nobody can be assigned.
 * Taking someone off does not unassign submissions they already hold.
 *
 * Written without try/finally so the React Compiler can optimise it.
 */
export default function ManageEvaluatorsPanel({ hackathonId }) {
  const [state, setState] = useState(null)
  const [checked, setChecked] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    hackathonsApi
      .evaluators(hackathonId, { signal: controller.signal })
      .then((payload) => {
        if (!active) return
        setState(payload)
        setChecked(assignedIds(payload))
        setLoading(false)
      })
      .catch((error) => {
        if (!active || error?.name === 'AbortError') return
        setLoadError(error?.message || 'Unable to load evaluators.')
        setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [hackathonId])

  const toggle = (id) => {
    setMessage('')
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    setActionError('')
    setMessage('')

    const payload = await hackathonsApi
      .updateEvaluators(hackathonId, [...checked])
      .catch((error) => {
        setActionError(error?.message || 'Unable to save evaluators.')
        return null
      })

    setSaving(false)
    if (!payload) return

    // The response is the refreshed roster, so there is nothing to refetch.
    setState(payload)
    setChecked(assignedIds(payload))
    setMessage('Evaluators saved.')
  }

  if (loading) return <LoadingBlock label="Loading evaluators…" />

  if (loadError) {
    return (
      <Alert variant="danger" title="Unable to load evaluators">
        {loadError}
      </Alert>
    )
  }

  const evaluators = Array.isArray(state?.evaluators) ? state.evaluators : []
  const assignedCount = Number(state?.assigned_count) || 0

  return (
    <div className="stack-md">
      {actionError && <Alert variant="danger">{actionError}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      {evaluators.length ? (
        <div className="flex flex-col gap-2">
          {evaluators.map((evaluator) => (
            <label key={evaluator.id} className="hackathon-video-toggle">
              <input
                type="checkbox"
                checked={checked.has(evaluator.id)}
                disabled={saving}
                onChange={() => toggle(evaluator.id)}
              />
              <span className="min-w-0">
                <strong>{evaluator.name || 'Unnamed evaluator'}</strong>
                <small className="break-all">{evaluator.email}</small>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-[13.5px] text-muted">No approved evaluators yet.</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted">
          <span className={MONO}>{assignedCount}</span> evaluator{assignedCount === 1 ? '' : 's'}{' '}
          can be assigned.
        </p>
        {/* Left enabled even with no changes: a hackathon created before rosters
            existed has none saved until the first save. */}
        <Button onClick={save} loading={saving}>
          Save
        </Button>
      </div>
    </div>
  )
}
