export function getHackathonStatus(hackathon, now = new Date()) {
  const start = new Date(`${hackathon.start_date}T00:00:00`)
  const end = new Date(`${hackathon.end_date}T23:59:59`)
  if (now < start) return { key: 'upcoming', label: 'Upcoming', variant: 'info' }
  if (now > end) return { key: 'past', label: 'Completed', variant: 'neutral' }
  return { key: 'live', label: 'Live now', variant: 'success' }
}

export function getHackathonDuration(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const days = Math.round((end - start) / 86400000) + 1
  return Number.isFinite(days) && days > 0 ? days : null
}
