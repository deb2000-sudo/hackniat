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
  TEAM_REQUIRED: 'This round is played in teams. Choose whether you are the leader or a member.',
  SOLO_HACKATHON: 'This round is for a single person — enroll on your own to continue.',
  ALREADY_ENROLLED: 'You are already enrolled in this hackathon.',
  INVALID_CODE: 'Invalid code. Check the six digits with your team leader.',
  EXPIRED: 'That code has expired. Ask your leader to generate a new one.',
  TEAM_FULL: 'This team is full.',
  LEADER_ONLY: 'Only your team leader can submit for this hackathon.',
  NOT_ENROLLED: 'Enroll in this hackathon before submitting.',
  ROUND_ENDED: 'This round has already ended, so it can no longer be published.',
  ROUND_NOT_PUBLISHED: 'This round has not been released yet.',
  LEADERBOARD_NOT_PUBLISHED: 'The leaderboard for this round has not been published yet.',
  NO_APPROVED_SUBMISSIONS:
    'No approved evaluations yet, so there is nothing to rank. Approve at least one submission first.',
  ALREADY_PUBLISHED: 'This round is already published.',
  TEAM_NAME_REQUIRED: 'Enter a team name.',
  // The hackathon's visibility rule no longer includes this student's
  // university and batch (it can change while the page is open).
  NOT_VISIBLE: 'This hackathon is not open to your university and batch.',
  HACKATHON_NOT_FOUND: 'That hackathon no longer exists.',
  // A submit outside the window (date + IST clock, end minute inclusive).
  HACKATHON_NOT_OPEN: 'This hackathon is not open for submissions yet.',
  HACKATHON_CLOSED: 'This hackathon has closed. Submissions are no longer accepted.',
  ROUND_NOT_OPEN: 'This round is not open for submissions yet.',
  ROUND_CLOSED: 'This round has closed. Submissions are no longer accepted.',
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

/* ------------------------------- Drafts --------------------------------- */

/**
 * Publish rejected the draft. DRAFT_INCOMPLETE means required fields are still
 * blank; DRAFT_INVALID means the values conflict (bad dates, broken timeline).
 */
export function isDraftPublishError(err) {
  return ['DRAFT_INCOMPLETE', 'DRAFT_INVALID'].includes(participationErrorCode(err))
}

/**
 * The wizard step the backend blames, when it says. Returns '' if it does not,
 * leaving the caller to fall back on its own local validation.
 */
export function draftErrorStep(err) {
  const detail = err?.data?.detail
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return ''
  return detail.step || detail.current_step || ''
}
