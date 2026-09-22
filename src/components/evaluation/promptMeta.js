/**
 * Card copy for the two Gemini analysis prompts.
 *
 * Shared by Application → Video Analysis (the global templates) and a
 * hackathon's Settings page (per-hackathon overrides) so the same prompt reads
 * identically in both places. The placeholder chips a card shows come from the
 * API response — these are only the title and the blurb under it.
 */
export const PROMPT_META = {
  checklist: {
    title: 'Validity checklist',
    description: 'Template used to validate problem and solution text before scoring.',
    placeholders: ['{problem_statement}', '{solution_description}'],
  },
  analyze_video: {
    title: 'Video analysis',
    description: 'Template used when a working demo video is present.',
    placeholders: ['{context}'],
  },
}
