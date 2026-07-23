import { api } from './client'

function normalizeSubmission(submission) {
  if (!submission) return submission
  const evaluation = submission.analysis ?? null
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

  /** Upload a video and its problem/solution; team details come from the user profile. */
  createSubmission: async (file, details, options) => {
    const formData = new FormData()
    formData.append('video', file)
    formData.append('problem_statement', details.problem_statement)
    formData.append('solution_description', details.solution_description)
    formData.append('github_repo_link', details.github_repo_link)
    if (details.project_link) formData.append('project_link', details.project_link)
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
