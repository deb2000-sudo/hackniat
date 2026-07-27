import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { ROLES } from '../../utils/constants'
import { formatDate } from '../../utils/format'
import { getHackathonDuration, getHackathonStatus } from '../../utils/hackathons'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card, { CardBody } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import { LoadingBlock } from '../../components/ui/Spinner'

const FILTERS = [
  { key: 'all', label: 'All events' },
  { key: 'live', label: 'Live' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Completed' },
]

export default function HackathonsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === ROLES.ADMIN
  const { data, loading, error, reload } = useAsync(() => hackathonsApi.list())
  const [filter, setFilter] = useState('all')
  const hackathons = useMemo(
    () =>
      (data || [])
        .map((hackathon) => ({ ...hackathon, eventStatus: getHackathonStatus(hackathon) }))
        .filter((hackathon) => filter === 'all' || hackathon.eventStatus.key === filter)
        .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [data, filter],
  )

  return (
    <div className="container page hackathons-page">
      <section className="hackathons-hero">
        <div className="hackathons-hero__content">
          <span className="hackathons-hero__icon"><Icon name="trophy" size={26} /></span>
          <div>
            <div className="eyebrow">HackNIAT events</div>
            <h1>Build. Compete. Make an impact.</h1>
            <p>Discover active and upcoming hackathons, timelines, rewards, and participation guidelines.</p>
          </div>
        </div>
        <div className="hackathons-hero__actions">
          <Button variant="secondary" onClick={reload} loading={loading} leftIcon={<Icon name="refresh" size={18} />}>
            Refresh
          </Button>
          {isAdmin && (
            <Button as={Link} to="/admin/hackathons/new" variant="accent" leftIcon={<Icon name="plus" size={18} />}>
              Create hackathon
            </Button>
          )}
        </div>
      </section>

      {error && (
        <div style={{ marginBottom: 24 }}>
          <Alert variant="danger" title="Unable to load hackathons">{error.message}</Alert>
        </div>
      )}

      <div className="hackathon-toolbar">
        <div>
          <h2>Explore hackathons</h2>
          <p className="text-sm text-muted">{data?.length || 0} event{data?.length === 1 ? '' : 's'} available</p>
        </div>
        <div className="filter-pills" role="group" aria-label="Filter hackathons">
          {FILTERS.map((item) => (
            <button
              type="button"
              key={item.key}
              className={`filter-pill ${filter === item.key ? 'filter-pill--active' : ''}`}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading hackathons…" />
      ) : hackathons.length ? (
        <div className="hackathon-grid">
          {hackathons.map((hackathon) => {
            const duration = getHackathonDuration(hackathon.start_date, hackathon.end_date)
            return (
              <Card hover className="hackathon-card" key={hackathon.id}>
                <div className="hackathon-card__media">
                  {hackathon.banner_url ? (
                    <img className="hackathon-card__banner" src={hackathon.banner_url} alt={`${hackathon.name} banner`} />
                  ) : (
                    <div className="hackathon-card__banner hackathon-card__banner--empty">
                      <Icon name="sparkles" size={40} />
                    </div>
                  )}
                  <div className="hackathon-card__shade" />
                  <Badge variant={hackathon.eventStatus.variant} dot className="hackathon-card__status">
                    {hackathon.eventStatus.label}
                  </Badge>
                </div>
                <CardBody className="stack-md">
                  <div>
                    <h3 className="hackathon-card__title">{hackathon.name}</h3>
                    <div className="hackathon-card__meta">
                      <span><Icon name="calendar" size={15} />{formatDate(hackathon.start_date)} – {formatDate(hackathon.end_date)}</span>
                      <span><Icon name="clock" size={15} />{duration ? `${duration} days` : 'Dates announced'}</span>
                      <span><Icon name="chart" size={15} />{hackathon.timeline?.length || 0} rounds</span>
                    </div>
                  </div>
                  <p className="text-sm hackathon-card__description">{hackathon.description}</p>
                  {!!hackathon.themes?.length && (
                    <div className="hackathon-card__themes">
                      {hackathon.themes.map((theme) => (
                        <span key={theme.id}>{theme.name}</span>
                      ))}
                    </div>
                  )}
                  <div className="hackathon-card__footer">
                    <div className="hackathon-card__prize">
                      <Icon name="trophy" size={18} />
                      <span><small>Top prize</small><strong>{hackathon.prizes?.winner || 'To be announced'}</strong></span>
                    </div>
                    <Button as={Link} to={`/hackathons/${hackathon.id}`} variant="ghost" size="sm" rightIcon={<Icon name="arrowRight" size={16} />}>
                      Explore
                    </Button>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="hackathon-empty-card">
          <CardBody>
            <EmptyState
              icon="calendar"
              title={filter === 'all' ? 'No hackathons yet' : `No ${filter} hackathons`}
              description={filter === 'all' ? 'New hackathons will appear here when published.' : 'Choose a different filter to explore other events.'}
              action={isAdmin && filter === 'all' ? (
                <Button as={Link} to="/admin/hackathons/new" variant="accent" leftIcon={<Icon name="plus" size={18} />}>Create hackathon</Button>
              ) : undefined}
            />
          </CardBody>
        </Card>
      )}
    </div>
  )
}
