import { api } from './client'

const PATH = '/evaluation-requirements'

function encode(value) {
  return encodeURIComponent(String(value))
}

export const evaluationRequirementsApi = {
  list: (options) => api.get(PATH, options),
  get: (requirementId, options) => api.get(`${PATH}/${encode(requirementId)}`, options),
  create: (payload, options) => api.post(PATH, payload, options),
  update: (requirementId, payload, options) =>
    api.patch(`${PATH}/${encode(requirementId)}`, payload, options),
  delete: (requirementId, options) => api.delete(`${PATH}/${encode(requirementId)}`, options),

  /** Requirement + existing scorecard (or null) for the Set scoring page. */
  getScoringSetup: (requirementId, options) =>
    api.get(`${PATH}/${encode(requirementId)}/scoring-setup`, options),

  /** Create or replace the scorecard for this requirement. */
  putMetricScoring: (requirementId, payload, options) =>
    api.put(`${PATH}/${encode(requirementId)}/metric-scoring`, payload, options),

  /** Delete the scorecard for this requirement. */
  deleteMetricScoring: (requirementId, options) =>
    api.delete(`${PATH}/${encode(requirementId)}/metric-scoring`, options),
}
