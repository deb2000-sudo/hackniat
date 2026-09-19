import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { MONO } from '../drop/theme'

/** Seconds left until `expiresAt`, floored at 0. */
function secondsLeft(expiresAt, fallback) {
  if (!expiresAt) return Math.max(0, Number(fallback) || 0)
  const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
  return Number.isFinite(diff) ? Math.max(0, diff) : Math.max(0, Number(fallback) || 0)
}

function formatClock(total) {
  const m = String(Math.floor(total / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

/**
 * Leader's join code: the six digits, a live countdown to expiry, copy, and
 * regenerate.
 *
 * The countdown is driven off `expires_at` rather than decrementing
 * `expires_in_seconds`, so a backgrounded tab (where timers are throttled)
 * still shows the true remaining time when it comes back.
 */
export default function JoinCodePanel({ joinCode, onRefresh, refreshing = false, disabled = false }) {
  const [copied, setCopied] = useState(false)
  // The countdown is derived at render time from expires_at; this tick only
  // exists to re-render once a second. Storing the remaining seconds in state
  // instead would need a resync every time a new code arrives.
  const [, setTick] = useState(0)
  const remaining = secondsLeft(joinCode?.expires_at, joinCode?.expires_in_seconds)

  useEffect(() => {
    if (!joinCode?.code) return undefined
    const id = setInterval(() => setTick((value) => value + 1), 1000)
    return () => clearInterval(id)
  }, [joinCode?.code])

  useEffect(() => {
    if (!copied) return undefined
    const id = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(id)
  }, [copied])

  const expired = remaining <= 0
  const code = joinCode?.code || ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      // Clipboard blocked (insecure origin / permission) — the code is on
      // screen in full, so this is not worth surfacing as an error.
    }
  }

  return (
    <div className="stack-sm rounded-drop border border-hairline bg-raised p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
          Team join code
        </span>
        {code && !expired && (
          <span className={`${MONO} text-[13px] text-muted`}>Expires in {formatClock(remaining)}</span>
        )}
      </div>

      {code ? (
        <div className="flex flex-wrap items-center gap-3">
          <strong
            className={`${MONO} text-[34px] leading-none tracking-[0.18em] ${
              expired ? 'text-muted line-through' : 'text-ink'
            }`}
          >
            {code}
          </strong>
          {!expired && (
            <Button type="button" variant="secondary" size="sm" onClick={copy}>
              <Icon name={copied ? 'check' : 'clipboard'} size={15} />
              {copied ? 'Copied' : 'Copy'}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">No active code. Generate one to invite your teammates.</p>
      )}

      {expired && code && (
        <p className="text-sm text-warn">This code has expired. Generate a new one to keep inviting.</p>
      )}

      {!disabled && (
        <div>
          <Button
            type="button"
            variant={expired || !code ? 'accent' : 'secondary'}
            size="sm"
            loading={refreshing}
            onClick={onRefresh}
          >
            <Icon name="refresh" size={15} />
            Generate new code
          </Button>
          <p className="mt-2 text-[12.5px] text-muted">
            Generating a new code immediately invalidates the previous one.
          </p>
        </div>
      )}
    </div>
  )
}
