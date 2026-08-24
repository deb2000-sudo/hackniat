import Button from '../ui/Button'
import Icon from '../ui/Icon'
import OtpInput from './OtpInput'
import { VERIFY } from '../../hooks/useRegistrationVerification'

/**
 * One verifiable identifier: the field itself, a Verify button that turns into
 * a "Verified" badge, and the six-box code entry that appears while a code is
 * in flight. Shared by student and evaluator registration so both channels
 * behave identically on either page.
 */
export default function OtpRow({
  label,
  code,
  onCodeChange,
  onVerify,
  onConfirm,
  onResend,
  state,
  error,
  cooldown,
  canStart,
  extra,
  sentTo,
}) {
  const showOtp =
    state === VERIFY.AWAITING ||
    state === VERIFY.VERIFYING ||
    state === VERIFY.ERROR ||
    state === VERIFY.SENDING
  return (
    <div className="stack-sm">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">{extra}</div>
        {state === VERIFY.VERIFIED ? (
          <span className="mb-2 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-600/10 px-3 py-1.5 text-sm font-semibold text-emerald-600">
            <Icon name="checkCircle" size={17} />
            Verified
          </span>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="mb-2 shrink-0"
            loading={state === VERIFY.SENDING}
            disabled={state === VERIFY.SENDING || state === VERIFY.VERIFYING || !canStart}
            onClick={onVerify}
          >
            Verify
          </Button>
        )}
      </div>
      {showOtp && state !== VERIFY.VERIFIED && (
        <div className="stack-sm rounded-drop border border-hairline bg-surface p-3">
          <span className="label">{label} code</span>
          {(state === VERIFY.AWAITING || state === VERIFY.VERIFYING) && sentTo && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600">
              <Icon name="checkCircle" size={15} />
              Code sent to {sentTo}
            </p>
          )}
          <OtpInput
            label={`${label} code`}
            value={code}
            onChange={onCodeChange}
            disabled={state === VERIFY.VERIFYING}
            invalid={Boolean(error)}
          />
          {error && <p className="text-sm text-missing">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="accent"
              loading={state === VERIFY.VERIFYING}
              disabled={String(code || '').length !== 6 || state === VERIFY.VERIFYING}
              onClick={onConfirm}
            >
              Confirm code
            </Button>
            {cooldown > 0 ? (
              <span className="text-sm text-muted">Resend in {cooldown}s</span>
            ) : (
              <button type="button" className="text-sm underline" onClick={onResend}>
                Resend code
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
