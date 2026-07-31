/** @typedef {'ai' | 'manual'} ScoringMode */
/** @typedef {'score' | 'boolean' | 'enum'} SegmentKind */
/** @typedef {'ai' | 'evaluator' | 'pending'} ScoreSource */

export const STANDARD_SCORECARD_COLORS = {
  problem_statement: '#2563EB',
  solution_description: '#7C3AED',
  video_explanation: '#DB2777',
  github_link: '#059669',
  mvp_link: '#D97706',
}

const DEFAULT_AI_PROMPTS = {
  problem_statement:
    'Score the problem statement from 0–15 for clarity, relevance to the theme, and evidence of real user need.',
  solution_description:
    'Score the solution description from 0–15 for feasibility, technical depth, and how well it addresses the stated problem.',
  video_explanation:
    'Score the demo video explanation from 0–20 using the analysis report. Reward clear walkthrough, working features shown, and alignment with the written solution.',
}

/** Standard 15/15/20/20/30 scorecard preset for admin “Load preset”. */
export function buildStandardScorecardPreset(evaluationRequirementId) {
  return {
    evaluation_requirement_id: evaluationRequirementId,
    name: 'Standard Hackathon Scorecard',
    metrics: [
      {
        field_key: 'problem_statement',
        field_label: 'Problem Statement',
        scoring_mode: 'ai',
        max_score: 15,
        weight: 15,
        color: STANDARD_SCORECARD_COLORS.problem_statement,
        scoring_prompt: DEFAULT_AI_PROMPTS.problem_statement,
      },
      {
        field_key: 'solution_description',
        field_label: 'Solution Description',
        scoring_mode: 'ai',
        max_score: 15,
        weight: 15,
        color: STANDARD_SCORECARD_COLORS.solution_description,
        scoring_prompt: DEFAULT_AI_PROMPTS.solution_description,
      },
      {
        field_key: 'video_explanation',
        field_label: 'Video Explanation',
        scoring_mode: 'ai',
        max_score: 20,
        weight: 20,
        color: STANDARD_SCORECARD_COLORS.video_explanation,
        scoring_prompt: DEFAULT_AI_PROMPTS.video_explanation,
      },
      {
        field_key: 'github_link',
        field_label: 'GitHub Full Stack',
        scoring_mode: 'manual',
        max_score: 20,
        weight: 20,
        color: STANDARD_SCORECARD_COLORS.github_link,
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
        field_key: 'mvp_link',
        field_label: 'MVP Features',
        scoring_mode: 'manual',
        max_score: 30,
        weight: 30,
        color: STANDARD_SCORECARD_COLORS.mvp_link,
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
export function previewScorecard(scorecard, draftByFieldKey = {}) {
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
    const draft = draftByFieldKey[metric.field_key]
    let score = metric.score
    let source = metric.source || (metric.score != null ? metric.scoring_mode : 'pending')
    let segments = metric.segments

    if (metric.scoring_mode === 'manual' && draft) {
      const computed = computeManualMetricScore(metric, draft)
      score = computed.score
      segments = computed.segments
      source = score != null ? 'evaluator' : 'pending'
    }

    if (metric.scoring_mode === 'ai') {
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
  if (metric.field_key === 'github_link' || metric.field_key === 'project_github_link') {
    const visibility = draft.visibility?.value ?? draft.visibility
    const structure =
      draft.structure_score?.score ??
      draft.structure_score?.value ??
      draft.structure_score
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
      score: answered === defs.length ? total : null,
      segments,
    }
  }

  // Generic: sum numeric segment scores / boolean contributions
  let total = 0
  let answered = 0
  const segments = defs.map((segment) => {
    const entry = draft[segment.key] || {}
    if (segment.kind === 'boolean') {
      const raw = entry.value ?? draft[segment.key]
      const unanswered = raw == null || raw === ''
      if (!unanswered) answered += 1
      const checked = raw === true || raw === 'true'
      const segmentScore = unanswered ? null : checked ? Number(segment.max_score || 0) : 0
      if (segmentScore != null) total += segmentScore
      return { ...segment, value: unanswered ? null : checked, score: segmentScore }
    }
    if (segment.kind === 'score') {
      const raw = entry.score ?? entry.value ?? draft[segment.key]
      const unanswered = raw == null || raw === ''
      if (!unanswered) answered += 1
      const segmentScore = unanswered ? null : Number(raw)
      if (segmentScore != null && Number.isFinite(segmentScore)) total += segmentScore
      return { ...segment, value: unanswered ? null : Number(raw), score: segmentScore }
    }
    // enum / other
    const value = entry.value ?? draft[segment.key] ?? null
    if (value != null && value !== '') answered += 1
    return { ...segment, value, score: null }
  })

  return {
    score: answered === defs.length ? total : null,
    segments,
  }
}

/** Build API manual_metrics payload from draft + metric defs. */
export function buildManualMetricsPayload(scorecard, draftByFieldKey = {}) {
  return (scorecard?.metrics || [])
    .filter((metric) => metric.scoring_mode === 'manual')
    .map((metric) => {
      const draft = draftByFieldKey[metric.field_key] || {}
      const { segments } = computeManualMetricScore(metric, draft)

      if (metric.field_key === 'github_link' || metric.field_key === 'project_github_link') {
        const visibility = draft.visibility?.value ?? draft.visibility
        const structure =
          draft.structure_score?.score ??
          draft.structure_score?.value ??
          draft.structure_score
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
