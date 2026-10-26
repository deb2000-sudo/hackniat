import { useEffect, useState } from 'react'
import { adminApi } from '../../api/admin'
import { MONO } from '../drop/theme'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Card, { CardBody, CardHeader } from '../ui/Card'
import Icon from '../ui/Icon'
import Input from '../ui/Input'
import { LoadingBlock } from '../ui/Spinner'

const MIN_BATCH = 1
const MAX_BATCH = 500
const DEFAULT_BATCH = 20
const BATCH_SHORTCUTS = [20, 30]

/** The typed batch size when it is a whole number from 1 to 500, else null. */
function parseBatch(value) {
  const n = Number(value)
  return Number.isInteger(n) && n >= MIN_BATCH && n <= MAX_BATCH ? n : null
}

const switchesOf = (payload) => ({
  email: payload?.email_verification_enabled !== false,
  mobile: payload?.mobile_verification_enabled !== false,
})

/**
 * Super Admin: whether registration asks for an email and a mobile OTP. One
 * pair of switches covers student and evaluator registration. A switch that is
 * off still collects the field; it just skips the code.
 *
 * Turning a switch back on does not prompt anyone by itself. People who
 * registered while it was off wait until Send verification marks a batch of
 * them (oldest first) to see the verification popup on their next sign-in.
 *
 * Written without try/finally so the React Compiler can optimise it.
 */
export default function ApplicationConfigPanel() {
  const [state, setState] = useState(null)
  const [switches, setSwitches] = useState({ email: true, mobile: true })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')

  const [batch, setBatch] = useState(String(DEFAULT_BATCH))
  const [releasing, setReleasing] = useState(false)
  const [releaseError, setReleaseError] = useState('')
  const [releaseMessage, setReleaseMessage] = useState('')

  const apply = (payload) => {
    setState(payload)
    setSwitches(switchesOf(payload))
  }

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    adminApi
      .getRegistrationSettings({ signal: controller.signal })
      .then((payload) => {
        if (!active) return
        apply(payload)
        setLoading(false)
      })
      .catch((error) => {
        if (!active || error?.name === 'AbortError') return
        setLoadError(error?.message || 'Unable to load the application config.')
        setLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [])

  const saved = switchesOf(state)
  const dirty = switches.email !== saved.email || switches.mobile !== saved.mobile

  const toggle = (key) => (event) => {
    const { checked } = event.target
    setSwitches((current) => ({ ...current, [key]: checked }))
    setSaveError('')
    setSaveMessage('')
  }

  const save = async () => {
    setSaving(true)
    setSaveError('')
    setSaveMessage('')
    // The API client sends the X-CSRF-Token header on writes, as for the
    // Profile Password.
    const payload = await adminApi
      .updateRegistrationSettings({
        email_verification_enabled: switches.email,
        mobile_verification_enabled: switches.mobile,
      })
      .catch((error) => {
        setSaveError(error?.message || 'Unable to save the application config.')
        return null
      })
    setSaving(false)
    if (!payload) return
    apply(payload)
    setSaveMessage('Application config saved.')
  }

  const batchSize = parseBatch(batch)
  const anyOn = saved.email || saved.mobile

  const release = async () => {
    setReleasing(true)
    setReleaseError('')
    setReleaseMessage('')
    const payload = await adminApi.releaseVerification(batchSize).catch((error) => {
      setReleaseError(error?.message || 'Unable to send verification.')
      return null
    })
    setReleasing(false)
    if (!payload) return
    apply(payload)
    const releasedNow = Number(payload.released_now) || 0
    setReleaseMessage(
      releasedNow
        ? `${releasedNow === 1 ? '1 person' : `${releasedNow} people`} will see the verification popup on their next sign-in.`
        : 'Nobody was waiting, so no one was added.',
    )
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div>
          <h3>Application config</h3>
          <p className="text-sm text-muted">
            Registration verification for students and evaluators.
          </p>
        </div>
        <Icon name="settings" size={20} className="text-muted" />
      </CardHeader>
      <CardBody>
        {loading ? (
          <LoadingBlock label="Loading application config…" />
        ) : loadError ? (
          <Alert variant="danger" title="Unable to load the application config">
            {loadError}
          </Alert>
        ) : (
          <div className="stack-lg">
            <div className="stack-md">
              {saveError && <Alert variant="danger">{saveError}</Alert>}
              {saveMessage && <Alert variant="success">{saveMessage}</Alert>}

              <label className="hackathon-video-toggle">
                <input
                  type="checkbox"
                  checked={switches.email}
                  disabled={saving}
                  onChange={toggle('email')}
                />
                <span>
                  <strong>Email verification</strong>
                  <small>Registration asks for an email code. Off: the email is collected, not verified.</small>
                </span>
              </label>
              <label className="hackathon-video-toggle">
                <input
                  type="checkbox"
                  checked={switches.mobile}
                  disabled={saving}
                  onChange={toggle('mobile')}
                />
                <span>
                  <strong>Mobile number verification</strong>
                  <small>Registration asks for an SMS code. Off: the number is collected, not verified.</small>
                </span>
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12.5px] text-muted">
                  Turning a switch back on does not prompt anyone. Use Send verification below.
                </p>
                <Button variant="accent" loading={saving} disabled={!dirty || saving} onClick={save}>
                  Save
                </Button>
              </div>
            </div>

            <div className="stack-md border-t border-hairline pt-5">
              <div>
                <h4 className="text-[15px] font-semibold text-ink">Send verification</h4>
                <p className="mt-1 text-[13px] text-muted">
                  Marks the oldest waiting students and evaluators to verify on their next sign-in.
                  No email is sent from here; people already marked are skipped.
                </p>
              </div>

              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-drop border border-hairline p-3">
                  <dt className="text-[12.5px] text-muted">Waiting</dt>
                  <dd className={`${MONO} mt-1 text-[20px] font-semibold text-ink`}>
                    {Number(state?.pending_count) || 0}
                  </dd>
                </div>
                <div className="rounded-drop border border-hairline p-3">
                  <dt className="text-[12.5px] text-muted">Will see the popup on next sign-in</dt>
                  <dd className={`${MONO} mt-1 text-[20px] font-semibold text-ink`}>
                    {Number(state?.released_count) || 0}
                  </dd>
                </div>
              </dl>

              {releaseError && <Alert variant="danger">{releaseError}</Alert>}
              {releaseMessage && <Alert variant="success">{releaseMessage}</Alert>}

              <div className="flex flex-wrap items-end gap-3">
                <div className="w-[150px]">
                  <Input
                    label="How many people"
                    type="number"
                    inputMode="numeric"
                    min={MIN_BATCH}
                    max={MAX_BATCH}
                    step={1}
                    value={batch}
                    onChange={(event) => {
                      setBatch(event.target.value)
                      setReleaseMessage('')
                    }}
                    error={
                      batch !== '' && !batchSize
                        ? `A whole number from ${MIN_BATCH} to ${MAX_BATCH}`
                        : undefined
                    }
                  />
                </div>
                <div className="flex gap-2 pb-[2px]">
                  {BATCH_SHORTCUTS.map((value) => (
                    <Button
                      key={value}
                      variant={batchSize === value ? 'secondary' : 'ghost'}
                      size="sm"
                      aria-pressed={batchSize === value}
                      onClick={() => {
                        setBatch(String(value))
                        setReleaseMessage('')
                      }}
                    >
                      {value}
                    </Button>
                  ))}
                </div>
                <div className="ml-auto pb-[2px]">
                  <Button
                    variant="secondary"
                    loading={releasing}
                    disabled={releasing || !batchSize || !anyOn}
                    onClick={release}
                  >
                    Send verification
                  </Button>
                </div>
              </div>
              {!anyOn && (
                <p className="text-[12.5px] text-muted">
                  Turn email or mobile verification on (and save) before sending it.
                </p>
              )}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
