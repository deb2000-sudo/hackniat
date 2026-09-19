import { Link, useParams } from 'react-router-dom'
import { hackathonsApi } from '../../api/hackathons'
import { useAsync } from '../../hooks/useAsync'
import { formatDate } from '../../utils/format'
import { PANEL, WRAP_APP } from '../../components/drop/theme'
import PageHeader from '../../components/layout/PageHeader'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import { LoadingBlock } from '../../components/ui/Spinner'

/**
 * Per-hackathon settings.
 *
 * Scaffold only: the controls that belong here (publishing the hackathon, and
 * the other hackathon-level switches) are still to be built. It loads the
 * hackathon so the page is addressable and titled correctly, and so a bad id
 * reports itself here rather than under a half-rendered form.
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

      <section className={`${PANEL} p-8`}>
        <EmptyState
          icon="settings"
          title="No settings here yet"
          description="Hackathon-level configuration — publishing the hackathon and the rest — will live on this page."
        />
      </section>
    </div>
  )
}
