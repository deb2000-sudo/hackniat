import { api } from './client'

const encode = (value) => encodeURIComponent(String(value))

export const themesApi = {
  list: (options) => api.get('/themes', options),
  get: (themeId, options) => api.get(`/themes/${encode(themeId)}`, options),
  create: (payload, options) => api.post('/themes', payload, options),
  update: (themeId, payload, options) =>
    api.patch(`/themes/${encode(themeId)}`, payload, options),
  delete: (themeId, options) => api.delete(`/themes/${encode(themeId)}`, options),
}
