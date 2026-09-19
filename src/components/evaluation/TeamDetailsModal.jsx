import { useEffect, useState } from 'react'
import { evaluationApi } from '../../api/evaluation'
import Alert from '../ui/Alert'
import Badge from '../ui/Badge'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import { LoadingBlock } from '../ui/Spinner'

/** The leader is flagged by role; everything else is a plain member. */
const isLeader = (member) => String(member?.role || '').toLowerCase() === 'leader'

/**
 * Normalize a roster response.
 *
 * Tolerant about shape on purpose: the payload is a straight projection of the
 * `hackathon_teams` document, and solo rounds have no team document at all — so
 * a single student may arrive as a bare object rather than a members array.
 */
function normalizeTeam(data) {
  if (!data) return null

  const rawMembers = Array.isArray(data.members)
    ? data.members
    : Array.isArray(data.team?.members)
      ? data.team.members
      : data.user_id || data.email
        ? [data]
        : []

  const members = rawMembers
    .map((member) => ({
      // Firestore's document id — used only to key the list, never shown. The
      // ID an admin recognises is the NIAT ID from registration.
      user_id: String(member?.user_id ?? member?.id ?? '').trim(),
      // Staff accounts register with an employee id instead, same as UsersPage.
      niat_id: String(member?.niat_id ?? member?.employee_id ?? '').trim(),
      name: String(member?.name ?? '').trim(),
      email: String(member?.email ?? '').trim(),
      role: String(member?.role ?? '').trim(),
    }))
    .filter((member) => member.user_id || member.name || member.email)
    // Leader first, then alphabetical — a roster the admin can scan.
    .sort((a, b) => {
      if (isLeader(a) !== isLeader(b)) return isLeader(a) ? -1 : 1
      return a.name.localeCompare(b.name)
    })

  return {
    team_name: String(data.team_name ?? data.team?.name ?? '').trim(),
    is_solo: Boolean(data.is_solo ?? members.length === 1),
    members,
  }
}

function MemberRow({ member }) {
  return (
    <li className="team-member">
      <span className="team-member__avatar" aria-hidden="true">
        <Icon name="user" size={18} />
      </span>
      <div className="team-member__body">
        <div className="team-member__head">
          <strong>{member.name || 'Unnamed participant'}</strong>
          {isLeader(member) && (
            <Badge variant="success" dot>
              Team Leader
            </Badge>
          )}
        </div>
        {member.email ? (
          <a className="team-member__email" href={`mailto:${member.email}`}>
            {member.email}
          </a>
        ) : (
          <span className="team-member__email is-empty">No email on record</span>
        )}
        <span className="team-member__id">
          <span className="team-member__id-label">NIAT ID</span>
          {member.niat_id ? (
            <code>{member.niat_id}</code>
          ) : (
            <em className="text-muted">not on record</em>
          )}
        </span>
      </div>
    </li>
  )
}

/**
 * Fetches and renders one submission's roster.
 *
 * Split out and mounted with `key={submissionId}` so opening a different row
 * remounts it with clean state — no stale roster flashing while the next one
 * loads, and no reset-on-close effect to keep in sync.
 */
function TeamRoster({ submissionId }) {
  const [team, setTeam] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    evaluationApi
      .getSubmissionTeam(submissionId, { signal: controller.signal })
      .then((data) => {
        if (active) setTeam(normalizeTeam(data))
      })
      .catch((err) => {
        if (!active || err?.name === 'AbortError') return
        setError(err?.message || 'Unable to load this team.')
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [submissionId])

  if (error) {
    return (
      <Alert variant="danger" title="Unable to load this team">
        {error}
      </Alert>
    )
  }

  if (!team) return <LoadingBlock label="Loading team…" />

  if (!team.members.length) {
    return (
      <p className="text-muted">No participant details are recorded for this submission.</p>
    )
  }

  return (
    <>
      <p className="team-modal__count">
        {team.is_solo
          ? 'Solo participant'
          : `${team.members.length} member${team.members.length === 1 ? '' : 's'}`}
      </p>
      <ul className="team-member-list">
        {team.members.map((member) => (
          <MemberRow key={member.user_id || member.email || member.name} member={member} />
        ))}
      </ul>
    </>
  )
}

/**
 * Roster behind one submission, opened from the team name in the admin table.
 *
 * Fetches on open rather than with the table: a hackathon page lists many
 * submissions and almost none of them get clicked.
 */
export default function TeamDetailsModal({ open, submission, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={submission?.team_name || 'Team details'}
      className="team-modal"
    >
      {submission?.id && <TeamRoster key={submission.id} submissionId={submission.id} />}
    </Modal>
  )
}
