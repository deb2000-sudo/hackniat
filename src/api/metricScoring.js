import { api } from './client'

function encode(value) {
  return encodeURIComponent(String(value))
}

function asList(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.items)) return response.items
  if (Array.isArray(response?.data)) return response.data
  return []
}

export const metricScoringApi = {
  list: async (requirementId, options) => {
    const query = requirementId
      ? `?evaluation_requirement_id=${encode(requirementId)}`
      : ''
    return asList(await api.get(`/ai-evaluation-metric-scoring${query}`, options))
  },

  get: (scoringId, options) =>
    api.get(`/ai-evaluation-metric-scoring/${encode(scoringId)}`, options),

  create: (payload, options) =>
    api.post('/ai-evaluation-metric-scoring', payload, options),

  update: (scoringId, payload, options) =>
    api.patch(`/ai-evaluation-metric-scoring/${encode(scoringId)}`, payload, options),

  delete: (scoringId, options) =>
    api.delete(`/ai-evaluation-metric-scoring/${encode(scoringId)}`, options),
}
