/** @typedef {'ai' | 'manual'} ScoringMode */
/** @typedef {'score' | 'boolean' | 'enum'} SegmentKind */
/** @typedef {'ai' | 'evaluator' | 'pending'} ScoreSource */

/**
 * Standard metric groups, in canonical display/save order.
 *
 * A requirement can name the same concept in several ways — github_link,
 * project_github_link, github_repository_link — and the backend rejects any
 * field_key that isn't literally one of that requirement's fields. Each group
 * therefore lists the aliases we've seen plus a loose pattern so an unfamiliar
 * naming variant still resolves instead of falling back to a key the backend
 * will reject. `fallback` only applies when the requirement has no such field.
 */
const FIELD_GROUPS = {
  problem_statement: {
    aliases: ['problem_statement', 'problem'],
    pattern: /(^|_)problem(_|$)/,
    fallback: 'problem_statement',
    label: 'Problem Statement',
    color: '#2563EB',
  },
  solution_description: {
    aliases: ['solution_description', 'solution'],
    pattern: /(^|_)solution(_|$)/,
    fallback: 'solution_description',
    label: 'Solution Description',
    color: '#7C3AED',
  },
  video_explanation: {
    aliases: ['video_explanation', 'video'],
    pattern: /(^|_)video(_|$)/,
    fallback: 'video_explanation',
    label: 'Video Explanation',
    color: '#DB2777',
    // Scored from the uploaded demo, not from a requirement field.
    synthetic: true,
  },
  github: {
    aliases: [
      'project_github_link',
      'github_repository_link',
      'github_link',
      'github_url',
      'repository_link',
      'repo_link',
      'github',
    ],
    pattern: /(^|_)(github|repo|repository)(_|$)/,
    fallback: 'github_link',
    label: 'GitHub Full Stack',
    color: '#059669',
  },
  mvp: {
    // The deployed/hosted build of the project. Requirements name this either
    // after the MVP or after the deployment — project_deployed_link is the
    // current standard requirement's key — so both vocabularies map here.
    aliases: [
      'mvp_link',
      'mvp_url',
      'mvp',
      'project_deployed_link',
      'deployed_link',
      'deployment_link',
      'deployed_url',
      'live_link',
      'live_url',
      'hosted_link',
      'hosted_url',
    ],
    pattern: /(^|_)(mvp|deployed|deployment|hosted|live)(_|$)/,
    fallback: 'mvp_link',
    label: 'MVP Features',
    color: '#D97706',
  },
}

const GROUP_ORDER = Object.keys(FIELD_GROUPS)

/** Keyed by every known alias so `COLORS[metric.field_key]` works for any variant. */
export const STANDARD_SCORECARD_COLORS = Object.fromEntries(
  GROUP_ORDER.flatMap((name) =>
    FIELD_GROUPS[name].aliases.map((alias) => [alias, FIELD_GROUPS[name].color]),
  ),
)

function normalizeFieldKey(value) {
  return String(value || '').trim().toLowerCase()
}

/* --------------------------- Enum segment options -------------------------- */

/**
 * Enum options are stored as `{value, label, score}`, but scorecards written
 * before graded levels existed hold plain strings. Normalizing on read means
 * every caller sees one shape, and a legacy option scores 0 — which is exactly
 * what an ungraded choice always was.
 *
 * Mirrors the backend's `coerce_segment_option`.
 */
export function normalizeSegmentOptions(options) {
  if (!Array.isArray(options)) return []
  return options
    .map((option) => {
      if (typeof option === 'string') {
        const text = option.trim()
        return text ? { value: text, label: text, score: 0 } : null
      }
      if (!option || typeof option !== 'object') return null
      const value = String(option.value ?? option.key ?? option.label ?? '').trim()
      const label = String(option.label ?? option.value ?? option.key ?? '').trim()
      if (!value && !label) return null
      const score = Number(option.score)
      return {
        value: value || label,
        label: label || value,
        score: Number.isFinite(score) ? score : 0,
      }
    })
    .filter(Boolean)
}

/**
 * A *graded* enum awards marks for the level picked (Fully 5 / Partial 3 / …).
 * An ungraded one is a plain label choice carrying no marks, like GitHub
 * public/private. Mirrors the backend's `enum_options_are_scored`.
 */
export function enumOptionsAreScored(options) {
  return normalizeSegmentOptions(options).some((option) => Number(option.score) > 0)
}

/**
 * The highest mark a segment can actually award — for a graded enum that is its
 * best option, not its declared max. Deliberately *uncapped* so it matches the
 * backend's `segment_effective_max`: the gap between this and `max_score` is
 * precisely what the admin warning is there to report.
 */
export function segmentEffectiveMax(segment) {
  const options = normalizeSegmentOptions(segment?.options)
  if (segment?.kind === 'enum' && enumOptionsAreScored(options)) {
    return options.reduce((best, option) => Math.max(best, Number(option.score) || 0), 0)
  }
  return Number(segment?.max_score) || 0
}

/** Marks for one chosen enum option — a single pick, never a sum of options. */
function awardForEnumChoice(segment, value) {
  const options = normalizeSegmentOptions(segment?.options)
  const chosen = options.find((option) => option.value === value)
  const cap = Number(segment?.max_score) || 0
  const awarded = Number(chosen?.score) || 0
  return cap > 0 ? Math.min(awarded, cap) : awarded
}

/** Parent metrics never exceed their own max, however the segments add up. */
function capToMetricMax(total, metric) {
  const max = Number(metric?.max_score) || 0
  return max > 0 ? Math.min(total, max) : total
}

/**
 * Read a draft entry, which is either a `{value}` / `{score}` wrapper or a bare
 * scalar from an older call site.
 *
 * The obvious `entry.value ?? draft[key]` falls through to the wrapper *object*
 * whenever the stored value is null — and `draftFromScorecard` seeds exactly
 * `{value: null}` for an untouched segment. That object is neither null nor '',
 * so the segment reads as answered and submits `{value: null}` as the
 * evaluator's pick. Returning null for an empty wrapper is the whole point.
 */
function readDraftEntry(entry, ...fields) {
  if (entry == null) return null
  if (typeof entry !== 'object' || Array.isArray(entry)) return entry
  for (const field of fields) {
    if (entry[field] != null) return entry[field]
  }
  return null
}

/** Which standard group a field key belongs to, or null for a custom metric. */
export function groupForFieldKey(fieldKey) {
  const key = normalizeFieldKey(fieldKey)
  if (!key) return null
  for (const name of GROUP_ORDER) {
    if (FIELD_GROUPS[name].aliases.includes(key)) return name
  }
  for (const name of GROUP_ORDER) {
    if (FIELD_GROUPS[name].pattern.test(key)) return name
  }
  return null
}

export function isGithubFieldKey(fieldKey) {
  return groupForFieldKey(fieldKey) === 'github'
}

/**
 * The scorecard metric the GitHub AI result maps onto.
 *
 * Matches through isGithubFieldKey rather than a fixed key list, so a
 * requirement naming the field project_github_link, github_url, repo_link (or
 * anything else in the github group) still resolves.
 */
export function getGithubMetric(scorecard) {
  return scorecard?.metrics?.find((metric) => isGithubFieldKey(metric?.field_key)) || null
}

export function isMvpFieldKey(fieldKey) {
  return groupForFieldKey(fieldKey) === 'mvp'
}

/** Resolve a student link from legacy columns or dynamic field_answers. */
export function submissionLinkForGroup(submission, groupName) {
  if (!submission) return null
  const direct =
    groupName === 'github'
      ? submission.github_link
      : groupName === 'mvp'
        ? submission.mvp_link
        : null
  if (String(direct || '').trim()) return String(direct).trim()

  const answers = submission.field_answers || {}
  const group = FIELD_GROUPS[groupName]
  if (!group) return null

  for (const alias of group.aliases) {
    const value = String(answers[alias] || '').trim()
    if (value) return value
  }
  for (const [key, value] of Object.entries(answers)) {
    if (groupForFieldKey(key) === groupName && String(value || '').trim()) {
      return String(value).trim()
    }
  }
  return null
}

/** Pick the requirement’s real field key for a group (fallback if it has none). */
export function resolveRequirementFieldKey(requirementFields, groupName) {
  const group = FIELD_GROUPS[groupName]
  const list = Array.isArray(requirementFields) ? requirementFields : []
  const find = (predicate) => list.find((field) => predicate(normalizeFieldKey(field?.key)))

  let match = null
  for (const alias of group?.aliases || []) {
    match = find((key) => key === alias)
    if (match) break
  }
  if (!match && group?.pattern) match = find((key) => group.pattern.test(key))

  if (match?.key) {
    return {
      key: String(match.key).trim(),
      label: String(match.label || '').trim() || null,
    }
  }
  return { key: group?.fallback || '', label: null }
}

/** Remap alias keys (e.g. github_link) onto the requirement’s exact keys. */
export function alignMetricsToRequirement(metrics, requirementFields) {
  const cache = {}
  const resolve = (groupName) => {
    if (!(groupName in cache)) {
      cache[groupName] = resolveRequirementFieldKey(requirementFields, groupName)
    }
    return cache[groupName]
  }

  return (Array.isArray(metrics) ? metrics : []).map((metric) => {
    const groupName = groupForFieldKey(metric?.field_key)
    if (!groupName || FIELD_GROUPS[groupName].synthetic) return metric

    const target = resolve(groupName)
    if (!target.key || normalizeFieldKey(target.key) === normalizeFieldKey(metric?.field_key)) {
      return metric
    }
    return {
      ...metric,
      field_key: target.key,
      field_label: target.label || metric.field_label || target.key,
    }
  })
}

/** Keep Problem Statement before Solution Description (and other groups in preset order). */
export function sortScorecardMetrics(metrics) {
  const list = Array.isArray(metrics) ? [...metrics] : []
  const rank = (key) => {
    const index = GROUP_ORDER.indexOf(groupForFieldKey(key))
    return index === -1 ? GROUP_ORDER.length : index
  }
  return list.sort((a, b) => {
    const diff = rank(a?.field_key) - rank(b?.field_key)
    if (diff !== 0) return diff
    return String(a?.field_key || '').localeCompare(String(b?.field_key || ''))
  })
}

const DEFAULT_AI_PROMPTS = {
  problem_statement:
    'Score the problem statement from 0–15 for clarity, relevance to the theme, and evidence of real user need.',
  solution_description:
    'Score the solution description from 0–15 for feasibility, technical depth, and how well it addresses the stated problem.',
}

/**
 * Standard 15/15/20/20/30 scorecard preset for admin “Load preset”.
 * Uses exact requirement field keys when provided (e.g. project_github_link).
 */
export function buildStandardScorecardPreset(evaluationRequirementId, requirementFields = []) {
  const problem = resolveRequirementFieldKey(requirementFields, 'problem_statement')
  const solution = resolveRequirementFieldKey(requirementFields, 'solution_description')
  const github = resolveRequirementFieldKey(requirementFields, 'github')
  const mvp = resolveRequirementFieldKey(requirementFields, 'mvp')

  return {
    evaluation_requirement_id: evaluationRequirementId,
    name: 'Standard Hackathon Scorecard',
    metrics: [
      {
        field_key: problem.key,
        field_label: problem.label || FIELD_GROUPS.problem_statement.label,
        scoring_mode: 'ai',
        max_score: 15,
        weight: 15,
        color: FIELD_GROUPS.problem_statement.color,
        scoring_prompt: DEFAULT_AI_PROMPTS.problem_statement,
      },
      {
        field_key: solution.key,
        field_label: solution.label || FIELD_GROUPS.solution_description.label,
        scoring_mode: 'ai',
        max_score: 15,
        weight: 15,
        color: FIELD_GROUPS.solution_description.color,
        scoring_prompt: DEFAULT_AI_PROMPTS.solution_description,
      },
      {
        field_key: FIELD_GROUPS.video_explanation.fallback,
        field_label: FIELD_GROUPS.video_explanation.label,
        scoring_mode: 'ai',
        max_score: 20,
        weight: 20,
        color: FIELD_GROUPS.video_explanation.color,
        // Prompt lives under AI prompts (analyze_video); backend clears scorecard prompt.
        scoring_prompt: null,
      },
      {
        field_key: github.key,
        field_label: github.label || FIELD_GROUPS.github.label,
        scoring_mode: 'manual',
        max_score: 20,
        weight: 20,
        color: FIELD_GROUPS.github.color,
        segments: [
          {
            key: 'visibility',
            label: 'GitHub is Public or Private',
            kind: 'enum',
            options: ['public', 'private'],
            max_score: 0,
          },
          {
            key: 'structure_score',
            label: 'Full Stack Verification',
            kind: 'score',
            max_score: 20,
            description:
              'Fullstack+README+FE/BE folders+prod link=20; FE or BE only=10; broken/localhost/lovable=5. Private=0.',
          },
        ],
      },
      {
        field_key: mvp.key,
        field_label: mvp.label || FIELD_GROUPS.mvp.label,
        scoring_mode: 'manual',
        max_score: 30,
        weight: 30,
        color: FIELD_GROUPS.mvp.color,
        segments: [
          { key: 'authentication', label: 'Authentication', kind: 'boolean', max_score: 5 },
          { key: 'data_persistence', label: 'Data Persistence', kind: 'boolean', max_score: 5 },
          { key: 'realtime_data', label: 'Real time data', kind: 'boolean', max_score: 5 },
          { key: 'ai_features', label: 'AI Features Working', kind: 'boolean', max_score: 5 },
          { key: 'mobile_responsive', label: 'Mobile Responsive', kind: 'boolean', max_score: 5 },
          { key: 'ui_quality', label: 'UI Quality', kind: 'boolean', max_score: 5 },
        ],
      },
    ],
  }
}

export function sumWeights(metrics) {
  return (metrics || []).reduce((sum, metric) => sum + Number(metric.weight || 0), 0)
}

export function weightedContribution(score, maxScore, weight) {
  const max = Number(maxScore) || 0
  const w = Number(weight) || 0
  if (max <= 0 || score == null || !Number.isFinite(Number(score))) return null
  return (Number(score) / max) * w
}

/** Recompute a scorecard total from a local manual draft (evaluator live preview). */
export function previewScorecard(scorecard, draftByFieldKey = {}, previewOptions = {}) {
  const { overrideAi = false, aiOverrideByFieldKey = {} } = previewOptions
  if (!scorecard?.metrics?.length) {
    return {
      metrics: [],
      computed_total: null,
      max_total: 100,
      ai_total: null,
      manual_total: null,
      complete: false,
    }
  }

  let aiTotal = 0
  let manualTotal = 0
  let hasAi = false
  let hasManual = false
  let complete = true

  const metrics = scorecard.metrics.map((metric) => {
    let score = metric.score
    let source = metric.source || (metric.score != null ? metric.scoring_mode : 'pending')
    let segments = metric.segments

    if (metric.scoring_mode === 'manual') {
      const computed = computeManualMetricScore(metric, draftByFieldKey[metric.field_key] || {})
      score = computed.score
      segments = computed.segments
      source = score != null ? 'evaluator' : 'pending'
    }

    if (metric.scoring_mode === 'ai') {
      if (overrideAi) {
        const rawOverride = aiOverrideByFieldKey[metric.field_key]
        if (rawOverride != null && rawOverride !== '') {
          const overrideScore = Number(rawOverride)
          if (Number.isFinite(overrideScore)) {
            score = overrideScore
            source = 'evaluator_override'
          }
        }
      }
      if (score == null && !metric.skipped) complete = false
      const weighted = weightedContribution(score, metric.max_score, metric.weight)
      if (weighted != null) {
        aiTotal += weighted
        hasAi = true
      }
      return {
        ...metric,
        score,
        source,
        segments,
        weighted_score: weighted,
      }
    }

    if (score == null) complete = false
    const weighted = weightedContribution(score, metric.max_score, metric.weight)
    if (weighted != null) {
      manualTotal += weighted
      hasManual = true
    }
    return {
      ...metric,
      score,
      source,
      segments,
      weighted_score: weighted,
    }
  })

  const computed =
    hasAi || hasManual
      ? Math.round((aiTotal + manualTotal) * 10) / 10
      : null

  return {
    ...scorecard,
    metrics,
    computed_total: computed,
    max_total: scorecard.max_total ?? 100,
    ai_total: hasAi ? Math.round(aiTotal * 10) / 10 : null,
    manual_total: hasManual ? Math.round(manualTotal * 10) / 10 : null,
    complete,
  }
}

/**
 * Compute a manual metric score from segment draft values.
 * draft: { [segmentKey]: { value?, score? } }
 */
export function computeManualMetricScore(metric, draft = {}) {
  const defs = metric.segments || []
  if (!defs.length) {
    const score = draft.score != null ? Number(draft.score) : metric.score
    return {
      score: Number.isFinite(score) ? score : null,
      segments: metric.segments,
    }
  }

  // GitHub: private visibility forces 0 and skips structure.
  if (isGithubFieldKey(metric.field_key)) {
    const visibility = readDraftEntry(draft.visibility, 'value')
    const structure = readDraftEntry(draft.structure_score, 'score', 'value')
    const isPrivate = String(visibility || '').toLowerCase() === 'private'
    const isPublic = String(visibility || '').toLowerCase() === 'public'
    const score = isPrivate
      ? 0
      : isPublic && structure != null && structure !== ''
        ? Number(structure)
        : null
    const segments = defs.map((segment) => {
      if (segment.key === 'visibility') {
        return {
          ...segment,
          value: visibility ?? null,
          score: null,
        }
      }
      if (segment.key === 'structure_score') {
        return {
          ...segment,
          value: isPrivate ? null : structure ?? null,
          score: isPrivate ? 0 : score,
        }
      }
      return { ...segment, value: draft[segment.key]?.value ?? null, score: null }
    })
    return {
      score: visibility == null || visibility === '' ? null : Number.isFinite(score) ? score : null,
      segments,
    }
  }

  // Boolean MVP-style: sum checked max_score
  if (defs.every((segment) => segment.kind === 'boolean')) {
    let total = 0
    let answered = 0
    const segments = defs.map((segment) => {
      const raw = draft[segment.key]?.value ?? draft[segment.key]
      const checked = raw === true || raw === 'true'
      const unanswered = raw == null || raw === ''
      if (!unanswered) answered += 1
      const segmentScore = unanswered ? null : checked ? Number(segment.max_score || 0) : 0
      if (segmentScore != null) total += segmentScore
      return {
        ...segment,
        value: unanswered ? null : checked,
        score: segmentScore,
      }
    })
    return {
      score: answered === defs.length ? capToMetricMax(total, metric) : null,
      segments,
    }
  }

  // Generic: sum numeric segment scores / boolean contributions
  let total = 0
  let answered = 0
  const segments = defs.map((segment) => {
    const entry = draft[segment.key]
    if (segment.kind === 'boolean') {
      const raw = readDraftEntry(entry, 'value')
      const unanswered = raw == null || raw === ''
      if (!unanswered) answered += 1
      const checked = raw === true || raw === 'true'
      const segmentScore = unanswered ? null : checked ? Number(segment.max_score || 0) : 0
      if (segmentScore != null) total += segmentScore
      return { ...segment, value: unanswered ? null : checked, score: segmentScore }
    }
    if (segment.kind === 'score') {
      const raw = readDraftEntry(entry, 'score', 'value')
      const unanswered = raw == null || raw === ''
      if (!unanswered) answered += 1
      const segmentScore = unanswered ? null : Number(raw)
      if (segmentScore != null && Number.isFinite(segmentScore)) total += segmentScore
      return { ...segment, value: unanswered ? null : Number(raw), score: segmentScore }
    }
    // enum / other
    const value = readDraftEntry(entry, 'value')
    const unanswered = value == null || value === ''
    if (!unanswered) answered += 1

    // An ungraded enum (GitHub public/private) records a choice but awards
    // nothing; a graded one awards the chosen level, capped at its own max.
    if (!enumOptionsAreScored(segment.options)) {
      return { ...segment, value, score: null }
    }
    const segmentScore = unanswered ? null : awardForEnumChoice(segment, value)
    if (segmentScore != null) total += segmentScore
    return { ...segment, value, score: segmentScore }
  })

  return {
    score: answered === defs.length ? capToMetricMax(total, metric) : null,
    segments,
  }
}

/** Seed evaluator AI override draft from existing scorecard AI scores. */
export function aiOverridesFromScorecard(scorecard) {
  const overrides = {}
  for (const metric of scorecard?.metrics || []) {
    if (metric.scoring_mode === 'ai' && metric.score != null) {
      overrides[metric.field_key] = metric.score
    }
  }
  return overrides
}

/** Build API ai_overrides payload when evaluator overrides AI metric scores. */
export function buildAiOverridesPayload(scorecard, aiOverrideByFieldKey = {}) {
  return (scorecard?.metrics || [])
    .filter((metric) => metric.scoring_mode === 'ai')
    .map((metric) => ({
      field_key: metric.field_key,
      score: Number(aiOverrideByFieldKey[metric.field_key]),
    }))
    .filter((item) => Number.isFinite(item.score))
}

/** Build API manual_metrics payload from draft + metric defs. */
export function buildManualMetricsPayload(scorecard, draftByFieldKey = {}) {
  return (scorecard?.metrics || [])
    .filter((metric) => metric.scoring_mode === 'manual')
    .map((metric) => {
      const draft = draftByFieldKey[metric.field_key] || {}
      const { segments } = computeManualMetricScore(metric, draft)

      if (isGithubFieldKey(metric.field_key)) {
        const visibility = readDraftEntry(draft.visibility, 'value')
        const structure = readDraftEntry(draft.structure_score, 'score', 'value')
        const isPrivate = String(visibility || '').toLowerCase() === 'private'
        const segmentPayload = [{ key: 'visibility', value: visibility }]
        if (!isPrivate && structure != null && structure !== '') {
          segmentPayload.push({ key: 'structure_score', score: Number(structure) })
        }
        return { field_key: metric.field_key, segments: segmentPayload }
      }

      return {
        field_key: metric.field_key,
        segments: (segments || metric.segments || []).map((segment) => {
          if (segment.kind === 'boolean') {
            return { key: segment.key, value: Boolean(segment.value) }
          }
          if (segment.kind === 'score') {
            return { key: segment.key, score: Number(segment.score ?? segment.value) }
          }
          return { key: segment.key, value: segment.value }
        }),
      }
    })
}

/** Seed evaluator draft from existing scorecard segment values. */
export function draftFromScorecard(scorecard) {
  const draft = {}
  for (const metric of scorecard?.metrics || []) {
    if (metric.scoring_mode !== 'manual') continue
    const entry = {}
    for (const segment of metric.segments || []) {
      if (segment.kind === 'score') {
        entry[segment.key] = {
          score: segment.score ?? segment.value ?? '',
          value: segment.value ?? segment.score ?? '',
        }
      } else if (segment.kind === 'boolean') {
        // Unchecked is a valid 0 — seed false so MVP can be submitted immediately.
        entry[segment.key] = {
          value: segment.value == null ? false : Boolean(segment.value),
        }
      } else {
        entry[segment.key] = {
          value: segment.value ?? null,
        }
      }
    }
    draft[metric.field_key] = entry
  }
  return draft
}

export function getScorecard(submission) {
  return (
    submission?.scorecard ||
    submission?.analysis?.scorecard ||
    submission?.result?.scorecard ||
    null
  )
}

export function isManualScoringComplete(scorecard, draftByFieldKey) {
  const preview = previewScorecard(scorecard, draftByFieldKey)
  const manual = preview.metrics.filter((metric) => metric.scoring_mode === 'manual')
  if (!manual.length) return preview.complete
  return manual.every((metric) => metric.score != null)
}
