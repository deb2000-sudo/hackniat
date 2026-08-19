/**
 * Backend participation error codes → what the UI should say and do.
 *
 * Errors arrive as { detail: { code, message } }; ApiError keeps the parsed
 * body on `.data`, so the code is read from there rather than the message,
 * which is free text and may change.
 */
export function participationErrorCode(err) {
  const detail = err?.data?.detail
  return typeof detail === 'object' && detail ? detail.code || '' : ''
}

const MESSAGES = {
  TEAM_REQUIRED: 'This hackathon is played in teams. Choose whether you are the leader or a member.',
  SOLO_HACKATHON: 'This hackathon is solo — enroll on your own to continue.',
  ALREADY_ENROLLED: 'You are already enrolled in this hackathon.',
  INVALID_CODE: 'Invalid code. Check the six digits with your team leader.',
  EXPIRED: 'That code has expired. Ask your leader to generate a new one.',
  TEAM_FULL: 'This team is full.',
  LEADER_ONLY: 'Only your team leader can submit for this hackathon.',
  NOT_ENROLLED: 'Enroll in this hackathon before submitting.',
  ROUND_ENDED: 'This round has already ended, so it can no longer be published.',
  ALREADY_PUBLISHED: 'This round is already published.',
  TEAM_NAME_REQUIRED: 'Enter a team name.',
}

/** Human-readable text for a participation failure. */
export function participationErrorMessage(err, fallback = 'Something went wrong. Try again.') {
  const code = participationErrorCode(err)
  return MESSAGES[code] || err?.message || fallback
}

/**
 * Codes that mean "the local view of the world is stale" — the caller should
 * re-read GET /participation rather than trust what it already has.
 */
export function shouldRefetchParticipation(err) {
  return ['TEAM_REQUIRED', 'SOLO_HACKATHON', 'ALREADY_ENROLLED', 'NOT_ENROLLED'].includes(
    participationErrorCode(err),
  )
}
