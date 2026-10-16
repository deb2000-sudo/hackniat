import { APP_TIMEZONE, formatDate } from './format'

/**
 * Hackathon and round schedules: a calendar date (YYYY-MM-DD) plus an IST
 * clock (24-hour HH:MM). The window is open from the start minute through the
 * end minute inclusive — at 6:00 PM a window ending 18:00 is still open, at
 * 6:01 PM it is closed. A missing time means the whole day: 00:00 to 23:59, so
 * events saved before times existed behave exactly as they always did.
 */

export const DEFAULT_START_TIME = '00:00'
export const DEFAULT_END_TIME = '23:59'

/**
 * A time as zero-padded 24-hour HH:MM ("9:30" → "09:30", "18:00:00" →
 * "18:00"), or `fallback` when it is missing or not a real time.
 */
export function normalizeTime(value, fallback = '') {
  const match = String(value ?? '').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return fallback
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return fallback
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** "09:30" → "9:30 AM", "00:00" → "12:00 AM", "23:59" → "11:59 PM". */
export function formatTime12(value) {
  const time = normalizeTime(value)
  if (!time) return ''
  const [hours, minutes] = time.split(':').map(Number)
  const suffix = hours < 12 ? 'AM' : 'PM'
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

/**
 * Now in IST as { date: 'YYYY-MM-DD', time: 'HH:MM' }. Built with
 * Asia/Kolkata, never toISOString() — UTC is the previous day for the first
 * 5.5 hours of every IST day.
 */
export function nowInAppTimezone(at = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

/** Sortable "YYYY-MM-DDTHH:MM" for a schedule edge; '' with no date. */
function moment(date, time, fallbackTime) {
  return date ? `${date}T${normalizeTime(time, fallbackTime)}` : ''
}

export const startMoment = (item) => moment(item?.start_date, item?.start_time, DEFAULT_START_TIME)
export const endMoment = (item) => moment(item?.end_date, item?.end_time, DEFAULT_END_TIME)

/** "16 Oct 2026, 9:30 AM IST". */
export function formatScheduleMoment(date, time, fallbackTime) {
  if (!date) return ''
  return `${formatDate(date)}, ${formatTime12(normalizeTime(time, fallbackTime))} IST`
}

export const formatStart = (item) =>
  formatScheduleMoment(item?.start_date, item?.start_time, DEFAULT_START_TIME)
export const formatEnd = (item) =>
  formatScheduleMoment(item?.end_date, item?.end_time, DEFAULT_END_TIME)

/**
 * Where `item` (a hackathon or a round) stands right now, by the minute:
 * 'scheduled' before the start minute, 'closed' after the end minute, else
 * 'open'. An edge with no date never blocks.
 */
export function scheduleStatus(item, now = nowInAppTimezone()) {
  const current = `${now.date}T${now.time}`
  const start = startMoment(item)
  const end = endMoment(item)
  if (start && current < start) return 'scheduled'
  if (end && current > end) return 'closed'
  return 'open'
}

/**
 * A window as one line, with IST once: "16 Oct 2026, 9:30 AM – 6:00 PM IST" on
 * a single day, "16 Oct 2026, 9:30 AM – 18 Oct 2026, 6:00 PM IST" across days.
 */
export function formatScheduleRange(item) {
  const start = item?.start_date
  const end = item?.end_date
  const startTime = formatTime12(normalizeTime(item?.start_time, DEFAULT_START_TIME))
  const endTime = formatTime12(normalizeTime(item?.end_time, DEFAULT_END_TIME))
  if (start && end) {
    return start === end
      ? `${formatDate(start)}, ${startTime} – ${endTime} IST`
      : `${formatDate(start)}, ${startTime} – ${formatDate(end)}, ${endTime} IST`
  }
  if (start) return `From ${formatDate(start)}, ${startTime} IST`
  if (end) return `Until ${formatDate(end)}, ${endTime} IST`
  return ''
}
