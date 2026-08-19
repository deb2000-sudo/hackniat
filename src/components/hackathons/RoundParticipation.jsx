import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { formatDate } from '../../utils/format'
import { BADGE, MONO } from '../drop/theme'
import ParticipationPanel from './ParticipationPanel'

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

  const teamLabel =
    participation?.team_mode_label ||
    (Number(round.max_team_size || 1) === 1 ? 'Solo' : `${round.max_team_size} Members`)
  const videoRequired =
    participation?.working_demo_video_required ?? round.working_demo_video_required !== false

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
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className={`${BADGE} border-hairline bg-raised text-ink`}>{teamLabel}</span>
          {videoRequired && (
            <span className={`${BADGE} border-volt-edge bg-volt-tint text-volt-ink`}>
              Video required
            </span>
          )}
        </div>
      </div>

      {round.description && <p className="text-[13.5px] text-muted">{round.description}</p>}

      <ParticipationPanel
        hackathonId={hackathon.id}
        roundIndex={roundIndex}
        onState={setParticipation}
      />

      {participation?.can_submit && (
        <Button
          type="button"
          variant="accent"
          leftIcon={<Icon name="upload" size={17} />}
          onClick={() =>
            navigate('/student/submission', {
              state: { hackathonId: hackathon.id, roundIndex },
            })
          }
        >
          Submit for {round.title}
        </Button>
      )}
    </article>
  )
}
