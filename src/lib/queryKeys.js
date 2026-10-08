/** Stable cache keys for shared server state. */
export const queryKeys = {
  submissionsMine: 'submissions:mine',
  submissionsAdminHackathons: 'submissions:admin-hackathons',
  submissionsAdminAll: 'submissions:admin-all',
  submissionsEvaluatorHackathons: 'submissions:evaluator-hackathons',
  submissionsHackathonAdmin: (id) => `submissions:admin-hackathon:${id}`,
  submissionsHackathonEvaluator: (id) => `submissions:evaluator-hackathon:${id}`,
  submission: (id) => `submission:${id}`,
  submissionReport: (id) => `submission-report:${id}`,
  hackathons: 'hackathons:list',
  hackathonCatalog: (includeClosed = true) =>
    `hackathons:catalog:${includeClosed ? 'all' : 'open'}`,
  hackathon: (id) => `hackathon:${id}`,
  themes: 'themes:list',
  universities: 'universities:list',
  evaluationRequirements: 'evaluation-requirements:list',
  acceptedVideoTypes: 'submissions:accepted-video-types',
  adminUsers: 'admin:users',
  /** One page of Student Management; never shares the full-list key above. */
  adminStudentsPage: (page, q = '') => `admin:users:students:${page}:${q}`,
  adminEvaluators: 'admin:evaluators',
  adminPendingEvaluators: 'admin:pending-evaluators',
  adminOverview: 'admin:overview',
}
