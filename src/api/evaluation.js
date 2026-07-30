import { api } from './client'

function normalizeSubmission(submission) {
  if (!submission) return submission
  const evaluation = submission.evaluation ?? submission.result ?? null
  const analysis = submission.analysis ?? evaluation?.analysis ?? null
  return {
    ...submission,
    evaluation,
    result: evaluation,
    analysis,
    field_scores:
      analysis?.field_scores ??
      evaluation?.field_scores ??
      submission.field_scores ??
      null,
    criteria: submission.evaluation_criteria ?? submission.criteria ?? null,
    overall_score: evaluation?.overall_score ?? null,
    review_status: submission.review_status || 'none',
    evaluator_score:
      submission.evaluator_score ??
      submission.review_score ??
      submission.final_score ??
      null,
    evaluator_notes: submission.evaluator_notes ?? submission.review_notes ?? null,
    final_score: submission.final_score ?? null,
    auto_ai_evaluation: Boolean(submission.auto_ai_evaluation),
    show_ai_evaluation_button: Boolean(submission.show_ai_evaluation_button),
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

  /** Evaluator landing screen: hackathons containing assigned submissions. */
  listEvaluatorHackathons: async (options) => {
    const hackathons = await api.get('/submissions/evaluator/hackathons', options)
    if (!Array.isArray(hackathons)) {
      throw new Error('The evaluator hackathons API returned an unsupported response format.')
    }
    return hackathons
  },

  /** Evaluator queue for one hackathon, restricted by the backend to assigned work. */
  listEvaluatorHackathonSubmissions: async (hackathonId, options) => {
    const submissions = await api.get(
      `/submissions/evaluator/hackathons/${encodeURIComponent(hackathonId)}`,
      options,
    )
    if (!Array.isArray(submissions)) {
      throw new Error('The evaluator submissions API returned an unsupported response format.')
    }
    return submissions.map(normalizeSubmission)
  },

  /** Video formats and maximum size accepted by the signed-upload flow. */
  getAcceptedVideoTypes: (options) =>
    api.get('/submissions/accepted-video-types', options),

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
    const result = await api.post(
      `/submissions/admin/hackathons/${encodeURIComponent(hackathonId)}/assign-equally`,
      body,
      options,
    )
    return {
      ...result,
      submissions: Array.isArray(result?.submissions)
        ? result.submissions.map(normalizeSubmission)
        : [],
    }
  },

  /** Evaluator only: send a completed analysis and score to the admin. */
  submitForAdminReview: async (submissionId, score, notes, options) => {
    const submission = await api.post(
      `/submissions/${encodeURIComponent(submissionId)}/submit-for-review`,
      { final_score: score, evaluator_notes: notes || null },
      options,
    )
    return normalizeSubmission(submission)
  },

  /** Admin only: approve an evaluator review and publish the final result. */
  approveEvaluatorReview: async (submissionId, reviewNotes, options) => {
    const submission = await api.post(
      `/submissions/${encodeURIComponent(submissionId)}/approve-evaluation`,
      { review_notes: reviewNotes || null },
      options,
    )
    return normalizeSubmission(submission)
  },

  /** Admin only: return a submission to its evaluator for changes. */
  requestEvaluatorChanges: async (submissionId, reviewNotes, options) => {
    const submission = await api.post(
      `/submissions/${encodeURIComponent(submissionId)}/request-changes`,
      { review_notes: reviewNotes || null },
      options,
    )
    return normalizeSubmission(submission)
  },

  /** Upload a video (optional) via signed URL, then finalize the submission. */
  createSubmission: async (file, details, options) => {
    const { onStageChange, ...requestOptions } = options || {}
    const tooLargeMessage = 'Video is too large for direct upload — please retry.'

    const baseBody = {
      hackathon_id: details.hackathon_id,
      theme_id: details.theme_id,
      problem_statement: details.problem_statement,
      solution_description: details.solution_description,
      mvp_link: details.mvp_link || null,
      github_link: details.github_link || null,
      field_answers: details.field_answers || null,
      evaluation_requirement_id: details.evaluation_requirement_id || null,
      video_source: details.video_source || null,
    }

    try {
      if (!file) {
        onStageChange?.('finalizing')
        const submission = await api.post(
          '/submissions/from-upload',
          baseBody,
          requestOptions,
        )
        return normalizeSubmission(submission)
      }

      const contentType = file.type || undefined

      onStageChange?.('preparing')
      const prep = await api.post(
        '/submissions/upload-url',
        {
          filename: file.name,
          content_type: contentType,
          video_source: details.video_source,
        },
        requestOptions,
      )

      if (!prep?.upload_url || !prep?.video_path) {
        throw new Error('The server did not return a valid secure video upload URL.')
      }

      onStageChange?.('uploading')
      let uploadResponse
      try {
        uploadResponse = await fetch(prep.upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': prep.content_type },
          body: file,
          signal: requestOptions.signal,
        })
      } catch (uploadError) {
        if (uploadError.name === 'AbortError') throw uploadError
        throw new Error(
          'Direct video upload failed. Please retry. If it continues, verify the storage CORS configuration.',
          { cause: uploadError },
        )
      }

      if (!uploadResponse.ok) {
        if (uploadResponse.status === 413) throw new Error(tooLargeMessage)
        throw new Error(
          `The video upload was rejected by storage (${uploadResponse.status}). Please retry.`,
        )
      }

      onStageChange?.('finalizing')
      const submission = await api.post(
        '/submissions/from-upload',
        {
          ...baseBody,
          video_path: prep.video_path,
          content_type: prep.content_type,
          source_filename: prep.source_filename,
          video_source: details.video_source,
        },
        requestOptions,
      )
      return normalizeSubmission(submission)
    } catch (error) {
      if (error.status === 413) throw new Error(tooLargeMessage, { cause: error })
      throw error
    }
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
