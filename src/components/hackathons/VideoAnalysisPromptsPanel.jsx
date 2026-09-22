import { useEffect, useState } from 'react'
import { hackathonsApi } from '../../api/hackathons'
import { PROMPT_META } from '../evaluation/promptMeta'
import { formatDateTime } from '../../utils/format'
import { MONO, PANEL } from '../drop/theme'
import Alert from '../ui/Alert'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { Textarea } from '../ui/Input'
import { LoadingBlock } from '../ui/Spinner'

/**
 * Video Analysis prompts for one hackathon — admin only.
 *
 * Both templates start as the global Application → Video Analysis ones and
 * only become this hackathon's own once an admin saves here. That is why every
 * write goes to /hackathons/{id}/video-analysis-prompts and never to
 * /ai-evaluation-prompts: the latter would re-word the analysis for every other
 * hackathon too. Resetting drops the override so evaluation follows the global
 * template again.
 *
 * Failures are handled with `.catch()` rather than try/catch/finally because
 * the React Compiler bails out of a component that uses either, and then
 * nothing here is memoised.
 */

/** Prompts as the API returns them, whatever the endpoint that answered. */
function readPrompts(payload) {
  return Array.isArray(payload?.prompts) ? payload.prompts : []
}

/** Tokens the backend requires; saving without them comes back as a 400. */
function missingPlaceholders(prompt, template) {
  return (prompt?.placeholders || []).filter((token) => !template.includes(token))
}

export default function VideoAnalysisPromptsPanel({ hackathonId }) {
  const [prompts, setPrompts] = useState([])
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    hackathonsApi
      .videoAnalysisPrompts(hackathonId, { signal: controller.signal })
      .then((payload) => {
        if (!active) return
        const items = readPrompts(payload)
        setPrompts(items)
        setDrafts(Object.fromEntries(items.map((item) => [item.key, item.template || ''])))
        setLoading(false)
      })
      .catch((error) => {
        if (!active || error?.name === 'AbortError') return
        setLoadError(error?.message || 'Unable to load the Video Analysis prompts.')
        setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [hackathonId])

  const save = async (prompt) => {
    const meta = PROMPT_META[prompt.key]
    const template = String(drafts[prompt.key] || '').trim()

    if (!template) {
      setActionError(`The ${meta.title} template cannot be empty.`)
      return
    }
    // Checked here as well as on the server so a missing token reads as a
    // field-level mistake instead of a bare 400.
    const missing = missingPlaceholders(prompt, template)
    if (missing.length) {
      setActionError(`Keep ${missing.join(' and ')} in the ${meta.title} template.`)
      return
    }

    setBusy(`save:${prompt.key}`)
    setActionError('')
    setActionMessage('')

    const payload = await hackathonsApi
      .saveVideoAnalysisPrompts(hackathonId, [{ key: prompt.key, template }])
      .catch((error) => {
        setActionError(error?.message || `Unable to save the ${meta.title} template.`)
        return null
      })

    setBusy('')
    if (!payload) return

    const items = readPrompts(payload)
    setPrompts(items)
    // Re-seed only the box that was saved — an edit in progress on the other
    // prompt has to survive.
    const saved = items.find((item) => item.key === prompt.key)
    setDrafts((current) => ({
      ...current,
      [prompt.key]: saved ? saved.template || '' : current[prompt.key],
    }))
    setActionMessage(`${meta.title} saved for this hackathon only.`)
  }

  const resetToGlobal = async (prompt) => {
    const meta = PROMPT_META[prompt.key]
    setBusy(`reset:${prompt.key}`)
    setActionError('')
    setActionMessage('')

    const payload = await hackathonsApi
      .resetVideoAnalysisPrompt(hackathonId, prompt.key)
      .catch((error) => {
        setActionError(error?.message || `Unable to reset the ${meta.title} template.`)
        return null
      })

    setBusy('')
    if (!payload) return

    const items = readPrompts(payload)
    setPrompts(items)
    const reset = items.find((item) => item.key === prompt.key)
    setDrafts((current) => ({
      ...current,
      [prompt.key]: reset?.global_template || reset?.template || '',
    }))
    setActionMessage(`${meta.title} follows Application → Video Analysis again.`)
  }

  if (loading) return <LoadingBlock label="Loading Video Analysis prompts…" />

  if (loadError) {
    return (
      <Alert variant="danger" title="Unable to load the Video Analysis prompts">
        {loadError}
      </Alert>
    )
  }

  return (
    <div className="stack-md">
      <p className="text-[13.5px] text-muted">
        These templates analyse every submission in this hackathon. Until you save one here it
        follows Application → Video Analysis, and saving changes this hackathon only.
      </p>

      {actionError && <Alert variant="danger">{actionError}</Alert>}
      {actionMessage && <Alert variant="success">{actionMessage}</Alert>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {prompts.map((prompt) => {
          const meta = PROMPT_META[prompt.key] || {
            title: prompt.name,
            description: prompt.description,
          }
          const draft = drafts[prompt.key] ?? ''
          const dirty = draft !== (prompt.template || '')
          const saving = busy === `save:${prompt.key}`
          const resetting = busy === `reset:${prompt.key}`
          const tokens = prompt.placeholders || []

          return (
            <section key={prompt.key} className={`${PANEL} flex flex-col overflow-hidden`}>
              <div className="border-b border-hairline px-4 py-4 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
                      {meta.title}
                    </h3>
                    <p className="mt-1 text-[13.5px] text-muted">{meta.description}</p>
                  </div>
                  <span className="grid size-10 shrink-0 place-items-center rounded-drop border border-volt-edge bg-volt-tint text-volt-ink">
                    <Icon name="sparkles" size={18} />
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {tokens.map((token) => (
                    <code
                      key={token}
                      className={`${MONO} rounded-full border border-hairline bg-raised px-2.5 py-1 text-[11px] text-muted`}
                    >
                      {token}
                    </code>
                  ))}
                  {prompt.is_overridden && (
                    <Badge variant="accent" dot>
                      Custom for this hackathon
                    </Badge>
                  )}
                </div>

                <p className="mt-2.5 text-[12.5px] text-muted">
                  {prompt.is_overridden
                    ? `Saved for this hackathon${
                        prompt.updated_at ? ` · ${formatDateTime(prompt.updated_at)}` : ''
                      }`
                    : 'Using the Application → Video Analysis template.'}
                </p>
              </div>

              <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
                <Textarea
                  label="Template"
                  rows={14}
                  value={draft}
                  disabled={saving || resetting}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [prompt.key]: event.target.value }))
                  }
                  hint={tokens.length ? `Keep ${tokens.join(' and ')} in the text.` : undefined}
                />
                <div className="mt-auto flex flex-wrap items-center justify-end gap-2">
                  {prompt.is_overridden && (
                    <Button
                      variant="ghost"
                      loading={resetting}
                      disabled={Boolean(busy)}
                      onClick={() => resetToGlobal(prompt)}
                      leftIcon={<Icon name="refresh" size={16} />}
                    >
                      Reset to Video Analysis default
                    </Button>
                  )}
                  <Button
                    variant="accent"
                    loading={saving}
                    disabled={Boolean(busy) || !dirty}
                    onClick={() => save(prompt)}
                    leftIcon={<Icon name="check" size={17} />}
                  >
                    Save for this hackathon
                  </Button>
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
