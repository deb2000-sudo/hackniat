import { useState } from 'react'
import { themesApi } from '../../api/themes'
import { useAsync } from '../../hooks/useAsync'
import { formatDateTime } from '../../utils/format'
import { WRAP_APP } from '../../components/drop/theme'
import PageHeader from '../../components/layout/PageHeader'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Card, { CardBody } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import Input, { Textarea } from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { LoadingBlock } from '../../components/ui/Spinner'

const EMPTY_FORM = { name: '', description: '' }

export default function ThemesPage() {
  const { data, loading, error, setData } = useAsync(() => themesApi.list())
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const openCreate = () => {
    setEditing({})
    setForm(EMPTY_FORM)
    setFormError('')
  }

  const openEdit = (theme) => {
    setEditing(theme)
    setForm({ name: theme.name || '', description: theme.description || '' })
    setFormError('')
  }

  const save = async () => {
    if (!form.name.trim()) {
      setFormError('Theme name is required.')
      return
    }
    if (!form.description.trim()) {
      setFormError('Theme description is required.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
      }
      const saved = editing?.id
        ? await themesApi.update(editing.id, payload)
        : await themesApi.create(payload)
      setData((current) =>
        editing?.id
          ? current.map((theme) => theme.id === saved.id ? saved : theme)
          : [saved, ...(current || [])],
      )
      setEditing(null)
    } catch (saveError) {
      setFormError(saveError.message || 'Unable to save theme.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleting) return
    setSaving(true)
    setFormError('')
    try {
      await themesApi.delete(deleting.id)
      setData((current) => current.filter((theme) => theme.id !== deleting.id))
      setDeleting(null)
    } catch (deleteError) {
      setFormError(deleteError.message || 'Unable to delete theme.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`${WRAP_APP} py-7 md:py-10 themes-page`}>
      <PageHeader
        eyebrow="Hackathon setup"
        title="Themes"
        description="Create reusable themes and release selected themes for each hackathon."
        actions={
          <Button variant="accent" onClick={openCreate} leftIcon={<Icon name="plus" size={17} />}>
            Create theme
          </Button>
        }
      />

      {error && <Alert variant="danger" title="Unable to load themes">{error.message}</Alert>}

      {loading && !data ? (
        <LoadingBlock label="Loading themes…" />
      ) : data?.length ? (
        <div className="themes-grid">
          {data.map((theme) => (
            <Card className="theme-card" key={theme.id}>
              <CardBody>
                <div className="theme-card__top">
                  <span><Icon name="sparkles" size={20} /></span>
                  <div className="row">
                    <button type="button" className="icon-btn" onClick={() => openEdit(theme)} aria-label={`Edit ${theme.name}`}>
                      <Icon name="edit" size={17} />
                    </button>
                    <button type="button" className="icon-btn icon-btn--danger" onClick={() => { setFormError(''); setDeleting(theme) }} aria-label={`Delete ${theme.name}`}>
                      <Icon name="trash" size={17} />
                    </button>
                  </div>
                </div>
                <h3>{theme.name}</h3>
                <p>{theme.description || 'No description provided.'}</p>
                <small>Updated {formatDateTime(theme.updated_at)}</small>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : !error ? (
        <Card><CardBody><EmptyState icon="sparkles" title="No themes yet" description="Create the first theme, then attach it to a hackathon." action={<Button variant="accent" onClick={openCreate}>Create theme</Button>} /></CardBody></Card>
      ) : null}

      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? 'Edit theme' : 'Create theme'}
        footer={
          <>
            <Button variant="ghost" disabled={saving} onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="accent" loading={saving} onClick={save}>{editing?.id ? 'Save changes' : 'Create theme'}</Button>
          </>
        }
      >
        <div className="stack-md">
          {formError && <Alert variant="danger">{formError}</Alert>}
          <Input label="Theme name" required maxLength={200} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="AI for Healthcare" />
          <Textarea label="Description" required maxLength={5000} rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe the challenge area and intended impact." />
        </div>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => !saving && setDeleting(null)}
        title="Delete theme"
        footer={
          <>
            <Button variant="ghost" disabled={saving} onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" loading={saving} onClick={remove}>Delete theme</Button>
          </>
        }
      >
        <div className="stack-md">
          {formError && <Alert variant="danger">{formError}</Alert>}
          <p>Delete <strong>{deleting?.name}</strong>? Hackathons referencing this theme may need to be updated.</p>
        </div>
      </Modal>
    </div>
  )
}
