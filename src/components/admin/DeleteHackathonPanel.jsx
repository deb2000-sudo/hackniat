import { useEffect, useState } from 'react'
import { adminApi } from '../../api/admin'
import { EYEBROW, MONO, PANEL } from '../drop/theme'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import Input, { PasswordInput, Select } from '../ui/Input'
import Modal from '../ui/Modal'
import { LoadingBlock } from '../ui/Spinner'

const MIN_PASSWORD = 6

/** Receipt rows, in this order. A 0 still shows: that piece was already empty. */
const DELETED_LABELS = [
  ['submissions', 'Submissions'],
  ['analysis', 'AI reports'],
  ['videos', 'Videos'],
  ['banners', 'Banners'],
  ['teams', 'Teams'],
  ['enrollments', 'Enrollments'],
  ['join_codes', 'Join codes'],
  ['github_jobs', 'GitHub jobs'],
  ['hackathon', 'Hackathon'],
]

const count = (value) => Number(value) || 0

function Counts({ preview }) {
  const rows = [
    ['Submissions', preview.submission_count],
    ['Teams', preview.team_count],
    ['Enrollments', preview.enrollment_count],
  ]
  return (
    <dl className="grid grid-cols-3 gap-3">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-drop border border-hairline bg-surface p-3">
          <dt className="text-[12px] text-muted">{label}</dt>
          <dd className={`${MONO} mt-1 text-[20px] font-semibold text-ink`}>{count(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Super Admin: delete one hackathon with everything attached to it —
 * submissions, videos, AI reports, scores, teams and enrollments. Student
 * accounts and other hackathons stay.
 *
 * Same safeguards as Reset Database: a preview of what goes, the Profile
 * Password, the hackathon's name typed back, and a final confirmation.
 *
 * Written without try/finally so the React Compiler can optimise it.
 */
export default function DeleteHackathonPanel() {
  const [hackathons, setHackathons] = useState(null)
  const [listError, setListError] = useState('')
  const [listNonce, setListNonce] = useState(0)

  const [selectedId, setSelectedId] = useState('')
  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState('')

  const [password, setPassword] = useState('')
  const [confirmName, setConfirmName] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    adminApi
      .listHackathonsForDeletion({ signal: controller.signal })
      .then((rows) => {
        if (!active) return
        setHackathons(Array.isArray(rows) ? rows : [])
        setListError('')
      })
      .catch((err) => {
        if (!active || err?.name === 'AbortError') return
        setListError(err?.message || 'Unable to load hackathons.')
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [listNonce])

  // A new selection aborts the previous preview request.
  useEffect(() => {
    if (!selectedId) return undefined
    const controller = new AbortController()
    let active = true
    adminApi
      .previewHackathonDeletion(selectedId, { signal: controller.signal })
      .then((payload) => {
        if (active) setPreview(payload)
      })
      .catch((err) => {
        if (!active || err?.name === 'AbortError') return
        setPreviewError(err?.message || 'Unable to load what would be deleted.')
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [selectedId])

  const select = (id) => {
    setSelectedId(id)
    setPreview(null)
    setPreviewError('')
    setConfirmName('')
    setPassword('')
    setError('')
    setReceipt(null)
  }

  const currentPreview = preview && preview.hackathon_id === selectedId ? preview : null
  const phrase = String(currentPreview?.name || '').trim() || selectedId
  const nameMatches = Boolean(currentPreview) && confirmName.trim() === phrase.trim()
  const canDelete = nameMatches && password.length >= MIN_PASSWORD && !deleting

  const submit = async () => {
    setDeleting(true)
    setError('')
    const hackathonId = selectedId
    const result = await adminApi
      .deleteHackathonData(hackathonId, {
        profile_password: password,
        confirm_name: confirmName.trim(),
      })
      .catch((err) => {
        if (err?.status === 404) {
          // Someone else already removed it: refresh the choices. (Clear the
          // selection first — select() also clears the error.)
          select('')
          setListNonce((value) => value + 1)
        }
        // The server's own text: wrong password, name mismatch, not found,
        // not a Super Admin.
        setError(err?.message || 'Unable to delete the hackathon.')
        return null
      })
    setDeleting(false)
    setConfirmOpen(false)
    if (!result) return

    setHackathons((rows) => (rows || []).filter((row) => row.hackathon_id !== hackathonId))
    select('')
    setReceipt(result)
  }

  const title = currentPreview?.name || phrase

  return (
    <section className={`${PANEL} min-w-0 overflow-hidden border-missing/30`}>
      <div className="flex items-start gap-3 border-b border-missing/20 bg-danger-soft px-4 py-4 sm:px-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-drop border border-missing/30 bg-surface text-missing">
          <Icon name="trash" size={18} />
        </span>
        <div>
          <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">Delete Hackathon</h3>
          <p className="mt-1 text-[13.5px] text-muted">
            Permanently deletes one hackathon with its submissions, videos, AI reports, scores,
            teams and enrollments. Student accounts and other hackathons stay.
          </p>
        </div>
      </div>

      <div className="stack-md p-5">
        {error && <Alert variant="danger">{error}</Alert>}

        {receipt && (
          <Alert variant="success" title={receipt.message || 'Hackathon deleted.'}>
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
              {DELETED_LABELS.map(([key, label]) => (
                <div key={key} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <dt>{label}</dt>
                  <dd className={MONO}>{count(receipt.deleted_counts?.[key])}</dd>
                </div>
              ))}
            </dl>
          </Alert>
        )}

        {listError ? (
          <Alert variant="danger" title="Unable to load hackathons">
            {listError}{' '}
            <button type="button" className="link-btn" onClick={() => setListNonce((v) => v + 1)}>
              Try again
            </button>
          </Alert>
        ) : !hackathons ? (
          <LoadingBlock label="Loading hackathons…" />
        ) : hackathons.length === 0 ? (
          <p className="rounded-drop border border-dashed border-hairline px-4 py-8 text-center text-[13.5px] text-muted">
            No hackathons to delete.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="stack-md">
              <Select
                label="Hackathon"
                value={selectedId}
                onChange={(event) => select(event.target.value)}
                disabled={deleting}
              >
                <option value="">Select a hackathon</option>
                {hackathons.map((row) => (
                  <option key={row.hackathon_id} value={row.hackathon_id}>
                    {row.name || row.hackathon_id}
                  </option>
                ))}
              </Select>

              {selectedId &&
                (previewError ? (
                  <Alert variant="danger">{previewError}</Alert>
                ) : !currentPreview ? (
                  <LoadingBlock label="Checking what would be deleted…" />
                ) : (
                  <div className="stack-sm">
                    <span className={EYEBROW}>What gets deleted</span>
                    <Counts preview={currentPreview} />
                    <Alert variant="warning">
                      Submissions, videos, AI reports, scores, teams and enrollments for this
                      hackathon will be removed. Student accounts stay. Other hackathons stay.
                    </Alert>
                  </div>
                ))}
            </div>

            <div className="stack-md">
              <PasswordInput
                label="Profile Password"
                autoComplete="off"
                required
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError('')
                }}
                disabled={!currentPreview || deleting}
              />
              <Input
                label={`Type ${phrase || 'the hackathon name'} to confirm`}
                value={confirmName}
                onChange={(event) => {
                  setConfirmName(event.target.value)
                  setError('')
                }}
                placeholder={phrase}
                autoComplete="off"
                spellCheck={false}
                disabled={!currentPreview || deleting}
                error={
                  confirmName.trim() && !nameMatches ? 'Enter the hackathon name exactly' : ''
                }
              />
              <Button
                variant="danger"
                block
                leftIcon={<Icon name="trash" size={16} />}
                disabled={!canDelete}
                onClick={() => {
                  setError('')
                  setConfirmOpen(true)
                }}
              >
                Delete hackathon
              </Button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => !deleting && setConfirmOpen(false)}
        title={`Delete ${title}?`}
        footer={
          <>
            <Button variant="ghost" disabled={deleting} onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={submit}>
              Yes, delete hackathon
            </Button>
          </>
        }
      >
        <div className="stack-md">
          {currentPreview && <Counts preview={currentPreview} />}
          <p>This cannot be undone. Student logins are kept.</p>
        </div>
      </Modal>
    </section>
  )
}
