import { useCallback, useEffect, useState } from 'react'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import Spinner, { LoadingBlock } from '../ui/Spinner'
import Input from '../ui/Input'
import OtpInput from '../auth/OtpInput'
import JoinCodePanel from './JoinCodePanel'
import TeamRoster from './TeamRoster'
import { formatDate } from '../../utils/format'
import { participationErrorCode, participationErrorMessage, shouldRefetchParticipation } from './errorCodes'
import {
  isRoundAwaitingRelease,
  isRoundLive,
  roundDisplayName,
  roundOpensText,
  roundPendingReleaseText,
} from './roundStatus'

/**
 * Per-hackathon enrollment gate.
 *
 * Drives GET /participation and renders whichever state the backend reports:
 * solo enroll, leader/member choice, the leader's join code + roster, or a
 * member's roster. `onState` fires with the participation payload on every
 * load, so the caller can both reveal a submit entry point when can_submit is
 * true and hide submission fields entirely when it is false.
 *
 * `pending_action` from the backend is the source of truth for what to show —
 * the client never infers enrollment state from its own last action.
 */
/** Actions the panel renders a step for; anything else falls back to team size. */
const KNOWN_PENDING_ACTIONS = ['solo_enroll', 'choose_role', 'complete_team', 'round_not_open']

export default function ParticipationPanel({ hackathonId, roundIndex = 0, round, onState }) {
  // An unreleased round rejects /participation by design, so don't ask: the
  // request can only come back as an error the student can do nothing about.
  const awaitingRelease = isRoundAwaitingRelease(round)
  const fetcher = useCallback(
    (options) => hackathonsApi.participation(hackathonId, roundIndex, options),
    [hackathonId, roundIndex],
  )
  const { data, loading, error, reload } = useAsync(fetcher, {
    enabled: Boolean(hackathonId) && !awaitingRelease,
  })

  const [busy, setBusy] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [choice, setChoice] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [teamName, setTeamName] = useState('')
  const [issuedCode, setIssuedCode] = useState(null)

  useEffect(() => {
    if (data && onState) onState(data)
  }, [data, onState])

  const run = async (key, fn, successNotice) => {
    setBusy(key)
    setActionError('')
    setNotice('')
    try {
      const result = await fn()
      if (successNotice) setNotice(successNotice)
      await reload()
      return result
    } catch (err) {
      setActionError(participationErrorMessage(err))
      // Codes like ALREADY_ENROLLED / TEAM_REQUIRED mean this view is stale.
      if (shouldRefetchParticipation(err)) {
        setChoice('')
        await reload()
      }
      return null
    } finally {
      setBusy('')
    }
  }

  const roundName = roundDisplayName(round, roundIndex)

  // Not an error state: the round has not started yet. Say when it opens rather
  // than reporting a failure the student can do nothing about.
  if (awaitingRelease) {
    return (
      <Alert variant="info" title={`${roundName} is not open yet`}>
        {roundOpensText(round)}
      </Alert>
    )
  }

  if (loading && !data) return <LoadingBlock label="Checking your enrollment…" />

  // The schedule says this round is running, but the backend has not released
  // it. Name that gap instead of repeating "not open yet" on a day the dates
  // say it is open — the student needs to know it is waiting on an admin.
  if (error && !data && participationErrorCode(error) === 'ROUND_NOT_PUBLISHED') {
    return (
      <Alert variant="warning" title={`${roundName} has not been released yet`}>
        {roundPendingReleaseText(round)}
      </Alert>
    )
  }

  if (error && !data) {
    return (
      <Alert variant="danger" title="Unable to load your enrollment">
        {error.message}
      </Alert>
    )
  }

  if (!data) return null

  const { enrolled, role, team, pending_action: pendingAction } = data
  const isSolo = Number(data.max_team_size) === 1

  // pending_action is the backend's instruction and is honoured whenever it is
  // one we know. When it is missing or named something else, fall back to the
  // round's team size: previously an unrecognised value rendered the header and
  // nothing else, so a team round silently offered no way to enroll at all.
  const unknownAction = !KNOWN_PENDING_ACTIONS.includes(pendingAction)
  const showSoloEnroll = !enrolled && (pendingAction === 'solo_enroll' || (unknownAction && isSolo))
  const showRoleChoice =
    !enrolled && !choice && (pendingAction === 'choose_role' || (unknownAction && !isSolo))
  const activeCode = issuedCode || team?.join_code || null

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
          {data.round_title ? `Participation · ${data.round_title}` : 'Participation'}
        </span>
        <p className="mt-1 text-[15px] font-medium text-ink">
          {data.team_mode_label || (isSolo ? 'Solo' : 'Team')}
          {enrolled && role ? ` · You are the ${role}` : ''}
        </p>
      </div>
      {enrolled && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-600/10 px-3 py-1.5 text-sm font-semibold text-emerald-600">
          <Icon name="checkCircle" size={16} />
          Enrolled
        </span>
      )}
    </div>
  )

  return (
    <section className="stack-md rounded-drop border border-hairline bg-surface p-5">
      {header}

      {isRoundLive(round) && (
        <Alert variant="success" title={`${roundName} is live now`}>
          You can do your submission for this round.
        </Alert>
      )}

      {actionError && <Alert variant="danger">{actionError}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {/* ---------------------------- Solo enroll --------------------------- */}
      {showSoloEnroll && (
        <div className="stack-sm">
          <p className="text-sm text-muted">
            This hackathon is solo. Enroll to unlock your submission.
          </p>
          <Button
            type="button"
            variant="accent"
            loading={busy === 'solo'}
            onClick={() => run('solo', () => hackathonsApi.enrollSolo(hackathonId, roundIndex))}
          >
            Enroll &amp; Submit
          </Button>
        </div>
      )}

      {/* ------------------------- Leader / member pick --------------------- */}
      {showRoleChoice && (
        <div className="stack-sm">
          <p className="text-sm text-muted">
            Teams of up to {data.max_team_size} (the leader included). How are you taking part?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="accent" onClick={() => setChoice('leader')}>
              I am Team Leader
            </Button>
            <Button type="button" variant="secondary" onClick={() => setChoice('member')}>
              I am Team Member
            </Button>
          </div>
        </div>
      )}

      {/* --------------------------- Create a team -------------------------- */}
      {/* The name is collected before any join code exists — the backend needs
          it on create, and it is what members and evaluators see. */}
      {!enrolled && choice === 'leader' && (
        <div className="stack-sm">
          <p className="text-[15px] font-medium text-ink">Create your team</p>
          <Input
            label="Team name"
            required
            maxLength={100}
            autoFocus
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
            hint="Visible to your members and to evaluators."
            placeholder="Alpha Squad"
          />
          <p className="text-sm text-muted">
            After this you get a six-digit join code to share. Codes last five minutes and you can
            generate a new one at any time.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="accent"
              loading={busy === 'create'}
              disabled={!teamName.trim()}
              onClick={async () => {
                const result = await run('create', () =>
                  hackathonsApi.createTeam(hackathonId, roundIndex, teamName),
                )
                if (result?.join_code) setIssuedCode(result.join_code)
              }}
            >
              Create team
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setChoice('')
                setTeamName('')
                setActionError('')
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ----------------------------- Join a team -------------------------- */}
      {!enrolled && choice === 'member' && (
        <div className="stack-sm">
          <p className="text-sm text-muted">Enter the six-digit code from your team leader.</p>
          <OtpInput
            label="Team join code"
            value={joinCode}
            onChange={setJoinCode}
            disabled={busy === 'join'}
            invalid={Boolean(actionError)}
            autoFocus
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="accent"
              loading={busy === 'join'}
              disabled={joinCode.length !== 6}
              onClick={async () => {
                const ok = await run(
                  'join',
                  () => hackathonsApi.joinTeam(hackathonId, roundIndex, joinCode),
                  'You joined successfully.',
                )
                if (ok) setJoinCode('')
              }}
            >
              Join team
            </Button>
            <Button type="button" variant="ghost" onClick={() => setChoice('')}>
              Back
            </Button>
          </div>
        </div>
      )}

      {/* ------------------------------ Enrolled ---------------------------- */}
      {enrolled && team && (
        <div className="stack-md">
          {team.team_name && (
            <div>
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
                Team
              </span>
              <h3 className="mt-1 text-[18px] font-semibold tracking-[-0.015em] text-ink">
                {team.team_name}
              </h3>
            </div>
          )}

          <TeamRoster team={team} />

          {role === 'leader' && !team.is_full && (
            <JoinCodePanel
              joinCode={activeCode}
              refreshing={busy === 'code'}
              onRefresh={async () => {
                const result = await run('code', () => hackathonsApi.refreshJoinCode(hackathonId, roundIndex))
                if (result?.join_code) setIssuedCode(result.join_code)
                else if (result?.code) setIssuedCode(result)
              }}
            />
          )}

          {role === 'leader' && team.is_full && (
            <p className="text-sm text-muted">
              Your team is full — no more members can join.
            </p>
          )}

          {role === 'member' && (
            <Alert variant="info">Only your team leader can submit for this hackathon.</Alert>
          )}
        </div>
      )}

      {enrolled && pendingAction === 'complete_team' && (
        <Alert variant="warning" title="Team not complete">
          {data.block_reason ||
            `Add ${Math.max(0, Number(data.max_team_size || 0) - Number(team?.member_count || 0))} more teammate(s) before you can submit. Share the join code below.`}
        </Alert>
      )}

      {enrolled && pendingAction === 'round_not_open' && (
        <Alert variant="info" title="Round not open yet">
          {data.block_reason ||
            (data.round_start_date
              ? `Opens on ${formatDate(data.round_start_date)} (IST). Your team is set — come back then to submit.`
              : 'Your team is set. You can submit once this round opens.')}
        </Alert>
      )}

      {enrolled && !team && isSolo && (
        <p className="text-sm text-muted">You are enrolled and can submit whenever you are ready.</p>
      )}

      {busy && !loading && (
        <span className="inline-flex items-center gap-2 text-sm text-muted">
          <Spinner size="sm" />
          Working…
        </span>
      )}
    </section>
  )
}
