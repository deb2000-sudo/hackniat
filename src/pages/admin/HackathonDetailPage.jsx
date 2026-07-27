import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { hackathonsApi } from '../../api/hackathons'
import { evaluationRequirementsApi } from '../../api/evaluationRequirements'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { ROLES } from '../../utils/constants'
import { formatDate } from '../../utils/format'
import { getHackathonDuration, getHackathonStatus } from '../../utils/hackathons'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card, { CardBody, CardHeader } from '../../components/ui/Card'
import Icon from '../../components/ui/Icon'
import Modal from '../../components/ui/Modal'
import { LoadingBlock } from '../../components/ui/Spinner'

const PRIZES = [
  { key: 'winner', label: 'Winner', place: '1', className: 'prize-card--1' },
  { key: 'first_runner_up', label: 'First runner-up', place: '2', className: 'prize-card--2' },
  { key: 'second_runner_up', label: 'Second runner-up', place: '3', className: 'prize-card--3' },
]

export default function HackathonDetailPage() {
  const { hackathonId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === ROLES.ADMIN
  const { data: hackathon, loading, error } = useAsync(() => hackathonsApi.get(hackathonId))
  const { data: requirements } = useAsync(() => evaluationRequirementsApi.list())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const remove = async () => {
    setDeleting(true)
    setDeleteError('')
    try {
      await hackathonsApi.delete(hackathonId)
      navigate('/hackathons', { replace: true })
    } catch (err) {
      setDeleteError(err.message || 'Unable to delete the hackathon.')
      setDeleting(false)
    }
  }

  if (loading) return <div className="container page"><LoadingBlock label="Loading hackathon…" /></div>

  if (error || !hackathon) {
    return (
      <div className="container container--narrow page stack-md">
        <Alert variant="danger" title="Unable to load hackathon">{error?.message || 'Hackathon not found.'}</Alert>
        <div><Button as={Link} to="/hackathons" variant="secondary">Back to hackathons</Button></div>
      </div>
    )
  }

  const status = getHackathonStatus(hackathon)
  const duration = getHackathonDuration(hackathon.start_date, hackathon.end_date)

  return (
    <div className="container page hackathon-detail-page">
      <section className={`hackathon-detail-hero ${hackathon.banner_url ? '' : 'hackathon-detail-hero--empty'}`}>
        {hackathon.banner_url && <img className="hackathon-detail-hero__image" src={hackathon.banner_url} alt="" />}
        <div className="hackathon-detail-hero__overlay" />
        <div className="hackathon-detail-hero__topbar">
          <Button as={Link} to="/hackathons" variant="secondary" size="sm" leftIcon={<Icon name="arrowLeft" size={17} />}>All hackathons</Button>
          {isAdmin && (
            <div className="row">
              <Button as={Link} to={`/admin/hackathons/${hackathon.id}/edit`} variant="secondary" size="sm" leftIcon={<Icon name="edit" size={16} />}>Edit</Button>
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)} leftIcon={<Icon name="trash" size={16} />}>Delete</Button>
            </div>
          )}
        </div>
        <div className="hackathon-detail-hero__content">
          <Badge variant={status.variant} dot>{status.label}</Badge>
          <h1>{hackathon.name}</h1>
          <p>{hackathon.description}</p>
          <div className="hackathon-detail-hero__meta">
            <span><Icon name="calendar" size={18} />{formatDate(hackathon.start_date)} – {formatDate(hackathon.end_date)}</span>
            <span><Icon name="clock" size={18} />{duration ? `${duration} event days` : 'Schedule announced'}</span>
          </div>
        </div>
      </section>

      <div className="hackathon-summary-grid">
        <div className="hackathon-summary-item">
          <span className="hackathon-summary-item__icon"><Icon name="calendar" size={21} /></span>
          <span><small>Starts on</small><strong>{formatDate(hackathon.start_date)}</strong></span>
        </div>
        <div className="hackathon-summary-item">
          <span className="hackathon-summary-item__icon"><Icon name="chart" size={21} /></span>
          <span><small>Competition format</small><strong>{hackathon.timeline?.length || 0} timeline rounds</strong></span>
        </div>
        <div className="hackathon-summary-item">
          <span className="hackathon-summary-item__icon"><Icon name="trophy" size={21} /></span>
          <span><small>Winner takes</small><strong>{hackathon.prizes?.winner || 'To be announced'}</strong></span>
        </div>
      </div>

      <div className="stack-lg">
        <Card className="hackathon-section-card">
          <CardHeader>
            <div className="section-title-with-icon"><span><Icon name="gift" size={20} /></span><div><h3>Prize pool</h3><p>Rewards for the top-performing teams</p></div></div>
          </CardHeader>
          <CardBody>
            <div className="prize-grid">
              {PRIZES.map((prize) => (
                <div className={`prize-card ${prize.className}`} key={prize.key}>
                  <span className="prize-card__place">{prize.place}</span>
                  <Icon name="trophy" size={28} />
                  <span className="prize-card__label">{prize.label}</span>
                  <strong>{hackathon.prizes?.[prize.key] || '—'}</strong>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="hackathon-section-card">
          <CardHeader>
            <div className="section-title-with-icon"><span><Icon name="calendar" size={20} /></span><div><h3>Event timeline</h3><p>Key rounds and milestones</p></div></div>
          </CardHeader>
          <CardBody>
            {hackathon.timeline?.length ? (
              <ol className="hackathon-timeline">
                {hackathon.timeline.map((round, index) => (
                  <li key={`${round.title}-${index}`}>
                    <span className="hackathon-timeline__marker">{String(index + 1).padStart(2, '0')}</span>
                    <div className="hackathon-timeline__content">
                      <div className="row-between wrap">
                        <h3>{round.title}</h3>
                        {(round.start_date || round.end_date) && (
                          <span className="hackathon-timeline__date">
                            <Icon name="calendar" size={14} />
                            {round.start_date ? formatDate(round.start_date) : 'Date TBD'}
                            {round.end_date ? ` – ${formatDate(round.end_date)}` : ''}
                          </span>
                        )}
                      </div>
                      {round.description && <p>{round.description}</p>}
                      {round.evaluation_requirement_id && (() => {
                        const requirement = requirements?.find(
                          (item) => item.id === round.evaluation_requirement_id,
                        )
                        return (
                          <div className="round-requirement">
                            <div className="round-requirement__title">
                              <Icon name="clipboard" size={15} />
                              <span>
                                {requirement?.name || 'Linked evaluation requirement'}
                              </span>
                              <small>{requirement?.fields?.length || 0} fields</small>
                            </div>
                            {!!requirement?.fields?.length && (
                              <div className="round-requirement__fields">
                                {requirement.fields.map((field) => (
                                  <span key={field.key || field.label}>
                                    {field.label}
                                    {field.is_required && <strong aria-label="required">*</strong>}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="hackathon-inline-empty"><Icon name="clock" size={24} /><span>Timeline details will be announced soon.</span></div>
            )}
          </CardBody>
        </Card>

        <Card className="hackathon-section-card">
          <CardHeader>
            <div className="section-title-with-icon"><span><Icon name="clipboard" size={20} /></span><div><h3>Participation guidelines</h3><p>Everything teams need to know</p></div></div>
          </CardHeader>
          <CardBody>
            <div className="markdown-body hackathon-guidelines">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{hackathon.guidelines}</ReactMarkdown>
            </div>
          </CardBody>
        </Card>
      </div>

      {isAdmin && (
        <Modal
          open={confirmDelete}
          onClose={() => !deleting && setConfirmDelete(false)}
          title="Delete hackathon"
          footer={
            <>
              <Button variant="ghost" disabled={deleting} onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button variant="danger" loading={deleting} onClick={remove}>Delete permanently</Button>
            </>
          }
        >
          <div className="stack-md">
            {deleteError && <Alert variant="danger">{deleteError}</Alert>}
            <p>Delete <strong>{hackathon.name}</strong>? This action cannot be undone.</p>
          </div>
        </Modal>
      )}
    </div>
  )
}
