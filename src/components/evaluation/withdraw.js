export const WITHDRAW_ASSIGNED_MESSAGE =
  'This submission is assigned and can no longer be withdrawn.'

/** Withdraw is only offered while nobody is assigned to review the submission. */
export const canWithdraw = (submission) =>
  Boolean(submission?.id) && !submission?.assigned_evaluator_id
