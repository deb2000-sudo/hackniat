import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { authErrorCode } from '../../api/authErrors'
import { batchesApi, universitiesApi } from '../../api/universities'
import { useAsync } from '../../hooks/useAsync'
import { queryKeys } from '../../lib/queryKeys'
import { WRAP_APP } from '../../components/drop/theme'
import PageHeader from '../../components/layout/PageHeader'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Card, { CardBody } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import Input, { Select } from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { LoadingBlock } from '../../components/ui/Spinner'

/**
 * Batches students choose from at registration, managed one university at a
 * time.
 *
 * Only the picked university's batches are ever loaded. The selection lives in
 * the URL (`?university=`) so a refresh or a shared link lands on the same
 * campus. Reads share the register form's per-university cache key, and every
 * write forces a refetch so a new batch is offered to students straight away.
 *
 * Written without try/finally so the React Compiler can memoise the table.
 */
export default function BatchesPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const {
    data: universityData,
    loading: universitiesLoading,
    error: universitiesError,
  } = useAsync((options) => universitiesApi.list(options), {
    key: queryKeys.universities,
    staleTime: 30_000,
  })
  const universities = Array.isArray(universityData) ? universityData : []

  // A stale id in the URL (university since deleted) counts as no selection.
  const requestedId = searchParams.get('university') || ''
  const university = universities.find((entry) => String(entry.id) === requestedId) || null
  const universityId = university ? String(university.id) : ''

  const { data, loading, error, reload } = useAsync(
    // Tagged with the university it was fetched for: on a switch the hook
    // still holds the previous campus's rows until the new fetch lands, and
    // those must never be shown under the new name.
    (options) =>
      batchesApi.list(universityId, options).then((batches) => ({ universityId, batches })),
    {
      key: universityId ? queryKeys.universityBatches(universityId) : null,
      enabled: !!universityId,
      staleTime: 30_000,
    },
  )
  const current = data?.universityId === universityId
  const batches = current && Array.isArray(data.batches) ? data.batches : []
  const batchesError = universityId && (current || !loading) ? error : null
  const batchesLoading = !!universityId && !batchesError && (!current || (loading && !data))

  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const pickUniversity = (event) => {
    const value = event.target.value
    setSearchParams(value ? { university: value } : {}, { replace: true })
  }

  const openCreate = () => {
    setEditing({})
    setName('')
    setFormError('')
  }

  const openEdit = (batch) => {
    setEditing(batch)
    setName(batch.name || '')
    setFormError('')
  }

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setFormError('Batch name is required.')
      return
    }

    setSaving(true)
    setFormError('')

    const payload = { name: trimmed }
    const saved = await (editing?.id
      ? batchesApi.update(universityId, editing.id, payload)
      : batchesApi.create(universityId, payload)
    ).catch((err) => {
      setFormError(
        authErrorCode(err) === 'BATCH_EXISTS'
          ? `${university?.display_label || 'This university'} already has a batch named “${trimmed}”.`
          : err?.message || 'Unable to save this batch.',
      )
      return null
    })

    setSaving(false)
    if (!saved) return

    setEditing(null)
    reload({ force: true })
  }

  const remove = async () => {
    if (!deleting) return
    setSaving(true)
    setFormError('')

    const done = await batchesApi.delete(universityId, deleting.id).then(
      () => true,
      (err) => {
        setFormError(err?.message || 'Unable to delete this batch.')
        return false
      },
    )

    setSaving(false)
    if (!done) return

    setDeleting(null)
    reload({ force: true })
  }

  const addButton = (
    <Button
      variant="accent"
      onClick={openCreate}
      disabled={!universityId}
      leftIcon={<Icon name="plus" size={17} />}
    >
      Add batch
    </Button>
  )

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <PageHeader
        eyebrow="Administration"
        title="Batch Management"
        description="Batches students choose from when they register, per university."
        actions={addButton}
      />

      {universitiesError && (
        <div className="mb-6">
          <Alert variant="danger" title="Unable to load universities">
            {universitiesError.message}
          </Alert>
        </div>
      )}

      <div className="mb-6" style={{ maxWidth: 420 }}>
        <Select
          label="University"
          value={universityId}
          onChange={pickUniversity}
          disabled={universitiesLoading && !universityData}
        >
          <option value="" disabled>
            {universitiesLoading && !universityData ? 'Loading universities…' : 'Select university'}
          </option>
          {universities.map((entry) => (
            <option key={entry.id} value={String(entry.id)}>
              {entry.display_label}
            </option>
          ))}
        </Select>
      </div>

      {!universityId ? (
        !universitiesLoading && !universitiesError && (
          <Card>
            <CardBody>
              <EmptyState
                icon="university"
                title={universities.length ? 'Pick a university' : 'No universities yet'}
                description={
                  universities.length
                    ? 'Choose a university to see and manage its batches.'
                    : 'Add a university in University Management before creating batches.'
                }
              />
            </CardBody>
          </Card>
        )
      ) : batchesError ? (
        <Alert variant="danger" title="Unable to load batches">
          {batchesError.message}
        </Alert>
      ) : batchesLoading ? (
        <LoadingBlock label="Loading batches…" />
      ) : batches.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Batch</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td style={{ fontWeight: 600 }}>{batch.name}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => openEdit(batch)}
                        aria-label={`Rename ${batch.name}`}
                      >
                        <Icon name="edit" size={17} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        onClick={() => {
                          setFormError('')
                          setDeleting(batch)
                        }}
                        aria-label={`Delete ${batch.name}`}
                      >
                        <Icon name="trash" size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Card>
          <CardBody>
            <EmptyState
              icon="calendar"
              title="No batches yet"
              description={`Students cannot register under ${university.display_label} until it has a batch.`}
              action={addButton}
            />
          </CardBody>
        </Card>
      )}

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? 'Rename batch' : 'Add batch'}
        footer={
          <>
            <Button variant="ghost" disabled={saving} onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="accent" loading={saving} onClick={save}>
              {editing?.id ? 'Save changes' : 'Add batch'}
            </Button>
          </>
        }
      >
        <div className="stack-md">
          {formError && <Alert variant="danger">{formError}</Alert>}
          <p className="text-sm text-muted">
            University: <strong>{university?.display_label}</strong>
          </p>
          <Input
            label="Batch name"
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            hint="Must be unique within this university, e.g. 2024-2028."
            placeholder="2024-2028"
          />
        </div>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => !saving && setDeleting(null)}
        title="Delete batch"
        footer={
          <>
            <Button variant="ghost" disabled={saving} onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={saving} onClick={remove}>
              Delete batch
            </Button>
          </>
        }
      >
        <div className="stack-md">
          {formError && <Alert variant="danger">{formError}</Alert>}
          <p>
            Delete <strong>{deleting?.name}</strong> from{' '}
            <strong>{university?.display_label}</strong>? Students can no longer register under
            this batch. Students already registered keep it on their profile.
          </p>
        </div>
      </Modal>
    </div>
  )
}
