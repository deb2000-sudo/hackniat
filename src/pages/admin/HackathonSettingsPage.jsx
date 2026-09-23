import { Link, useParams } from 'react-router-dom'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import { formatDate } from '../../utils/format'
import { WRAP_APP } from '../../components/drop/theme'
import PageHeader from '../../components/layout/PageHeader'
import ReportPublishingPanel from '../../components/hackathons/ReportPublishingPanel'
import SubmissionLimitPanel from '../../components/hackathons/SubmissionLimitPanel'
import VideoAnalysisPromptsPanel from '../../components/hackathons/VideoAnalysisPromptsPanel'
import Accordion from '../../components/ui/Accordion'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import { LoadingBlock } from '../../components/ui/Spinner'

/**
 * Per-hackathon settings. Admin only — the route sits behind the admin guard,
 * and so do the endpoints behind each section.
 *
 * Sections open on demand so the page itself stays one request: the prompts
 * below are only fetched once an admin actually opens them. The remaining
 * hackathon-level switches (publishing and the rest) still belong here.
 */
export default function HackathonSettingsPage() {
  const { hackathonId } = useParams()
  const { data: hackathon, loading, error } = useAsync(() => hackathonsApi.get(hackathonId))

  if (loading) {
    return (
      <div className={`${WRAP_APP} py-7 md:py-10`}>
        <LoadingBlock label="Loading hackathon settings…" />
      </div>
    )
  }

  if (error || !hackathon) {
    return (
      <div className={`${WRAP_APP} py-7 md:py-10`}>
        <Alert variant="danger" title="Unable to load hackathon">
          {error?.message || 'Hackathon not found.'}
        </Alert>
        <div className="mt-5">
          <Button as={Link} to="/hackathons" variant="secondary" leftIcon={<Icon name="arrowLeft" size={17} />}>
            All hackathons
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <PageHeader
        eyebrow="Hackathon settings"
        title={hackathon.name}
        description={`${formatDate(hackathon.start_date)} – ${formatDate(hackathon.end_date)}`}
        actions={
          <>
            <Button
              as={Link}
              to={`/admin/hackathons/${hackathonId}/edit`}
              variant="secondary"
              leftIcon={<Icon name="edit" size={17} />}
            >
              Edit hackathon
            </Button>
            <Button
              as={Link}
              to={`/hackathons/${hackathonId}`}
              variant="ghost"
              leftIcon={<Icon name="arrowLeft" size={17} />}
            >
              Back to hackathon
            </Button>
          </>
        }
      />

      <section className="flex flex-col gap-4">
        {/* Loads with the page rather than on expand: the counts are the
            reason an admin opens Settings after a review round. */}
        <SubmissionLimitPanel key={`limit-${hackathonId}`} hackathonId={hackathonId} />

        <ReportPublishingPanel key={hackathonId} hackathonId={hackathonId} />

        <Accordion
          icon="sparkles"
          title="Video Analysis Prompt"
          description="The templates used to analyse this hackathon's submissions."
          lazy
        >
          {/* Keyed by hackathon so opening a different one starts from its own
              prompts rather than the previous hackathon's drafts. */}
          <VideoAnalysisPromptsPanel key={hackathonId} hackathonId={hackathonId} />
        </Accordion>
      </section>
    </div>
  )
}
