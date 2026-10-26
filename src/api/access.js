import { api } from './client'

const PATH = '/admin/access'

function encode(value) {
  return encodeURIComponent(String(value))
}

/**
 * Super Admin's Access screens: roles and the logins assigned to them.
 *
 * Every call needs `role_management`, which only Super Admin has. The built-in
 * Admin role is listed (`id: "admin"`, `built_in: true`) so it can be assigned,
 * but it cannot be edited or deleted.
 */
export const accessApi = {
  /** Checkbox catalogue: `[{ key, label, group }]`. Never includes role_management. */
  permissions: (options) => api.get(`${PATH}/permissions`, options),

  /** Built-in Admin plus every custom role. */
  roles: (options) => api.get(`${PATH}/roles`, options),

  /** Body: `{ name, permissions }`. */
  createRole: (payload, options) => api.post(`${PATH}/roles`, payload, options),

  /** Partial: `{ name?, permissions? }`. */
  updateRole: (roleId, payload, options) =>
    api.patch(`${PATH}/roles/${encode(roleId)}`, payload, options),

  deleteRole: (roleId, options) => api.delete(`${PATH}/roles/${encode(roleId)}`, options),

  /** Super Admin, Admin and custom-role accounts — not students or evaluators. */
  users: (options) => api.get(`${PATH}/users`, options),

  /**
   * Application Logs, one page of the filtered feed, newest first:
   * `{ items, total, page, page_size, summary, facets }`.
   *
   * Params: `page`, `page_size` (25 | 50 | 100), `q`, `role`, `area`, `method`,
   * `outcome` (success | client_error | server_error), `window` (15m | 1h |
   * 24h | 7d), `from` / `to` (IST, replace `window`), `user_id`,
   * `min_duration_ms`. Empty values are left out. A page past the end comes
   * back as the last page. Reading this writes no log row of its own.
   */
  logs: (params = {}, options) => {
    const search = new URLSearchParams()
    Object.entries(params).forEach(([name, value]) => {
      if (value !== undefined && value !== null && value !== '' && value !== false) {
        search.set(name, String(value))
      }
    })
    const query = search.toString()
    return api.get(`${PATH}/logs${query ? `?${query}` : ''}`, options)
  },

  /**
   * Live snapshot for the Performance charts: `active_now`, the 24-point
   * `active_users_24h` series, `users_by_role`, `operations_by_area`, the
   * 24-hour request / error / duration numbers, and `poll_after_seconds`.
   */
  observation: (options) => api.get(`${PATH}/observation`, options),

  /** Body: `{ first_name, last_name, email, password, role_id }`. */
  createUser: (payload, options) => api.post(`${PATH}/users`, payload, options),

  /**
   * Body: `{ first_name, last_name, role_id }`; email cannot change. `role_id`
   * is required for Admin and custom users and must be left out for a Super
   * Admin. Answers with the updated row.
   */
  updateUser: (userId, payload, options) =>
    api.patch(`${PATH}/users/${encode(userId)}`, payload, options),

  /**
   * Removes an Admin or custom-role account from Firestore and Firebase Auth,
   * so that email can no longer sign in. 404 for an unknown id; a Super Admin
   * is refused with 409 SUPER_ADMIN_DELETE_LOCKED.
   */
  deleteUser: (userId, options) => api.delete(`${PATH}/users/${encode(userId)}`, options),
}

export const ACCESS_ERROR = {
  ROLE_BUILTIN: 'ROLE_BUILTIN',
  ROLE_EXISTS: 'ROLE_EXISTS',
  ROLE_RESERVED: 'ROLE_RESERVED',
  ROLE_IN_USE: 'ROLE_IN_USE',
  ROLE_NOT_FOUND: 'ROLE_NOT_FOUND',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  SUPER_ADMIN_ROLE_LOCKED: 'SUPER_ADMIN_ROLE_LOCKED',
  SUPER_ADMIN_DELETE_LOCKED: 'SUPER_ADMIN_DELETE_LOCKED',
}

/** What to tell the Super Admin for an access error code. */
export const ACCESS_ERROR_MESSAGES = {
  [ACCESS_ERROR.SUPER_ADMIN_DELETE_LOCKED]: 'A Super Admin account cannot be deleted.',
}
