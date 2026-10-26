import { api } from './client'

const PATH = '/admin/analysis'

/**
 * The Analysis screen: read-only numbers for hackathons and evaluators.
 *
 * Super Admin, built-in Admin, and custom roles with `analysis` may call these;
 * anyone else gets 403 "Admin access required". The API paths are /admin/… for
 * every role. Nothing here writes.
 *
 * Shared conventions in every response: scores are out of 100 and each comes
 * with a `…_rating` out of 10 already computed; rates are 0–1 fractions; hours
 * are decimal; a null rate, average, hour or headcount means there was nothing
 * to divide or add, and is shown as a dash rather than zero.
 */
export const analysisApi = {
  /**
   * Filter choices: `{ hackathons, evaluators, top_n_choices }`. Hackathons are
   * newest start date first; evaluators include pending accounts, sorted by
   * name. This evaluator list is only for the speed filter — it is not the
   * Submissions assign dropdown.
   */
  options: (options) => api.get(`${PATH}/options`, options),

  /**
   * Body: `{ hackathon_ids, top_n }` — 1 to 12 ids, `top_n` 1–20. The
   * `hackathons` array follows the order of `hackathon_ids`. An unknown id is
   * 404 HACKATHON_NOT_FOUND.
   */
  hackathons: (payload, options) => api.post(`${PATH}/hackathons`, payload, options),

  /**
   * Body: `{ hackathon_ids, evaluator_ids, from_date, to_date }`. Empty id
   * lists mean "all"; an empty date leaves that end open, and both ends are
   * included. At most 12 hackathons and 50 evaluators; from after to is 400.
   */
  evaluators: (payload, options) => api.post(`${PATH}/evaluators`, payload, options),
}
