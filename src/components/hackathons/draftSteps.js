/**
 * The hackathon creation wizard, as data.
 *
 * The backend stores `current_step` / `completed_steps` as these keys, so the
 * order here is the contract — the drafts inbox, the stepper, and the PATCH
 * payloads all read from this one list rather than each hard-coding indexes.
 */
export const DRAFT_STEPS = [
  {
    key: 'basics',
    label: 'Basics',
    icon: 'calendar',
    title: 'Event information',
    blurb: 'Define the hackathon identity and schedule.',
  },
  {
    key: 'guidelines',
    label: 'Guidelines',
    icon: 'shield',
    title: 'Guidelines',
    blurb: 'Tell students how to take part, and evaluators how to judge.',
  },
  {
    key: 'themes',
    label: 'Themes',
    icon: 'sparkles',
    title: 'Released themes',
    blurb: 'Select the themes students can choose for this hackathon.',
  },
  {
    key: 'timeline',
    label: 'Timeline',
    icon: 'clock',
    title: 'Competition timeline',
    blurb: 'Break the event into rounds with their own dates and rules.',
  },
  {
    key: 'prizes',
    label: 'Prizes',
    icon: 'gift',
    title: 'Prize structure',
    blurb: 'Showcase the rewards available to the top three teams.',
  },
  {
    key: 'banner',
    label: 'Banner',
    icon: 'image',
    title: 'Event banner',
    blurb: 'Add a high-quality visual for cards and the event header.',
  },
  {
    key: 'review',
    label: 'Review',
    icon: 'checkCircle',
    title: 'Review and publish',
    blurb: 'Check every section, then publish the hackathon.',
  },
]

export const DRAFT_STEP_KEYS = DRAFT_STEPS.map((item) => item.key)

/** Index of a step key, defaulting to the first step for anything unknown. */
export function draftStepIndex(key) {
  const index = DRAFT_STEP_KEYS.indexOf(key)
  return index === -1 ? 0 : index
}

export function draftStepLabel(key) {
  return DRAFT_STEPS[draftStepIndex(key)].label
}

/** The last step; reached when there is nothing left to fill in. */
export const REVIEW_STEP = 'review'

/**
 * Fields each section owns. A section PATCHes only its own keys so two admins
 * on different sections cannot clobber each other's work.
 */
const FIELDS_BY_STEP = {
  basics: ['name', 'description', 'start_date', 'end_date', 'hackathon_url'],
  guidelines: ['guidelines', 'evaluator_guidelines'],
  themes: ['theme_ids'],
  timeline: ['timeline'],
  prizes: ['prizes'],
  // Banner is uploaded separately as multipart; review saves nothing new.
  banner: [],
  review: [],
}

export function draftStepFields(key) {
  return FIELDS_BY_STEP[key] || []
}

/**
 * Merge a step into the cumulative completed list, preserving wizard order so
 * the inbox checklist reads top to bottom however the admin jumped around.
 */
export function withStepCompleted(completedSteps, key) {
  const next = new Set([...(completedSteps || []), key])
  return DRAFT_STEP_KEYS.filter((step) => next.has(step))
}
