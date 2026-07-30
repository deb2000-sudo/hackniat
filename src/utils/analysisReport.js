/** Match heading titles for grouping markdown report sections. */
const SECTION_MATCHERS = {
  recommendation: [/recommend/i],
  keyContent: [/key content/i],
  comparison: [/comparison against context|comparision against context|comparison/i],
  discrepancies: [/discrepanc/i],
  overall: [/overall assessment/i],
  videoSummary: [/video summary/i],
  fieldScores: [/requirement field score|field score/i],
  checklist: [/validity checklist|validation checklist|checklist/i],
}

const DEMO_FIELD = /video|demo|working[_\s-]?demo|screen[_\s-]?record/i

function classifyTitle(title) {
  const normalized = String(title || '').trim()
  for (const [key, matchers] of Object.entries(SECTION_MATCHERS)) {
    if (matchers.some((matcher) => matcher.test(normalized))) return key
  }
  return 'other'
}

/**
 * Split a markdown analysis report into titled sections.
 * Supports `#`, `##`, `###` headings.
 */
export function parseMarkdownSections(markdown) {
  const text = String(markdown || '').trim()
  if (!text) return []

  const lines = text.split(/\r?\n/)
  const sections = []
  let current = null

  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.+?)\s*$/)
    if (heading) {
      if (current) sections.push(current)
      const title = heading[2].trim()
      current = {
        title,
        body: '',
        kind: classifyTitle(title),
      }
      continue
    }
    if (!current) {
      current = { title: 'Overview', body: '', kind: 'other' }
    }
    current.body = current.body ? `${current.body}\n${line}` : line
  }
  if (current) sections.push(current)

  return sections.map((section) => ({
    ...section,
    body: section.body.trim(),
  }))
}

function isDemoField(item) {
  return DEMO_FIELD.test(item?.field_key || '') || DEMO_FIELD.test(item?.field_label || '')
}

/**
 * Combine requirement field scores + working-demo score and normalize to 0–100.
 *
 * Example: 9/10 + 9/10 + 3/10 → earned 21 / max 30 → 70%.
 */
export function computeNormalizedAnalysisScore(fieldScores, { demoScore, demoMax = 10 } = {}) {
  const rows = Array.isArray(fieldScores) ? fieldScores : []
  const active = rows.filter((item) => !item?.skipped)

  const requirementRows = active.filter((item) => !isDemoField(item))
  let demoRows = active.filter((item) => isDemoField(item))

  if (!demoRows.length && demoScore != null && Number.isFinite(Number(demoScore))) {
    demoRows = [
      {
        field_key: 'working_demo',
        field_label: 'Working demo video',
        score: Number(demoScore),
        max_score: Number(demoMax) || 10,
        rationale: 'Score from the AI video analysis.',
        skipped: false,
      },
    ]
  }

  const all = [...requirementRows, ...demoRows]
  if (!all.length) return null

  const earned = all.reduce((sum, item) => sum + Number(item.score || 0), 0)
  const max = all.reduce((sum, item) => sum + Number(item.max_score ?? 10), 0)
  if (max <= 0) return null

  const percent = Math.round((earned / max) * 1000) / 10

  return {
    earned,
    max,
    percent,
    roundedPercent: Math.round(percent),
    requirementRows,
    demoRows,
    allRows: all,
  }
}

/**
 * Group parsed markdown sections for the evaluator-friendly layout.
 */
export function groupReportSections(sections) {
  const list = Array.isArray(sections) ? sections : []
  const pick = (...kinds) => list.filter((section) => kinds.includes(section.kind) && section.body)

  return {
    analysis: pick('keyContent', 'comparison', 'discrepancies', 'overall', 'other'),
    recommendations: pick('recommendation'),
    detail: pick('videoSummary', 'checklist', 'fieldScores'),
  }
}
