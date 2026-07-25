import { api, request } from './client'

const JSON_FIELDS = new Set(['prizes', 'timeline'])

function toFormData(fields) {
  const formData = new FormData()
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    if (JSON_FIELDS.has(key)) {
      formData.append(key, JSON.stringify(value))
    } else {
      formData.append(key, value)
    }
  })
  return formData
}

export const hackathonsApi = {
  list: (options) => api.get('/hackathons', options),
  get: (hackathonId, options) =>
    api.get(`/hackathons/${encodeURIComponent(hackathonId)}`, options),
  create: (fields, options) => api.upload('/hackathons', toFormData(fields), options),
  update: (hackathonId, fields, options) =>
    request(
      `/hackathons/${encodeURIComponent(hackathonId)}`,
      { ...options, method: 'PATCH', formData: toFormData(fields) },
    ),
  delete: (hackathonId, options) =>
    api.delete(`/hackathons/${encodeURIComponent(hackathonId)}`, options),
}
