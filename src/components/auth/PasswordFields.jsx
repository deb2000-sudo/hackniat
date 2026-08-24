import { PasswordInput } from '../ui/Input'
import Icon from '../ui/Icon'
import { passwordStrength } from '../../utils/validators'

function MatchedHint() {
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
      <Icon name="checkCircle" size={14} />
      Password matched
    </span>
  )
}

/**
 * Password + confirm pair with the live "what's still missing" hint. Shared so
 * both registration forms enforce and describe the same rule: 8+ characters
 * with at least one letter and one number.
 */
export default function PasswordFields({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  errors = {},
}) {
  const strength = passwordStrength(password)
  const matched =
    Boolean(password) && Boolean(confirmPassword) && password === confirmPassword

  return (
    <>
      <PasswordInput
        label="Password"
        required
        autoComplete="new-password"
        value={password}
        onChange={onPasswordChange}
        error={errors.password}
        hint={
          password
            ? `Must include 8+ characters${strength.hasLetter ? '' : ', a letter'}${
                strength.hasNumber ? '' : ', a number'
              }`
            : 'At least 8 characters, with a letter and a number'
        }
      />
      <PasswordInput
        label="Confirm password"
        required
        autoComplete="new-password"
        value={confirmPassword}
        onChange={onConfirmPasswordChange}
        error={errors.confirm_password}
        hint={matched ? <MatchedHint /> : undefined}
      />
    </>
  )
}
