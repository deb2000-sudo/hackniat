import { useEffect, useState } from 'react'
import { hackathonsApi } from '../../api/hackathons'
import { MONO } from '../drop/theme'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import { LoadingBlock } from '../ui/Spinner'
import {
  formFromResponse,
  saveBlocker,
  setAllBatches,
  setAllUniversities,
  toggleBatch,
  toggleUniversity,
  visibilityPayload,
  visibilitySummary,
  visibleBatches,
} from './visibilityRules'

/**
 * One checklist with its Select all box on top. Rows are the same checkbox
 * tiles Manage Evaluators uses; the list scrolls once it gets long.
 */
function Checklist({ title, allLabel, allOn, onAll, rows, isChecked, onToggle, empty, disabled }) {
  const checkedCount = rows.filter((row) => isChecked(row.id)).length
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <legend className="text-[13px] font-semibold text-ink">{title}</legend>
        <span className={`${MONO} text-[12px] text-muted`}>
          {allOn ? 'All' : `${checkedCount} of ${rows.length}`}
        </span>
      </div>

      <label className="hackathon-video-toggle">
        <input
          type="checkbox"
          checked={allOn}
          disabled={disabled}
          onChange={(event) => onAll(event.target.checked)}
        />
        <span className="min-w-0">
          <strong>{allLabel}</strong>
          <small>Includes any added later.</small>
        </span>
      </label>

      {rows.length ? (
        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {rows.map((row) => (
            <label key={row.id} className="hackathon-video-toggle">
              <input
                type="checkbox"
                checked={isChecked(row.id)}
                disabled={disabled}
                onChange={() => onToggle(row.id)}
              />
              <span className="min-w-0">
                <strong className="break-words">{row.label}</strong>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="rounded-drop border border-dashed border-hairline px-3 py-4 text-[13px] text-muted">
          {empty}
        </p>
      )}
    </fieldset>
  )
}

/**
 * Who sees this hackathon on their dashboard: students whose university AND
 * batch are both allowed. Either side can be "all", which also covers
 * universities and batches created later — so it is saved as the flag, never
 * as a list of today's ids.
 *
 * Loads on open (the accordion is lazy); one PUT saves both lists, and the
 * response replaces the form. Selection rules live in visibilityRules.js.
 *
 * Written without try/finally so the React Compiler can optimise it.
 */
export default function HackathonVisibilityPanel({ hackathonId }) {
  const [catalog, setCatalog] = useState({ universities: [], batches: [] })
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [message, setMessage] = useState('')

  const apply = (payload) => {
    setCatalog({
      universities: Array.isArray(payload?.universities) ? payload.universities : [],
      batches: Array.isArray(payload?.batches) ? payload.batches : [],
    })
    setForm(formFromResponse(payload))
  }

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    hackathonsApi
      .visibility(hackathonId, { signal: controller.signal })
      .then((payload) => {
        if (!active) return
        apply(payload)
        setLoading(false)
      })
      .catch((error) => {
        if (!active || error?.name === 'AbortError') return
        setLoadError(error?.message || 'Unable to load visibility.')
        setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [hackathonId])

  const change = (next) => {
    setMessage('')
    setSaveError('')
    setForm(next)
  }

  const save = async () => {
    setSaving(true)
    setSaveError('')
    setMessage('')

    const payload = await hackathonsApi
      .updateVisibility(hackathonId, visibilityPayload(form, catalog.batches))
      .catch((error) => {
        // The API's own sentences (no university picked, a batch outside the
        // selected universities, ids that no longer exist) are shown as sent.
        setSaveError(error?.message || 'Unable to save visibility.')
        return null
      })

    setSaving(false)
    if (!payload) return

    apply(payload)
    setMessage('Visibility saved.')
  }

  if (loading) return <LoadingBlock label="Loading visibility…" />

  if (loadError || !form) {
    return (
      <Alert variant="danger" title="Unable to load visibility">
        {loadError || 'Unable to load visibility.'}
      </Alert>
    )
  }

  const { universities, batches } = catalog
  const shownBatches = visibleBatches(form, batches)
  const blocker = saveBlocker(form, batches)

  const universityRows = universities.map((university) => ({
    id: university.id,
    label:
      university.display_label ||
      [university.name, university.location].filter(Boolean).join(', ') ||
      university.id,
  }))
  const batchRows = shownBatches.map((batch) => ({
    id: batch.id,
    label: [batch.university_name, batch.name].filter(Boolean).join(' · ') || batch.id,
  }))

  return (
    <div className="stack-md">
      {saveError && <Alert variant="danger">{saveError}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Checklist
          title="Universities"
          allLabel="Select all universities"
          allOn={form.allUniversities}
          onAll={(on) => change(setAllUniversities(form, on, universities, batches))}
          rows={universityRows}
          isChecked={(id) => form.allUniversities || form.universityIds.has(id)}
          onToggle={(id) => change(toggleUniversity(form, id, universities, batches))}
          empty="No universities yet. Add them in University Management."
          disabled={saving}
        />
        <Checklist
          title="Batches"
          allLabel="Select all batches"
          allOn={form.allBatches}
          onAll={(on) => change(setAllBatches(form, on, batches))}
          rows={batchRows}
          isChecked={(id) => form.allBatches || form.batchIds.has(id)}
          onToggle={(id) => change(toggleBatch(form, id, batches))}
          empty={
            form.allUniversities
              ? 'No batches yet. Add them in Batch Management.'
              : 'Select a university to see its batches.'
          }
          disabled={saving}
        />
      </div>

      <p className="text-[13px] text-muted">{visibilitySummary(form)}</p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted" aria-live="polite">
          {blocker}
        </p>
        <Button variant="accent" loading={saving} disabled={Boolean(blocker)} onClick={save}>
          Save visibility
        </Button>
      </div>
    </div>
  )
}
