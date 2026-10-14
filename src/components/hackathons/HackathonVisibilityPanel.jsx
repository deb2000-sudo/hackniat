import { useEffect, useState } from 'react'
import { hackathonsApi } from '../../api/hackathons'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
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
import styles from './HackathonVisibilityPanel.module.css'

/**
 * One side of the rule: a card with its title, a selection count and the
 * Select all box in the header, and the options as compact rows underneath.
 * `groups` lets batches sit under their university; a group with no label is
 * a plain list.
 */
function SelectionCard({ icon, title, allLabel, allOn, onAll, groups, isChecked, onToggle, empty, disabled }) {
  const rows = groups.flatMap((group) => group.rows)
  const checkedCount = rows.filter((row) => isChecked(row.id)).length
  return (
    <fieldset className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <legend className={styles.title}>
            <Icon name={icon} size={16} />
            {title}
          </legend>
          <span className={`${styles.count} ${allOn ? styles.countAll : ''}`}>
            {allOn ? 'All' : `${checkedCount} of ${rows.length}`}
          </span>
        </div>
        <label className={styles.selectAll}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={allOn}
            disabled={disabled}
            onChange={(event) => onAll(event.target.checked)}
          />
          <span>
            {allLabel} <small>· includes any added later</small>
          </span>
        </label>
      </div>

      <div className={styles.body}>
        {rows.length ? (
          groups.map((group) => (
            <div key={group.key} role="group" aria-label={group.label || title}>
              {group.label && <div className={styles.groupLabel}>{group.label}</div>}
              {group.rows.map((row) => {
                const checked = isChecked(row.id)
                return (
                  <label
                    key={row.id}
                    className={styles.row}
                    data-checked={checked}
                    data-disabled={disabled}
                  >
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={checked}
                      disabled={disabled}
                      onChange={() => onToggle(row.id)}
                    />
                    <span className={styles.rowText}>
                      <span className={styles.primary} title={row.primary}>
                        {row.primary}
                      </span>
                      {row.secondary && <span className={styles.secondary}>{row.secondary}</span>}
                    </span>
                  </label>
                )
              })}
            </div>
          ))
        ) : (
          <p className={styles.empty}>{empty}</p>
        )}
      </div>
    </fieldset>
  )
}

/** Batches under their university, in the order the API listed them. */
function groupBatches(batches) {
  const groups = []
  const byUniversity = new Map()
  batches.forEach((batch) => {
    const key = batch.university_id || batch.university_name || 'other'
    if (!byUniversity.has(key)) {
      const group = { key, label: batch.university_name || 'Other', rows: [] }
      byUniversity.set(key, group)
      groups.push(group)
    }
    byUniversity.get(key).rows.push({ id: batch.id, primary: batch.name || batch.id })
  })
  return groups
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

  const universityGroups = [
    {
      key: 'all',
      label: '',
      rows: universities.map((university) => ({
        id: university.id,
        primary: university.name || university.display_label || university.id,
        // The location sits to the right in a quieter tone; display_label
        // is the fallback when a row has no separate name.
        secondary: university.name ? university.location : '',
      })),
    },
  ]
  const batchGroups = groupBatches(shownBatches)

  return (
    <div className="stack-md">
      {saveError && <Alert variant="danger">{saveError}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectionCard
          icon="university"
          title="Universities"
          allLabel="Select all universities"
          allOn={form.allUniversities}
          onAll={(on) => change(setAllUniversities(form, on, universities, batches))}
          groups={universityGroups}
          isChecked={(id) => form.allUniversities || form.universityIds.has(id)}
          onToggle={(id) => change(toggleUniversity(form, id, universities, batches))}
          empty="No universities yet. Add them in University Management."
          disabled={saving}
        />
        <SelectionCard
          icon="calendar"
          title="Batches"
          allLabel="Select all batches"
          allOn={form.allBatches}
          onAll={(on) => change(setAllBatches(form, on, batches))}
          groups={batchGroups}
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

      <p className={styles.summary}>
        <Icon name="eye" size={16} />
        <span>{visibilitySummary(form)}</span>
      </p>

      <div className={styles.footer}>
        {blocker && (
          <p className={styles.blocker} aria-live="polite">
            <Icon name="alert" size={15} />
            {blocker}
          </p>
        )}
        <Button variant="accent" loading={saving} disabled={Boolean(blocker)} onClick={save}>
          Save visibility
        </Button>
      </div>
    </div>
  )
}
