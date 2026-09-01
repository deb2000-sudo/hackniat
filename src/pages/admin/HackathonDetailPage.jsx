import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { hackathonsApi } from '../../api/hackathons'
import RoundParticipation from '../../components/hackathons/RoundParticipation'
import LeaderboardPanel from '../../components/hackathons/LeaderboardPanel'
import { participationErrorMessage } from '../../components/hackathons/errorCodes'
import { roundStatusBadge } from '../../components/hackathons/roundStatus'
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
import Accordion from '../../components/ui/Accordion'
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

/**
 * Timeline pill — larger than the compact BADGE used elsewhere on this page,
 * because the round header is what an admin scans first.
 */
const ROUND_PILL =
  'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13.5px] font-medium whitespace-nowrap'

/**
 * Round status colours.
 *
 * Green/red rather than the volt tint used for round badges elsewhere: on this
 * screen the one thing being read off the row is open vs closed, and traffic
 * colours answer that without reading the word.
 */
const ROUND_STATUS_TONE = {
  open: 'border-[color-mix(in_srgb,var(--color-passed)_45%,transparent)] bg-success-soft text-passed',
  closed: 'border-[color-mix(in_srgb,var(--color-missing)_45%,transparent)] bg-danger-soft text-missing',
  scheduled: 'border-[color-mix(in_srgb,var(--color-warn)_38%,transparent)] bg-warning-soft text-warn',
  draft: 'border-hairline bg-raised text-muted',
}

/** Neutral pill for the round's configuration (team size, dates). */
const ROUND_PILL_NEUTRAL = 'border-hairline bg-raised text-ink'

/**
 * Total prize money across the three places.
 *
 * Prizes are free text ("₹1,00,000", "50000 + goodies"), so a total is only
 * meaningful for the entries that actually carry digits: strip the separators,
 * sum what parses, and report nothing when none of it does rather than
 * printing a confident zero.
 */
function totalPrizePool(prizes) {
  const amounts = Object.values(prizes || {})
    .map((value) => Number(String(value).replace(/[^0-9.]/g, '')))
    .filter((amount) => Number.isFinite(amount) && amount > 0)
  if (!amounts.length) return null
  return amounts.reduce((sum, amount) => sum + amount, 0)
}

export default function HackathonDetailPage() {
  const { hackathonId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === ROLES.ADMIN
  const isEvaluator = user?.role === ROLES.EVALUATOR
  const isStudent = user?.role === ROLES.STUDENT
  const {
    data: hackathon,
    loading,
    error,
    reload: reloadHackathon,
  } = useAsync(() => hackathonsApi.get(hackathonId))
  const { data: requirements } = useAsync(() => evaluationRequirementsApi.list())
  const [publishingRound, setPublishingRound] = useState('')
  const [publishError, setPublishError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  /**
   * Release a round to students. Publishing is per round, and this page is
   * where an admin actually looks at the timeline — requiring a trip through
   * the edit wizard to find the same button made it effectively undiscoverable.
   */
  const publishRound = async (index) => {
    setPublishingRound(String(index))
    setPublishError('')
    try {
      await hackathonsApi.publishRound(hackathonId, index)
      await reloadHackathon({ force: true })
    } catch (err) {
      setPublishError(participationErrorMessage(err, 'Could not publish this round.'))
    } finally {
      setPublishingRound('')
    }
  }

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
  const showEvaluatorGuidelines =
    (isAdmin || isEvaluator) && String(hackathon.evaluator_guidelines || '').trim()
  const missingEvaluatorGuidelines =
    isAdmin && !String(hackathon.evaluator_guidelines || '').trim()
  // Staff-only box inside the guidelines accordion. An admin still gets it
  // while the guidelines are unwritten — that is where the prompt to write
  // them belongs — but a student never sees the reviewers' rules either way.
  const showEvaluatorBox = Boolean(showEvaluatorGuidelines) || missingEvaluatorGuidelines
  // Standings per round. Staff always see a preview; students only reach a
  // board their admin has published, and the panel reports that state itself
  // rather than the page guessing at it. With none visible the whole section
  // is dropped instead of offering an accordion that opens onto nothing.
  const leaderboardRounds = (hackathon.timeline || [])
    .map((round, index) => ({ round, index }))
    .filter(({ round }) => isAdmin || isEvaluator || round.leaderboard_published)
  const prizePool = totalPrizePool(hackathon.prizes)
  const summary = [
    {
      icon: 'calendar',
      label: 'Starts on',
      value: formatDate(hackathon.start_date),
    },
    {
      icon: 'chart',
      label: 'Competition format',
      value: `${hackathon.timeline?.length || 0} Rounds`,
    },
    {
      icon: 'trophy',
      label: 'Total prize pool',
      // Free-text prizes that carry no number leave the pool unknowable, so
      // say so rather than showing one place's copy as if it were the total.
      value: prizePool ? prizePool.toLocaleString('en-IN') : 'To be announced',
    },
    {
      icon: 'calendar',
      label: 'Ends on',
      value: formatDate(hackathon.end_date),
    },
    // No AI evaluation tile: the flag is set per timeline round, so a single
    // hackathon-level value cannot describe it. The per-round setting is shown
    // on the round itself.
  ]

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      {/* Hero. A compact card rather than a banner wall: the actions, the
          status and the schedule are what this page is opened for, so they all
          sit above the fold instead of below a full-bleed image. */}
      <section className={`${PANEL} mb-6 overflow-hidden md:mb-8`}>
        <div className="flex flex-col gap-3 border-b border-hairline p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <Link to="/hackathons" className={`${BTN_GHOST} w-full sm:w-auto`}>
            <Icon name="arrowLeft" size={17} />
            All hackathons
          </Link>
          {isAdmin && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              {/* Hackathon-level configuration (publishing and the rest)
                  lives on its own page, so it is reachable from where the
                  hackathon is being looked at rather than only mid-wizard. */}
              <Link
                to={`/admin/hackathons/${hackathon.id}/settings`}
                className={`${BTN_GHOST} w-full sm:w-auto`}
              >
                <Icon name="settings" size={16} />
                Settings
              </Link>
              <Link
                to={`/admin/hackathons/${hackathon.id}/edit`}
                className={`${BTN_GHOST} w-full sm:w-auto`}
              >
                <Icon name="edit" size={16} />
                Edit
              </Link>
              <button
                type="button"
                className={`${BTN_GHOST} w-full border-transparent text-missing hover:border-missing/30 hover:bg-danger-soft sm:w-auto`}
                onClick={() => setConfirmDelete(true)}
              >
                <Icon name="trash" size={16} />
                Delete
              </button>
            </div>
          )}
        </div>

        <div className="p-5 md:p-8">
          <span
            className={`${BADGE} ${statusBadge(status.key)} font-label tracking-[0.1em] uppercase`}
          >
            {status.label}
          </span>
          <h1 className="mt-4 text-[32px] font-semibold tracking-[-0.035em] text-ink md:text-[44px] md:leading-[1.05]">
            {hackathon.name}
          </h1>
          {hackathon.description ? (
            <p className="mt-3 max-w-[70ch] text-[15px] leading-relaxed text-muted md:text-[16px]">
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
      </section>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 md:mb-8 md:gap-4">
        {summary.map((item) => (
          <div key={item.label} className={`${PANEL} flex items-center gap-3.5 p-4`}>
            <span className="grid size-11 shrink-0 place-items-center rounded-drop border border-hairline bg-raised text-volt-ink">
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

      {/* Everything below the summary is an accordion, so the page opens as a
          short index of the hackathon and each part is expanded on demand. */}
      <div className="flex flex-col gap-4">
        {/* Enrollment is the student's reason for being here, so their rounds
            open with the page rather than behind a click. */}
        {isStudent && !!hackathon.timeline?.length && (
          <Accordion icon="clipboard" title="Rounds" defaultOpen>
            <div className="stack-md">
              {hackathon.timeline.map((round, index) => (
                <RoundParticipation
                  key={`${round.title}-${index}`}
                  hackathon={hackathon}
                  round={round}
                  roundIndex={index}
                />
              ))}
            </div>
          </Accordion>
        )}

        <Accordion icon="gift" title="Winners Takeaway">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                <span className="grid size-10 place-items-center rounded-drop border border-volt-edge bg-volt-tint text-volt-ink">
                  <Icon name="trophy" size={18} />
                </span>
                <div className={`${EYEBROW} mt-4`}>{prize.label}</div>
                <strong className="mt-1.5 block text-[18px] font-semibold tracking-[-0.02em] text-ink">
                  {hackathon.prizes?.[prize.key] || '—'}
                </strong>
              </div>
            ))}
          </div>
        </Accordion>

        <Accordion icon="calendar" title="Event Timeline">
          <div>
            {isAdmin && publishError && (
              <div className="mb-4">
                <Alert variant="danger">{publishError}</Alert>
              </div>
            )}
            {hackathon.timeline?.length ? (
              /* One self-contained card per round rather than a numbered rail:
                 each round carries its own status, team mode, dates and
                 requirement, so the rounds read as parallel cards instead of
                 steps on a thread. */
              <ol className="flex flex-col gap-4">
                {hackathon.timeline.map((round, index) => {
                  // Draft until released, then whatever the schedule says —
                  // matching the badge in the edit wizard.
                  const status = roundStatusBadge(round)
                  const statusKey = round.published ? status.key : 'draft'
                  const statusLabel = round.published ? status.label : 'Draft'
                  return (
                    <li
                      key={`${round.title}-${index}`}
                      className="rounded-drop border border-hairline bg-raised/40 p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="text-[18px] font-semibold tracking-[-0.015em] text-ink">
                          {round.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                          {isAdmin && (
                            <span
                              className={`${ROUND_PILL} ${
                                ROUND_STATUS_TONE[statusKey] || ROUND_STATUS_TONE.draft
                              }`}
                            >
                              Status: {statusLabel}
                            </span>
                          )}
                          {/* Team size is per round and drives the whole
                              enrollment flow, so show what this round is
                              actually configured for rather than leaving it
                              only visible inside the edit wizard. */}
                          <span className={`${ROUND_PILL} ${ROUND_PILL_NEUTRAL}`}>
                            <Icon name="users" size={15} />
                            {Number(round.max_team_size) > 1
                              ? `Team of ${round.max_team_size}`
                              : 'Solo'}
                          </span>
                          {(round.start_date || round.end_date) && (
                            <span className={`${ROUND_PILL} ${ROUND_PILL_NEUTRAL}`}>
                              <Icon name="calendar" size={15} />
                              {round.start_date ? formatDate(round.start_date) : 'Date TBD'}
                              {round.end_date ? ` – ${formatDate(round.end_date)}` : ''}
                            </span>
                          )}
                          {isAdmin && !round.published && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              loading={publishingRound === String(index)}
                              onClick={() => publishRound(index)}
                            >
                              Publish round
                            </Button>
                          )}
                        </div>
                      </div>
                      {round.description ? (
                        <p className="mt-3 text-[14px] leading-relaxed text-muted">
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
                                      <strong className="ml-0.5 text-volt-ink" aria-label="required">
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
                    </li>
                  )
                })}
              </ol>
            ) : (
              <div className="flex items-center gap-3 rounded-drop border border-dashed border-hairline px-4 py-8 text-muted">
                <Icon name="clock" size={22} />
                <span className="text-[14px]">Timeline details will be announced soon.</span>
              </div>
            )}
          </div>
        </Accordion>

        {/* Both audiences' rules in one place: they are read together — an
            admin checking that what reviewers are told matches what teams were
            promised — so they are two boxes here rather than two accordions.
            The evaluator box is staff-only. */}
        <Accordion icon="info" title="Guidelines of The Event">
          <div className="flex flex-col gap-4">
            <section className="rounded-drop border border-hairline bg-raised/40 p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2.5 border-b border-hairline pb-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-drop border border-hairline bg-surface text-volt-ink">
                  <Icon name="users" size={16} />
                </span>
                <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
                  For Participant
                </h3>
              </div>
              <div className="markdown-body hackathon-guidelines text-ink">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{hackathon.guidelines}</ReactMarkdown>
              </div>
            </section>

            {showEvaluatorBox && (
              <section className="rounded-drop border border-hairline bg-raised/40 p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-2.5 border-b border-hairline pb-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-drop border border-hairline bg-surface text-volt-ink">
                    <Icon name="shield" size={16} />
                  </span>
                  <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">
                    For Evaluator
                  </h3>
                </div>
                {showEvaluatorGuidelines ? (
                  <div className="markdown-body hackathon-guidelines text-ink">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {hackathon.evaluator_guidelines}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <Alert variant="warning" title="Evaluator guidelines not configured">
                    Add evaluator guidelines so reviewers know how to score submissions.{' '}
                    <Link
                      to={`/admin/hackathons/${hackathon.id}/edit`}
                      className="font-medium underline"
                    >
                      Edit hackathon
                    </Link>
                  </Alert>
                )}
              </section>
            )}
          </div>
        </Accordion>

        {!!leaderboardRounds.length && (
          <Accordion icon="chart" title="Leaderboard">
            <div className="flex flex-col gap-6">
              {leaderboardRounds.map(({ round, index }) => (
                <LeaderboardPanel
                  key={`leaderboard-${round.title}-${index}`}
                  hackathonId={hackathonId}
                  roundIndex={index}
                  roundTitle={round.title || `Round ${index + 1}`}
                  published={round.leaderboard_published === true}
                  canManage={isAdmin}
                />
              ))}
            </div>
          </Accordion>
        )}

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
