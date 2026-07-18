import Icon from './Icon'

export default function StatCard({ icon, value, label }) {
  return (
    <div className="stat">
      {icon && (
        <div className="stat__icon">
          <Icon name={icon} size={22} />
        </div>
      )}
      <div>
        <div className="stat__value">{value}</div>
        <div className="stat__label">{label}</div>
      </div>
    </div>
  )
}
