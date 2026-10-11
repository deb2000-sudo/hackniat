import { WRAP_APP } from '../../components/drop/theme'
import Card, { CardBody } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'

/**
 * Where a custom-role user lands when their role has no screens at all, so
 * redirecting to "the first allowed screen" has somewhere to end.
 */
export default function NoAccessPage() {
  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <Card>
        <CardBody>
          <EmptyState
            icon="shield"
            title="No admin screens assigned"
            description="Your role does not include any admin screens yet. Ask a Super Admin to update it."
          />
        </CardBody>
      </Card>
    </div>
  )
}
