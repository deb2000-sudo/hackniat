import { api } from './client'

function normalizeSubmission(submission) {
  if (!submission) return submission
  const evaluation = submission.evaluation ?? submission.result ?? null
  return {
    ...submission,
    evaluation,
    result: evaluation,
    criteria: submission.evaluation_criteria ?? submission.criteria ?? null,
    overall_score: evaluation?.overall_score ?? null,
  }
}

export const evaluationApi = {
  /** List every submission owned by the authenticated student. */
  listSubmissions: async (options) => {
    const submissions = await api.get('/submissions', options)
    if (!Array.isArray(submissions)) {
      throw new Error('The submissions API returned an unsupported response format.')
    }
    return submissions.map(normalizeSubmission)
  },

  /** Admin review queue containing every student submission. */
  listAllSubmissions: async (options) => {
    const submissions = await api.get('/submissions/admin/all', options)
    if (!Array.isArray(submissions)) {
      throw new Error('The admin submissions API returned an unsupported response format.')
    }
    return submissions.map(normalizeSubmission)
  },

  /** Admin Submissions landing screen: hackathons with submission counts. */
  listSubmissionHackathons: async (options) => {
    const hackathons = await api.get('/submissions/admin/hackathons', options)
    if (!Array.isArray(hackathons)) {
      throw new Error('The submission hackathons API returned an unsupported response format.')
    }
    return hackathons
  },

  /** Admin queue for one hackathon. */
  listHackathonSubmissions: async (hackathonId, options) => {
    const submissions = await api.get(
      `/submissions/admin/hackathons/${encodeURIComponent(hackathonId)}`,
      options,
    )
    if (!Array.isArray(submissions)) {
      throw new Error('The hackathon submissions API returned an unsupported response format.')
    }
    return submissions.map(normalizeSubmission)
  },

  /** Admin only: assign or unassign a submission from an approved evaluator. */
  assignSubmission: async (submissionId, evaluatorId, options) => {
    const submission = await api.post(
      `/submissions/${encodeURIComponent(submissionId)}/assign`,
      { evaluator_id: evaluatorId || null },
      options,
    )
    return normalizeSubmission(submission)
  },

  /** Admin only: distribute selected submissions among approved evaluators. */
  assignHackathonSubmissionsEqually: async (
    hackathonId,
    submissionIds,
    evaluatorIds,
    options,
  ) => {
    const body = { submission_ids: submissionIds }
    if (evaluatorIds?.length) body.evaluator_ids = evaluatorIds
    return api.post(
      `/submissions/admin/hackathons/${encodeURIComponent(hackathonId)}/assign-equally`,
      body,
      options,
    )
  },

  /** Upload a video and requirement responses; legacy fields keep the current backend compatible. */
  createSubmission: async (file, details, options) => {
    const formData = new FormData()
    formData.append('hackathon_id', details.hackathon_id)
    formData.append('theme_id', details.theme_id)
    formData.append('video', file)
    formData.append('problem_statement', details.problem_statement)
    formData.append('solution_description', details.solution_description)
    if (details.evaluation_requirement_id) {
      formData.append('evaluation_requirement_id', details.evaluation_requirement_id)
    }
    if (details.requirement_responses) {
      formData.append('requirement_responses', JSON.stringify(details.requirement_responses))
    }
    const submission = await api.upload('/submissions', formData, options)
    return normalizeSubmission(submission)
  },

  /** Start AI evaluation for an existing submission. */
  evaluateSubmission: async (submissionId, evaluationCriteria, options) => {
    const submission = await api.post(
      `/submissions/${encodeURIComponent(submissionId)}/evaluate`,
      { evaluation_criteria: evaluationCriteria || null },
      options,
    )
    return normalizeSubmission(submission)
  },

  /** Admin only: publish or hide a completed report for the student. */
  publishSubmissionReport: async (submissionId, publish, options) => {
    const submission = await api.post(
      `/submissions/${encodeURIComponent(submissionId)}/publish`,
      { publish },
      options,
    )
    return normalizeSubmission(submission)
  },

  /** Fetch one submission. Students may fetch their own; evaluators/admins may fetch any. */
  getSubmission: async (submissionId, options) => {
    const submission = await api.get(
      `/submissions/${encodeURIComponent(submissionId)}`,
      options,
    )
    return normalizeSubmission(submission)
  },

  /** Fetch the completed submission's checklist and Markdown analysis report. */
  getSubmissionReport: (submissionId, options) =>
    api.get(
      `/submissions/${encodeURIComponent(submissionId)}/report`,
      options,
    ),
}
