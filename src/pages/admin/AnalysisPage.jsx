import { useSearchParams } from 'react-router-dom'
import { analysisApi } from '../../api/analysis'
import { useAsync } from '../../hooks/useAsync'
import { queryKeys } from '../../lib/queryKeys'
import EvaluatorSpeed from '../../components/analysis/EvaluatorSpeed'
import HackathonComparison from '../../components/analysis/HackathonComparison'
import { WRAP_APP } from '../../components/drop/theme'
import PageHeader from '../../components/layout/PageHeader'
import Alert from '../../components/ui/Alert'
import { LoadingBlock } from '../../components/ui/Spinner'

const TABS = [
  { id: 'hackathons', label: 'Hackathon comparison' },
  { id: 'evaluators', label: 'Evaluator speed' },
]

/**
 * Analysis: read-only numbers for hackathons and evaluators.
 *
 * Separate from Video Analysis (the AI prompts) and from assignment — nothing
 * here changes a submission. The filter choices load once; each tab sends its
 * own request and refetches whenever one of its filters changes. The tab
 * lives in the URL (`?tab=`) so a refresh lands on the same view.
 */
export default function AnalysisPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.some((entry) => entry.id === searchParams.get('tab'))
    ? searchParams.get('tab')
    : TABS[0].id

  const { data, loading, error } = useAsync((options) => analysisApi.options(options), {
    key: queryKeys.analysisOptions,
    staleTime: 60_000,
  })

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <PageHeader
        eyebrow="Administration"
        title="Analysis"
        description="Compare hackathons and see how quickly evaluators review. Nothing here is saved."
      />

      <div className="mb-6 flex gap-1 border-b border-hairline" role="tablist" aria-label="Analysis views">
        {TABS.map((entry) => {
          const active = entry.id === tab
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`-mb-px border-b-2 px-3 py-2.5 text-[14px] font-medium transition-colors ${
                active ? 'border-volt text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
              onClick={() => setSearchParams(entry.id === TABS[0].id ? {} : { tab: entry.id }, { replace: true })}
            >
              {entry.label}
            </button>
          )
        })}
      </div>

      {error && !data ? (
        <Alert variant="danger" title="Unable to load Analysis">
          {error.message}
        </Alert>
      ) : loading && !data ? (
        <LoadingBlock label="Loading filters…" />
      ) : tab === 'evaluators' ? (
        <EvaluatorSpeed options={data} />
      ) : (
        <HackathonComparison options={data} />
      )}
    </div>
  )
}
