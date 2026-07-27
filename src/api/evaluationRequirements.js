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
}
