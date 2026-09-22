import { useState } from 'react'
import { universitiesApi } from '../../api/universities'
import { useAsync } from '../../hooks/useAsync'
import { queryKeys } from '../../lib/queryKeys'
import { WRAP_APP } from '../../components/drop/theme'
import PageHeader from '../../components/layout/PageHeader'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Card, { CardBody } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { LoadingBlock } from '../../components/ui/Spinner'

const EMPTY_FORM = { name: '', location: '' }

/**
 * Campus catalogue behind the student register form.
 *
 * Students pick from this list rather than typing a university, so a campus
 * missing here is a campus nobody can register under — hence the empty state
 * says so plainly. Reads share the register form's cache key, and every write
 * forces a refetch so a rename shows up straight away instead of after the
 * cache goes stale.
 *
 * Written without try/finally so the React Compiler can memoise the table.
 */
export default function UniversitiesPage() {
  const { data, loading, error, reload } = useAsync(
    (options) => universitiesApi.list(options),
    { key: queryKeys.universities, staleTime: 30_000 },
  )

  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const universities = Array.isArray(data) ? data : []

  const openCreate = () => {
    setEditing({})
    setForm(EMPTY_FORM)
    setFormError('')
  }

  const openEdit = (university) => {
    setEditing(university)
    setForm({ name: university.name || '', location: university.location || '' })
    setFormError('')
  }

  const save = async () => {
    const name = form.name.trim()
    const location = form.location.trim()
    if (!name) {
      setFormError('University name is required.')
      return
    }
    if (!location) {
      setFormError('Location is required.')
      return
    }

    setSaving(true)
    setFormError('')

    const payload = { name, location }
    const saved = await (editing?.id
      ? universitiesApi.update(editing.id, payload)
      : universitiesApi.create(payload)
    ).catch((err) => {
      setFormError(err?.message || 'Unable to save this university.')
      return null
    })

    setSaving(false)
    if (!saved) return

    setEditing(null)
    // Forced: the list is cached, and without this a rename would keep
    // showing the old label until the entry went stale.
    reload({ force: true })
  }

  const remove = async () => {
    if (!deleting) return
    setSaving(true)
    setFormError('')

    const done = await universitiesApi.delete(deleting.id).then(
      () => true,
      (err) => {
        setFormError(err?.message || 'Unable to delete this university.')
        return false
      },
    )

    setSaving(false)
    if (!done) return

    setDeleting(null)
    reload({ force: true })
  }

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <PageHeader
        eyebrow="Administration"
        title="Universities"
        description="Campuses students choose from when they register."
        actions={
          <Button variant="accent" onClick={openCreate} leftIcon={<Icon name="plus" size={17} />}>
            Add university
          </Button>
        }
      />

      {error && (
        <div className="mb-6">
          <Alert variant="danger" title="Unable to load universities">
            {error.message}
          </Alert>
        </div>
      )}

      {loading && !data ? (
        <LoadingBlock label="Loading universities…" />
      ) : universities.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {universities.map((university) => (
                <tr key={university.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{university.name}</div>
                    {/* The label students see on the register form. */}
                    <div className="text-xs text-muted">{university.display_label}</div>
                  </td>
                  <td>{university.location}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => openEdit(university)}
                        aria-label={`Edit ${university.name}`}
                      >
                        <Icon name="edit" size={17} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        onClick={() => {
                          setFormError('')
                          setDeleting(university)
                        }}
                        aria-label={`Delete ${university.name}`}
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
      ) : !error ? (
        <Card>
          <CardBody>
            <EmptyState
              icon="university"
              title="No universities yet"
              description="No universities yet. Add one so students can register."
              action={
                <Button variant="accent" onClick={openCreate} leftIcon={<Icon name="plus" size={17} />}>
                  Add university
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : null}

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? 'Edit university' : 'Add university'}
        footer={
          <>
            <Button variant="ghost" disabled={saving} onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="accent" loading={saving} onClick={save}>
              {editing?.id ? 'Save changes' : 'Add university'}
            </Button>
          </>
        }
      >
        <div className="stack-md">
          {formError && <Alert variant="danger">{formError}</Alert>}
          <Input
            label="University name"
            required
            maxLength={200}
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="NIAT"
          />
          <Input
            label="Location"
            required
            maxLength={200}
            value={form.location}
            onChange={(event) =>
              setForm((current) => ({ ...current, location: event.target.value }))
            }
            hint="City or campus, e.g. Hyderabad."
            placeholder="Hyderabad"
          />
        </div>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => !saving && setDeleting(null)}
        title="Delete university"
        footer={
          <>
            <Button variant="ghost" disabled={saving} onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={saving} onClick={remove}>
              Delete university
            </Button>
          </>
        }
      >
        <div className="stack-md">
          {formError && <Alert variant="danger">{formError}</Alert>}
          <p>
            Delete <strong>{deleting?.display_label || deleting?.name}</strong>? Students can no
            longer register under this campus.
          </p>
        </div>
      </Modal>
    </div>
  )
}
