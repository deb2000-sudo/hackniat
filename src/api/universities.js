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

/**
 * Batches belong to one university and are only ever read for one university
 * at a time — the register form refetches on every campus change rather than
 * filtering a combined list, so a batch can never be offered under the wrong
 * campus. Names are unique per university (409 BATCH_EXISTS), not globally.
 *
 * `list` is public, like the university list; the writes are admin-only.
 */
export const batchesApi = {
  list: (universityId, options) => api.get(`${PATH}/${encode(universityId)}/batches`, options),

  /** Admin only. Body: `{ name }`. */
  create: (universityId, payload, options) =>
    api.post(`${PATH}/${encode(universityId)}/batches`, payload, options),

  /** Admin only. Body: `{ name }`. */
  update: (universityId, batchId, payload, options) =>
    api.patch(`${PATH}/${encode(universityId)}/batches/${encode(batchId)}`, payload, options),

  /** Admin only. */
  delete: (universityId, batchId, options) =>
    api.delete(`${PATH}/${encode(universityId)}/batches/${encode(batchId)}`, options),
}
