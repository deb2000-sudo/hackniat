import { MOBILE_COUNTRY_CODES } from '../../utils/constants'

/**
 * Dialling code + national number, locked once the number is verified. Paired
 * with an OtpRow, which supplies the Verify button beside it.
 */
export default function MobileField({ countryCode, mobileNational, onChange, error, locked }) {
  return (
    <div className="field">
      <label className="label">
        Mobile number
        <span className="req">*</span>
      </label>
      <div className="flex gap-2">
        <select
          className="input w-[7.5rem] shrink-0"
          value={countryCode}
          disabled={locked}
          onChange={onChange('country_code')}
          aria-label="Country code"
        >
          {MOBILE_COUNTRY_CODES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <input
          className={`input ${error ? 'input--error' : ''}`}
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="9876543210"
          value={mobileNational}
          disabled={locked}
          readOnly={locked}
          onChange={onChange('mobile_national')}
        />
      </div>
      {error && <span className="field__error">{error}</span>}
    </div>
  )
}
