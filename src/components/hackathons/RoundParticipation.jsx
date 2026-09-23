import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { formatDate } from '../../utils/format'
import { BADGE, MONO } from '../drop/theme'
import ParticipationPanel from './ParticipationPanel'
import {
  canParticipateInRound,
  isSubmissionLimitReached,
  roundOpensText,
  roundStatusBadge,
  roundStatusKeyClosed,
  roundTimingText,
} from './roundStatus'

/**
 * One timeline round for a student: title, dates, the round's own settings as
 * badges, and the enrollment gate.
 *
 * Every round is enrolled in separately — a student can be solo in round 1 and
 * a team member in round 2 — so each card owns its own ParticipationPanel and
 * only reveals "Submit for {title}" once that round reports can_submit.
 */
export default function RoundParticipation({ hackathon, round, roundIndex }) {
  const navigate = useNavigate()
  const [participation, setParticipation] = useState(null)
  const [blockNotice, setBlockNotice] = useState('')

  const teamLabel =
    participation?.team_mode_label ||
    round.team_mode_label ||
    // Fallback for a round that predates the label: a team round is the range
    // "2-5 Members", never a single headcount.
    (Number(round.max_team_size || 1) === 1
      ? 'Solo'
      : `${Number(round.min_team_size) || 2}-${round.max_team_size} Members`)
  const videoRequired =
    participation?.working_demo_video_required ?? round.working_demo_video_required !== false
  const status = roundStatusBadge(round)
  // Team formation is allowed before a round opens; submitting is not.
  const participationOpen = canParticipateInRound(round)
  const canContinue = participation
    ? participation.can_continue_to_demo ?? participation.can_submit
    : false
  // Out of attempts for this round — the panel shows the reason, so the submit
  // action is dropped rather than left to explain itself on click.
  const limitReached = isSubmissionLimitReached(participation)

  return (
    <article className="stack-md rounded-drop border border-hairline bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`${MONO} text-[12px] text-muted`}>
              Round {String(roundIndex + 1).padStart(2, '0')}
            </span>
          </div>
          <h3 className="mt-1 text-[17px] font-semibold tracking-[-0.015em] text-ink">
            {round.title}
          </h3>
          {(round.start_date || round.end_date) && (
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
              <Icon name="calendar" size={14} />
              {formatDate(round.start_date)} – {formatDate(round.end_date)}
            </p>
          )}
          <p className="mt-1 text-[13px] font-medium text-ink">{roundTimingText(round)}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className={`${BADGE} ${status.tone}`}>{status.label}</span>
          <span className={`${BADGE} border-hairline bg-raised text-ink`}>{teamLabel}</span>
          {videoRequired && (
            <span className={`${BADGE} border-volt-edge bg-volt-tint text-volt-ink`}>
              Video required
            </span>
          )}
        </div>
      </div>

      {round.description && <p className="text-[13.5px] text-muted">{round.description}</p>}

      {participationOpen ? (
        <ParticipationPanel
          hackathonId={hackathon.id}
          roundIndex={roundIndex}
          round={round}
          onState={(next) => {
            setParticipation(next)
            setBlockNotice('')
          }}
        />
      ) : (
        <p className="text-sm text-muted">
          {roundStatusKeyClosed(round)
            ? 'This round is closed. Enrollment and submissions are no longer accepted.'
            : `This round is not open for participation yet. ${roundOpensText(round)}`}
        </p>
      )}

      {/* Submitting needs can_continue_to_demo — a full team AND an open
          round. Clicking while blocked surfaces block_reason instead of the
          button quietly not being there. Members never get the action at all.
          A spent submission cap is the one case where the action goes away
          entirely: the panel above has already said why. */}
      {participation?.enrolled && participation.role !== 'member' && !limitReached && (
        <div className="stack-sm">
          <Button
            type="button"
            variant={canContinue ? 'accent' : 'secondary'}
            leftIcon={<Icon name="upload" size={17} />}
            onClick={() => {
              if (!canContinue) {
                setBlockNotice(
                  participation.block_reason || 'You cannot submit for this round yet.',
                )
                return
              }
              navigate('/student/submission', {
                state: { hackathonId: hackathon.id, roundIndex },
              })
            }}
          >
            Continue to demo
          </Button>
          {blockNotice && <Alert variant="warning">{blockNotice}</Alert>}
        </div>
      )}
    </article>
  )
}
