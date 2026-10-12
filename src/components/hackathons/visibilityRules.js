/**
 * Selection rules for the Hackathon visibility form, kept apart from the panel
 * so they can be read (and tested) on their own.
 *
 * A student sees a hackathon when their university AND their batch both match.
 * "All" on either side is a rule, not a snapshot: it stays open to universities
 * and batches created later, so it is saved as the flag with an empty id list.
 *
 * Form state: { allUniversities, allBatches, universityIds: Set, batchIds: Set }.
 * While a Select all is on, every row on that side is shown checked.
 */

const ids = (rows) => rows.map((row) => row.id)

/** The form state for a GET or PUT response. */
export function formFromResponse(payload) {
  const universities = Array.isArray(payload?.universities) ? payload.universities : []
  const batches = Array.isArray(payload?.batches) ? payload.batches : []
  const allUniversities = payload?.all_universities !== false
  const allBatches = payload?.all_batches !== false
  return {
    allUniversities,
    allBatches,
    universityIds: new Set(allUniversities ? ids(universities) : payload?.university_ids || []),
    batchIds: new Set(allBatches ? ids(batches) : payload?.batch_ids || []),
  }
}

/**
 * Batches the admin can pick from: all of them while every university is
 * allowed, otherwise only those at a checked university.
 */
export function visibleBatches(form, batches) {
  if (form.allUniversities) return batches
  return batches.filter((batch) => form.universityIds.has(batch.university_id))
}

/** Drop picked batches whose university is no longer checked. */
function pruneBatches(form, batches) {
  if (form.allUniversities || form.allBatches) return form
  const allowed = new Set(ids(visibleBatches(form, batches)))
  return { ...form, batchIds: new Set([...form.batchIds].filter((id) => allowed.has(id))) }
}

/** The universities "Select all" box: on checks every row, off clears them. */
export function setAllUniversities(form, on, universities, batches) {
  return pruneBatches(
    { ...form, allUniversities: on, universityIds: new Set(on ? ids(universities) : []) },
    batches,
  )
}

/**
 * One university row. Unchecking a row while Select all is on turns Select all
 * off and keeps the others checked; checking the last unchecked row turns it
 * back on. Batches at a university that drops out leave the selection.
 */
export function toggleUniversity(form, id, universities, batches) {
  const next = new Set(form.universityIds)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  const everyOne = universities.length > 0 && universities.every((row) => next.has(row.id))
  return pruneBatches({ ...form, allUniversities: everyOne, universityIds: next }, batches)
}

/** The batches "Select all" box. */
export function setAllBatches(form, on, batches) {
  return { ...form, allBatches: on, batchIds: new Set(on ? ids(batches) : []) }
}

/**
 * One batch row, judged against the batches currently on screen. Unchecking
 * while Select all is on keeps the other visible rows; checking the last
 * visible one turns Select all back on.
 */
export function toggleBatch(form, id, batches) {
  const shown = visibleBatches(form, batches)
  const base = form.allBatches ? new Set(ids(shown)) : new Set(form.batchIds)
  if (base.has(id)) base.delete(id)
  else base.add(id)
  const everyOne = shown.length > 0 && shown.every((row) => base.has(row.id))
  return everyOne ? setAllBatches(form, true, batches) : { ...form, allBatches: false, batchIds: base }
}

/** The PUT body. An "all" side sends its flag and an empty list. */
export function visibilityPayload(form, batches) {
  const shownBatchIds = new Set(ids(visibleBatches(form, batches)))
  return {
    all_universities: form.allUniversities,
    all_batches: form.allBatches,
    university_ids: form.allUniversities ? [] : [...form.universityIds],
    // Only batches still on screen: a batch at an unchecked university is
    // rejected by the API ("Each selected batch must belong to a selected
    // university").
    batch_ids: form.allBatches ? [] : [...form.batchIds].filter((id) => shownBatchIds.has(id)),
  }
}

/** Why Save is off, or '' when it can save. */
export function saveBlocker(form, batches) {
  if (!form.allUniversities && form.universityIds.size === 0) {
    return 'Select at least one university, or choose all universities'
  }
  if (!form.allBatches && visibilityPayload(form, batches).batch_ids.length === 0) {
    return 'Select at least one batch, or choose all batches'
  }
  return ''
}

/** Plain-language summary of who will see the hackathon. */
export function visibilitySummary(form) {
  if (form.allUniversities && form.allBatches) {
    return 'Every student can see this hackathon, including universities and batches added later.'
  }
  if (!form.allUniversities && form.allBatches) {
    return 'Students at the selected universities can see it, in any batch.'
  }
  if (form.allUniversities && !form.allBatches) {
    return 'Only students in the selected batches can see it.'
  }
  return 'A student must be in one of the selected universities and one of the selected batches.'
}
