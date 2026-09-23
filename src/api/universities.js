import { api } from './client'

const PATH = '/universities'

function encode(value) {
  return encodeURIComponent(String(value))
}

/**
 * Campuses a student picks from when registering.
 *
 * `list` is public — the register form reads it before anyone has a session —
 * while create / update / delete are admin-only. Every entry carries a
 * `display_label` ("NIAT, Hyderabad") the backend composes; callers show that
 * rather than joining name and location themselves, so the two never disagree.
 */
export const universitiesApi = {
  list: (options) => api.get(PATH, options),

  /** Admin only. Body: `{ name, location }`. */
  create: (payload, options) => api.post(PATH, payload, options),

  /** Admin only. Partial: send only the fields that changed. */
  update: (universityId, payload, options) =>
    api.patch(`${PATH}/${encode(universityId)}`, payload, options),

  /** Admin only. */
  delete: (universityId, options) => api.delete(`${PATH}/${encode(universityId)}`, options),
}
