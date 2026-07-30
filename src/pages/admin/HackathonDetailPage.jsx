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
import {
  BADGE,
  BADGE_CLOSED,
  BADGE_CLOSING,
  BADGE_OPEN,
  BTN_GHOST,
  EYEBROW,
  MONO,
  PANEL,
  WRAP_APP,
} from '../../components/drop/theme'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import Modal from '../../components/ui/Modal'
import { LoadingBlock } from '../../components/ui/Spinner'

const PRIZES = [
  { key: 'winner', label: 'Winner', place: '01' },
  { key: 'first_runner_up', label: 'First runner-up', place: '02' },
  { key: 'second_runner_up', label: 'Second runner-up', place: '03' },
]

function statusBadge(key) {
  if (key === 'live') return BADGE_OPEN
  if (key === 'upcoming') return BADGE_CLOSING
  return BADGE_CLOSED
}

function SectionHeader({ icon, title, description }) {
  return (
    <div className="flex items-start gap-3 border-b border-hairline px-4 py-4 sm:px-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-drop border border-hairline bg-raised text-volt">
        <Icon name={icon} size={18} />
      </span>
      <div>
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
        <p className="mt-0.5 text-[13px] text-muted">{description}</p>
      </div>
    </div>
  )
}

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

  if (loading) {
    return (
      <div className={`${WRAP_APP} py-7 md:py-10`}>
        <LoadingBlock label="Loading hackathon…" />
      </div>
    )
  }

  if (error || !hackathon) {
    return (
      <div className={`${WRAP_APP} py-7 md:py-10`}>
        <Alert variant="danger" title="Unable to load hackathon">
          {error?.message || 'Hackathon not found.'}
        </Alert>
        <div className="mt-5">
          <Link to="/hackathons" className={BTN_GHOST}>
            <Icon name="arrowLeft" size={17} />
            Back to hackathons
          </Link>
        </div>
      </div>
    )
  }

  const status = getHackathonStatus(hackathon)
  const duration = getHackathonDuration(hackathon.start_date, hackathon.end_date)
  const summary = [
    {
      icon: 'calendar',
      label: 'Starts on',
      value: formatDate(hackathon.start_date),
    },
    {
      icon: 'chart',
      label: 'Competition format',
      value: `${hackathon.timeline?.length || 0} timeline rounds`,
    },
    {
      icon: 'trophy',
      label: 'Winner takes',
      value: hackathon.prizes?.winner || 'To be announced',
    },
  ]

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <section
        className={`${PANEL} relative mb-6 min-h-[360px] overflow-hidden md:mb-8 md:min-h-[420px]`}
      >
        {hackathon.banner_url ? (
          <img
            className="absolute inset-0 size-full object-cover"
            src={hackathon.banner_url}
            alt=""
          />
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-[#141418] via-[#1c1c22] to-[#24242c]" />
        )}
        <div className="absolute inset-0 bg-linear-to-r from-canvas via-canvas/80 to-canvas/25" />
        <div className="absolute inset-0 bg-linear-to-t from-canvas via-transparent to-canvas/40" />

        <div className="relative z-1 flex h-full min-h-[360px] flex-col justify-between gap-8 p-5 md:min-h-[420px] md:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <Link to="/hackathons" className={`${BTN_GHOST} w-full bg-surface/80 backdrop-blur-sm sm:w-auto`}>
              <Icon name="arrowLeft" size={17} />
              All hackathons
            </Link>
            {isAdmin && (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Link
                  to={`/admin/hackathons/${hackathon.id}/edit`}
                  className={`${BTN_GHOST} w-full bg-surface/80 backdrop-blur-sm sm:w-auto`}
                >
                  <Icon name="edit" size={16} />
                  Edit
                </Link>
                <button
                  type="button"
                  className={`${BTN_GHOST} w-full border-transparent bg-surface/80 text-[#ff8a8a] backdrop-blur-sm hover:border-[#5a2222] hover:bg-[#2a1010] sm:w-auto`}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Icon name="trash" size={16} />
                  Delete
                </button>
              </div>
            )}
          </div>

          <div className="max-w-3xl">
            <span className={`${BADGE} ${statusBadge(status.key)}`}>{status.label}</span>
            <h1 className="mt-4 text-[32px] font-semibold tracking-[-0.035em] text-ink md:text-[48px] md:leading-[1.05]">
              {hackathon.name}
            </h1>
            {hackathon.description ? (
              <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-muted md:text-[16px]">
                {hackathon.description}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] font-medium text-ink/90">
              <span className="inline-flex items-center gap-2">
                <Icon name="calendar" size={17} />
                {formatDate(hackathon.start_date)} – {formatDate(hackathon.end_date)}
              </span>
              <span className="inline-flex items-center gap-2">
                <Icon name="clock" size={17} />
                {duration ? `${duration} event days` : 'Schedule announced'}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 md:mb-8 md:gap-4">
        {summary.map((item) => (
          <div key={item.label} className={`${PANEL} flex items-center gap-3.5 p-4`}>
            <span className="grid size-11 shrink-0 place-items-center rounded-drop border border-hairline bg-raised text-volt">
              <Icon name={item.icon} size={20} />
            </span>
            <div className="min-w-0">
              <div className={EYEBROW}>{item.label}</div>
              <div className="mt-1 truncate text-[15px] font-semibold tracking-[-0.015em] text-ink">
                {item.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-5 md:gap-6">
        <section className={PANEL}>
          <SectionHeader
            icon="gift"
            title="Prize pool"
            description="Rewards for the top-performing teams"
          />
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 sm:p-5">
            {PRIZES.map((prize) => (
              <div
                key={prize.key}
                className="relative overflow-hidden rounded-drop border border-hairline bg-raised p-5"
              >
                <span
                  className={`${MONO} absolute top-3 right-3 text-[28px] font-semibold leading-none text-ink/10`}
                >
                  {prize.place}
                </span>
                <span className="grid size-10 place-items-center rounded-drop border border-volt-edge bg-volt-tint text-volt">
                  <Icon name="trophy" size={18} />
                </span>
                <div className={`${EYEBROW} mt-4`}>{prize.label}</div>
                <strong className="mt-1.5 block text-[18px] font-semibold tracking-[-0.02em] text-ink">
                  {hackathon.prizes?.[prize.key] || '—'}
                </strong>
              </div>
            ))}
          </div>
        </section>

        <section className={PANEL}>
          <SectionHeader
            icon="calendar"
            title="Event timeline"
            description="Key rounds and milestones"
          />
          <div className="p-4 sm:p-5">
            {hackathon.timeline?.length ? (
              <ol className="space-y-0">
                {hackathon.timeline.map((round, index) => (
                  <li
                    key={`${round.title}-${index}`}
                    className="relative grid grid-cols-[44px_minmax(0,1fr)] gap-4 pb-6 last:pb-0"
                  >
                    {index < hackathon.timeline.length - 1 ? (
                      <span
                        className="absolute top-11 bottom-1 left-[21px] w-px bg-hairline"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span
                      className={`${MONO} relative z-1 grid size-11 place-items-center rounded-full border border-hairline bg-surface text-[12px] font-semibold text-volt`}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="rounded-drop border border-hairline bg-raised/40 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <h3 className="text-[16px] font-semibold tracking-[-0.015em] text-ink">
                          {round.title}
                        </h3>
                        {(round.start_date || round.end_date) && (
                          <span className={`${BADGE} ${BADGE_CLOSED}`}>
                            <Icon name="calendar" size={13} />
                            {round.start_date ? formatDate(round.start_date) : 'Date TBD'}
                            {round.end_date ? ` – ${formatDate(round.end_date)}` : ''}
                          </span>
                        )}
                      </div>
                      {round.description ? (
                        <p className="mt-2 text-[14px] leading-relaxed text-muted">
                          {round.description}
                        </p>
                      ) : null}
                      {round.evaluation_requirement_id && (() => {
                        const requirement = requirements?.find(
                          (item) => item.id === round.evaluation_requirement_id,
                        )
                        return (
                          <div className="mt-3 rounded-drop border border-hairline bg-surface p-3">
                            <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink">
                              <Icon name="clipboard" size={15} />
                              <span className="font-medium">
                                {requirement?.name || 'Linked evaluation requirement'}
                              </span>
                              <span className="text-muted">
                                <span className={MONO}>{requirement?.fields?.length || 0}</span> fields
                              </span>
                            </div>
                            {!!requirement?.fields?.length && (
                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {requirement.fields.map((field) => (
                                  <span
                                    key={field.key || field.label}
                                    className="rounded-full border border-hairline bg-raised px-2.5 py-1 text-[11.5px] text-muted"
                                  >
                                    {field.label}
                                    {field.is_required ? (
                                      <strong className="ml-0.5 text-volt" aria-label="required">
                                        *
                                      </strong>
                                    ) : null}
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
              <div className="flex items-center gap-3 rounded-drop border border-dashed border-hairline px-4 py-8 text-muted">
                <Icon name="clock" size={22} />
                <span className="text-[14px]">Timeline details will be announced soon.</span>
              </div>
            )}
          </div>
        </section>

        <section className={PANEL}>
          <SectionHeader
            icon="clipboard"
            title="Participation guidelines"
            description="Everything teams need to know"
          />
          <div className="markdown-body hackathon-guidelines p-4 text-ink sm:p-5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{hackathon.guidelines}</ReactMarkdown>
          </div>
        </section>
      </div>

      {isAdmin && (
        <Modal
          open={confirmDelete}
          onClose={() => !deleting && setConfirmDelete(false)}
          title="Delete hackathon"
          footer={
            <>
              <Button variant="ghost" disabled={deleting} onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button variant="danger" loading={deleting} onClick={remove}>
                Delete permanently
              </Button>
            </>
          }
        >
          <div className="stack-md">
            {deleteError && <Alert variant="danger">{deleteError}</Alert>}
            <p>
              Delete <strong>{hackathon.name}</strong>? This action cannot be undone.
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
