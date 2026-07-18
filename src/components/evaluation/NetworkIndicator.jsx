import { useNetworkSpeed } from '../../hooks/useNetworkSpeed'
import Icon from '../ui/Icon'

const LABELS = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  offline: 'Offline',
  unknown: 'Checking…',
}

/**
 * Live network quality pill. Pass `active` to control whether the latency probe
 * runs (e.g. only while recording).
 */
export default function NetworkIndicator({ active = true }) {
  const { quality, latency, downlink, effectiveType, online } = useNetworkSpeed({ enabled: active })

  const meta = []
  if (online) {
    if (latency != null) meta.push(`${latency} ms`)
    if (downlink != null) meta.push(`${downlink} Mbps`)
    else if (effectiveType) meta.push(effectiveType.toUpperCase())
  }

  return (
    <span className={`net-indicator net--${quality}`} title="Live network status">
      <span className="net-indicator__dot" />
      <Icon name={online ? 'wifi' : 'wifiOff'} size={16} />
      <span>{LABELS[quality] || 'Network'}</span>
      {meta.length > 0 && <span className="net-indicator__meta">· {meta.join(' · ')}</span>}
    </span>
  )
}
