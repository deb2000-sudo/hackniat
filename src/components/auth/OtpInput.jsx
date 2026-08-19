import { useRef } from 'react'

/**
 * Six-box one-time-code field.
 *
 * Renders `length` single-character boxes that behave as one control: typing
 * advances, backspace on an empty box steps back and clears the previous one,
 * arrows move between boxes, and pasting a code fills across from the box you
 * paste into. The parent still owns the value as a plain joined string, so
 * this drops into the existing `code` / `onCodeChange` state unchanged.
 */
export default function OtpInput({
  value = '',
  onChange,
  length = 6,
  disabled = false,
  invalid = false,
  label = 'Verification code',
  autoFocus = false,
}) {
  const refs = useRef([])
  const digits = Array.from({ length }, (_, i) => value[i] || '')

  const emit = (next) => onChange(next.replace(/\D/g, '').slice(0, length))
  const focusAt = (i) => refs.current[Math.max(0, Math.min(i, length - 1))]?.focus()

  const writeAt = (i, char) => {
    const next = digits.slice()
    next[i] = char
    emit(next.join(''))
  }

  const handleChange = (i) => (event) => {
    const raw = event.target.value.replace(/\D/g, '')
    if (!raw) {
      writeAt(i, '')
      return
    }
    if (raw.length === 1) {
      writeAt(i, raw)
      focusAt(i + 1)
      return
    }
    // Autofill or a fast typist: spread the digits from this box onward.
    const merged = (digits.slice(0, i).join('') + raw).slice(0, length)
    emit(merged)
    focusAt(merged.length)
  }

  const handleKeyDown = (i) => (event) => {
    if (event.key === 'Backspace' && !digits[i]) {
      event.preventDefault()
      writeAt(i - 1, '')
      focusAt(i - 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusAt(i - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      focusAt(i + 1)
    }
  }

  const handlePaste = (event) => {
    const text = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!text) return
    event.preventDefault()
    emit(text)
    focusAt(text.length)
  }

  return (
    <div className="flex gap-2" role="group" aria-label={label} onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          // Only the first box advertises one-time-code, so the browser fills
          // the whole value here and `handleChange` spreads it across.
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={`${label}, digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          onChange={handleChange(i)}
          onKeyDown={handleKeyDown(i)}
          onFocus={(event) => event.target.select()}
          className={`size-12 shrink-0 rounded-drop border bg-surface text-center font-mono text-[19px] font-semibold text-ink tabular-nums transition-[border-color,box-shadow] focus:outline-none focus:ring-2 focus:ring-volt disabled:opacity-60 sm:size-13 ${
            invalid ? 'border-missing' : digit ? 'border-volt-edge' : 'border-hairline'
          }`}
        />
      ))}
    </div>
  )
}
