import { useEffect, useState } from 'react'
import { aiPromptsApi } from '../../api/aiPrompts'
import { WRAP_APP, EYEBROW, PANEL, MONO } from '../../components/drop/theme'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import { Textarea } from '../../components/ui/Input'
import { LoadingBlock } from '../../components/ui/Spinner'

const PROMPT_META = {
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

export default function AiPromptsPage() {
  const [templates, setTemplates] = useState({
    checklist: '',
    analyze_video: '',
  })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [savingKey, setSavingKey] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setLoadError('')
      try {
        const list = await aiPromptsApi.list()
        const next = { checklist: '', analyze_video: '' }
        for (const item of list) {
          const key = item.key || item.id
          if (key && Object.prototype.hasOwnProperty.call(next, key)) {
            next[key] = item.template || item.prompt || ''
          }
        }
        // Fallback: fetch individually if list was empty/incomplete
        await Promise.all(
          aiPromptsApi.KEYS.map(async (key) => {
            if (next[key]) return
            try {
              const prompt = await aiPromptsApi.get(key)
              next[key] = prompt?.template || prompt?.prompt || ''
            } catch {
              // keep empty; admin can still paste a template
            }
          }),
        )
        if (active) setTemplates(next)
      } catch (error) {
        if (active) setLoadError(error.message || 'Unable to load AI prompts.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const save = async (key) => {
    setSavingKey(key)
    setSaveError('')
    setSaveMessage('')
    try {
      const saved = await aiPromptsApi.update(key, templates[key])
      setTemplates((current) => ({
        ...current,
        [key]: saved?.template || saved?.prompt || current[key],
      }))
      setSaveMessage(`${PROMPT_META[key].title} saved.`)
    } catch (error) {
      setSaveError(error.message || `Unable to save ${key}.`)
    } finally {
      setSavingKey('')
    }
  }

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <header className="mb-7 max-w-3xl sm:mb-9">
        <span className={EYEBROW}>Evaluation setup</span>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink md:text-[36px]">
          AI prompts
        </h1>
        <p className="mt-2 text-[15px] text-muted md:text-base">
          Edit the Gemini templates used for checklist validation and video analysis.
          Required placeholders are enforced by the API.
        </p>
      </header>

      {loadError && (
        <div className="mb-6">
          <Alert variant="danger" title="Unable to load prompts">
            {loadError}
          </Alert>
        </div>
      )}
      {saveError && (
        <div className="mb-6">
          <Alert variant="danger">{saveError}</Alert>
        </div>
      )}
      {saveMessage && (
        <div className="mb-6">
          <Alert variant="success">{saveMessage}</Alert>
        </div>
      )}

      {loading ? (
        <LoadingBlock label="Loading AI prompts…" />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {aiPromptsApi.KEYS.map((key) => {
            const meta = PROMPT_META[key]
            return (
              <section key={key} className={`${PANEL} flex flex-col overflow-hidden`}>
                <div className="border-b border-hairline px-4 py-4 sm:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
                        {meta.title}
                      </h2>
                      <p className="mt-1 text-[13.5px] text-muted">{meta.description}</p>
                    </div>
                    <span className="grid size-10 shrink-0 place-items-center rounded-drop border border-volt-edge bg-volt-tint text-volt">
                      <Icon name="sparkles" size={18} />
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {meta.placeholders.map((token) => (
                      <code
                        key={token}
                        className={`${MONO} rounded-full border border-hairline bg-raised px-2.5 py-1 text-[11px] text-muted`}
                      >
                        {token}
                      </code>
                    ))}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
                  <Textarea
                    label="Template"
                    rows={14}
                    value={templates[key]}
                    onChange={(event) =>
                      setTemplates((current) => ({ ...current, [key]: event.target.value }))
                    }
                    placeholder={`Include ${meta.placeholders.join(' and ')}`}
                  />
                  <div className="mt-auto flex justify-end">
                    <Button
                      variant="accent"
                      loading={savingKey === key}
                      disabled={!!savingKey}
                      onClick={() => save(key)}
                      leftIcon={<Icon name="check" size={17} />}
                    >
                      Save {meta.title.toLowerCase()}
                    </Button>
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
