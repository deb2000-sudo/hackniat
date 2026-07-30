import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { evaluationRequirementsApi } from '../../api/evaluationRequirements'
import { useAsync } from '../../hooks/useAsync'
import { formatDateTime } from '../../utils/format'
import { WRAP_APP } from '../../components/drop/theme'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Card, { CardBody } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { LoadingBlock } from '../../components/ui/Spinner'

export default function EvaluationRequirementsPage() {
  const { data, loading, error, reload, setData } = useAsync(() =>
    evaluationRequirementsApi.list(),
  )
  const [query, setQuery] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const requirements = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return [...(data || [])]
      .filter((item) =>
        !needle ||
        item.name.toLowerCase().includes(needle) ||
        item.description?.toLowerCase().includes(needle),
      )
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
  }, [data, query])

  const remove = async () => {
    if (!deleting) return
    setDeleteError('')
    setDeleteBusy(true)
    try {
      await evaluationRequirementsApi.delete(deleting.id)
      setData((current) => current.filter((item) => item.id !== deleting.id))
      setDeleting(null)
    } catch (removeError) {
      setDeleteError(removeError.message || 'Unable to delete this requirement.')
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className={`${WRAP_APP} py-7 md:py-10 requirements-page`}>
      <section className="requirements-hero">
        <div>
          <div className="eyebrow">Evaluation setup</div>
          <h1>Evaluation requirements</h1>
          <p>Create reusable field sets, attach them to rounds, and configure how AI scores each response.</p>
        </div>
        <Button
          as={Link}
          to="/admin/evaluation-requirements/new"
          variant="accent"
          leftIcon={<Icon name="plus" size={18} />}
        >
          Create requirement
        </Button>
      </section>

      {error && (
        <Alert variant="danger" title="Unable to load requirements">
          {error.message}
          <div className="alert-action"><Button size="sm" variant="ghost" onClick={reload}>Try again</Button></div>
        </Alert>
      )}

      <div className="requirements-toolbar">
        <div>
          <h2>Reusable field sets</h2>
          <p>{data?.length || 0} {data?.length === 1 ? 'requirement' : 'requirements'}</p>
        </div>
        <div className="requirements-search">
          <Icon name="search" size={17} />
          <Input
            aria-label="Search requirements"
            placeholder="Search requirements"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading evaluation requirements…" />
      ) : requirements.length ? (
        <div className="requirements-grid">
          {requirements.map((requirement) => (
            <Card className="requirement-list-card" key={requirement.id}>
              <CardBody>
                <div className="requirement-list-card__top">
                  <span><Icon name="clipboard" size={21} /></span>
                  <div className="requirement-list-card__actions">
                    <Button
                      as={Link}
                      to={`/admin/evaluation-requirements/${requirement.id}/edit`}
                      variant="ghost"
                      size="sm"
                      leftIcon={<Icon name="edit" size={15} />}
                    >
                      Edit
                    </Button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      onClick={() => {
                        setDeleteError('')
                        setDeleting(requirement)
                      }}
                      aria-label={`Delete ${requirement.name}`}
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  </div>
                </div>
                <h3>{requirement.name}</h3>
                <p className="requirement-list-card__description">
                  {requirement.description || 'No description provided.'}
                </p>
                <div className="requirement-list-card__fields">
                  {(requirement.fields || []).slice(0, 4).map((field) => (
                    <span key={field.key || field.label}>{field.label}</span>
                  ))}
                  {requirement.fields?.length > 4 && (
                    <span>+{requirement.fields.length - 4} more</span>
                  )}
                </div>
                <div className="requirement-list-card__footer">
                  <span>
                    <strong>{requirement.fields?.length || 0}</strong>{' '}
                    {requirement.fields?.length === 1 ? 'field' : 'fields'}
                  </span>
                  <span>Updated {formatDateTime(requirement.updated_at)}</span>
                </div>
                <Button
                  as={Link}
                  to={`/admin/evaluation-requirements/${requirement.id}/ai-scoring`}
                  variant="secondary"
                  block
                  leftIcon={<Icon name="sparkles" size={17} />}
                >
                  Set AI scoring
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : !error ? (
        <Card>
          <CardBody>
            <EmptyState
              icon="clipboard"
              title={query ? 'No matching requirements' : 'No evaluation requirements yet'}
              description={
                query
                  ? 'Try a different search term.'
                  : 'Create a reusable set of fields, then attach it to one or more hackathon rounds.'
              }
              action={!query ? (
                <Button
                  as={Link}
                  to="/admin/evaluation-requirements/new"
                  variant="accent"
                  leftIcon={<Icon name="plus" size={17} />}
                >
                  Create requirement
                </Button>
              ) : undefined}
            />
          </CardBody>
        </Card>
      ) : null}

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete evaluation requirement"
        footer={
          <>
            <Button variant="ghost" disabled={deleteBusy} onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" loading={deleteBusy} onClick={remove}>
              Delete requirement
            </Button>
          </>
        }
      >
        <div className="stack-md">
          {deleteError && <Alert variant="danger">{deleteError}</Alert>}
          <p>
            Delete <strong>{deleting?.name}</strong>? Existing rounds may still reference this ID.
          </p>
        </div>
      </Modal>
    </div>
  )
}
