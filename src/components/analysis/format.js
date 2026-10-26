/**
 * Display rules shared by every Analysis number. A null means there was
 * nothing to divide or add, so it shows as a dash — never as 0 or 0%.
 */
export const DASH = '—'

const isBlank = (value) => value === null || value === undefined || value === ''

/** Whole count with Indian grouping: 1200 → "1,200". */
export function count(value) {
  if (isBlank(value)) return DASH
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('en-IN') : DASH
}

/** A 0–1 fraction as a percentage: 0.25 → "25%", 0.0825 → "8.25%". */
export function rate(value) {
  if (isBlank(value)) return DASH
  const number = Number(value)
  if (!Number.isFinite(number)) return DASH
  // The API sends four decimals, so two in the percentage is everything it has.
  return `${Number((number * 100).toFixed(2))}%`
}

/** Decimal hours, two places: 3.5 → "3.50 h". */
export function hours(value) {
  if (isBlank(value)) return DASH
  const number = Number(value)
  return Number.isFinite(number) ? `${number.toFixed(2)} h` : DASH
}

/** A score out of 100 with its rating out of 10: "82 · 8.2/10". */
export function scoreWithRating(score, rating) {
  if (isBlank(score)) return DASH
  const scoreText = Number(Number(score).toFixed(2))
  if (isBlank(rating)) return String(scoreText)
  return `${scoreText} · ${Number(Number(rating).toFixed(2))}/10`
}

/** Number for a chart axis: null stays null so the mark is left out, not drawn at 0. */
export function plotValue(value) {
  if (isBlank(value)) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
