import { api } from './client'

const PROMPT_KEYS = ['checklist', 'analyze_video']

function asList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.prompts)) return payload.prompts
  return []
}

export const aiPromptsApi = {
  KEYS: PROMPT_KEYS,

  list: async (options) => asList(await api.get('/ai-evaluation-prompts', options)),

  get: (key, options) =>
    api.get(`/ai-evaluation-prompts/${encodeURIComponent(key)}`, options),

  /** Admin upsert. Body: { template: string } */
  update: (key, template, options) =>
    api.put(
      `/ai-evaluation-prompts/${encodeURIComponent(key)}`,
      { template },
      options,
    ),
}
