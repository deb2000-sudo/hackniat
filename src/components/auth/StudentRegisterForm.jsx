import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Input, { Select } from '../ui/Input'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import { LoadingBlock } from '../ui/Spinner'
import Icon from '../ui/Icon'
import { MONO } from '../drop/theme'
import MobileField from './MobileField'
import OtpRow from './OtpRow'
import PasswordFields from './PasswordFields'
import { authApi } from '../../api/auth'
import { AUTH_ERROR, authErrorCode, authErrorField, authErrorMessage } from '../../api/authErrors'
import { setCsrfToken } from '../../api/client'
import { batchesApi, universitiesApi } from '../../api/universities'
import { useAsync } from '../../hooks/useAsync'
import { useRegistrationConfig } from '../../hooks/useRegistrationConfig'
import { useAuth } from '../../hooks/useAuth'
import { VERIFY, useRegistrationVerification } from '../../hooks/useRegistrationVerification'
import { queryKeys } from '../../lib/queryKeys'
import { RECAPTCHA_CONTAINER_ID } from '../../lib/firebasePhone'
import { ROLE_HOME } from '../../utils/constants'
import { COLLEGE_ID_MAX_LENGTH, isNiatId, validateStudentForm } from '../../utils/validators'
import { COLLEGE_TYPES } from '../../utils/constants'
import { trackEvent } from '../../lib/logrocket'

/** An ID is exactly this long, so the field stops accepting more. */
const NIAT_ID_LENGTH = 11

/** Shown as the placeholder and the worked example under the field. */
const NIAT_ID_SAMPLE = 'N25H05F9974'

const NO_BATCHES_MESSAGE = 'No batches are available for this university.'

const INITIAL = {
  first_name: '',
  last_name: '',
  email: '',
  // The campus is chosen by id: the backend owns the label, so a typed name
  // would only be a second spelling of something it already knows.
  university_id: '',
  // Always one of the chosen university's batches; cleared whenever the
  // university changes.
  batch_id: '',
  // Exactly one of these is sent, by the selected university's college type.
  niat_id: '',
  college_id: '',
  country_code: '+91',
  mobile_national: '',
  password: '',
  confirm_password: '',
}

/** What the disabled Create button asks for, given which channels are on. */
function verifyPrompt(emailRequired, phoneRequired) {
  if (emailRequired && phoneRequired) return 'Verify both email and mobile number to create your account.'
  if (emailRequired) return 'Verify your email to create your account.'
  if (phoneRequired) return 'Verify your mobile number to create your account.'
  return 'Fill every required field and match the password rules.'
}

/**
 * Waits for the public registration config, then renders the form with it: a
 * channel switched off keeps its field but loses its Verify step.
 */
export default function StudentRegisterForm() {
  const { ready, emailRequired, phoneRequired } = useRegistrationConfig()
  if (!ready) return <LoadingBlock label="Loading registration…" />
  return (
    <StudentRegisterFormBody emailRequired={emailRequired} phoneRequired={phoneRequired} />
  )
}

function StudentRegisterFormBody({ emailRequired, phoneRequired }) {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [form, setForm] = useState(INITIAL)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [loading, setLoading] = useState(false)

  // Public list — this runs before the student has any session.
  const {
    data: universityData,
    loading: universitiesLoading,
    error: universitiesError,
    reload: reloadUniversities,
  } = useAsync((options) => universitiesApi.list(options), {
    key: queryKeys.universities,
    staleTime: 60_000,
  })
  // Array-checked rather than `|| []`: a misrouted request answers with the
  // SPA's own HTML, and rendering options off a string would take the page down.
  const universities = Array.isArray(universityData) ? universityData : []
  const noUniversities = !universitiesLoading && !universitiesError && universities.length === 0

  // Only the chosen university's batches, fetched per campus — never one
  // combined list filtered here. The result is tagged with the university it
  // was fetched for: on a switch the hook still holds the previous campus's
  // batches until the new fetch lands, and those must never be offered.
  const universityId = form.university_id
  const {
    data: batchData,
    loading: batchesFetching,
    error: batchesFetchError,
    reload: reloadBatches,
  } = useAsync(
    (options) =>
      batchesApi.list(universityId, options).then((batches) => ({ universityId, batches })),
    {
      key: universityId ? queryKeys.universityBatches(universityId) : null,
      enabled: !!universityId,
      staleTime: 30_000,
    },
  )
  const batchesCurrent = !!universityId && batchData?.universityId === universityId
  const batches = batchesCurrent && Array.isArray(batchData.batches) ? batchData.batches : []
  const batchesError =
    universityId && (batchesCurrent || !batchesFetching) ? batchesFetchError : null
  const batchesLoading =
    !!universityId && !batchesError && (!batchesCurrent || (batchesFetching && !batchData))
  const noBatches = batchesCurrent && !batchesLoading && !batchesError && batches.length === 0

  const verification = useRegistrationVerification({
    emailRequired,
    phoneRequired,
    email: form.email,
    countryCode: form.country_code,
    mobileNational: form.mobile_national,
    onFieldError: (field, message) => setErrors((prev) => ({ ...prev, [field]: message })),
  })

  // The university decides which id the student gives: NIAT ID, or a College
  // ID for a Non NIAT university. A university with no type is NIAT.
  const selectedUniversity = universities.find((item) => item.id === form.university_id)
  const isNonNiat = selectedUniversity?.college_type === COLLEGE_TYPES.NON_NIAT

  const fieldErrors = validateStudentForm(form, { nonNiat: isNonNiat })
  const canSubmit =
    verification.bothVerified && !noBatches && Object.keys(fieldErrors).length === 0

  const niatId = form.niat_id.trim()
  const niatValid = isNiatId(niatId)

  /**
   * IDs are written in upper case, and the backend matches them exactly when
   * checking that one is not already taken — so fold the case here rather than
   * letting "n26k01a0021" register as a second, different student.
   */
  const updateNiatId = (event) => {
    const value = event.target.value.toUpperCase()
    setForm((current) => ({ ...current, niat_id: value }))
    setErrors((prev) => ({ ...prev, niat_id: undefined }))
    setSubmitError('')
  }

  /**
   * A new campus invalidates the batch (batches belong to one university) and
   * the id: the new one may ask for the other kind.
   */
  const updateUniversity = (event) => {
    const value = event.target.value
    setForm((current) => ({
      ...current,
      university_id: value,
      batch_id: '',
      niat_id: '',
      college_id: '',
    }))
    setErrors((prev) => ({
      ...prev,
      university_id: undefined,
      batch_id: undefined,
      niat_id: undefined,
      college_id: undefined,
    }))
    setSubmitError('')
  }

  const update = (key) => (event) => {
    const value = event.target.value
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setSubmitError('')
    // Editing an identifier drops only ITS OWN verification. Do not touch the
    // session here: the hook compares the live pair against the bound one on
    // the next send and resets both channels if the pair actually moved.
    // Clearing the session id on every keystroke instead wiped the id out from
    // under an in-flight OTP — verify mobile, start typing while waiting for
    // the SMS, and the confirm posted an empty session_id — and it silently
    // dropped the other channel's badge.
    if (key === 'email' && verification.emailState === VERIFY.VERIFIED) {
      verification.resetEmailVerification()
    }
    if (
      (key === 'mobile_national' || key === 'country_code') &&
      verification.phoneState === VERIFY.VERIFIED
    ) {
      verification.resetPhoneVerification()
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validation = validateStudentForm(form, { nonNiat: isNonNiat })
    setErrors(validation)
    if (!canSubmit || Object.keys(validation).length) return
    setLoading(true)
    setSubmitError('')
    try {
      // Use the id this call returns: a rebind can rotate it, and the state
      // copy is still the previous value in this tick.
      const sessionId = await verification.ensureFullSession()
      const data = await authApi.registerComplete({
        session_id: sessionId,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: verification.email,
        university_id: form.university_id,
        batch_id: form.batch_id,
        // One id, never both: the backend reads the one this university's type asks for.
        ...(isNonNiat
          ? { college_id: form.college_id.trim() }
          : { niat_id: form.niat_id.trim() }),
        mobile_number: verification.phoneE164,
        password: form.password,
        confirm_password: form.confirm_password,
      })
      if (data?.csrf_token) setCsrfToken(data.csrf_token)
      await refresh()
      trackEvent('Student Registered', {
        collegeType: isNonNiat ? COLLEGE_TYPES.NON_NIAT : COLLEGE_TYPES.NIAT,
      })
      navigate(ROLE_HOME.student, { replace: true })
    } catch (err) {
      // The campus was deleted between loading the form and submitting it.
      // Drop the stale choice and reload the list so the student picks again
      // from what still exists.
      const code = authErrorCode(err)
      if (code === AUTH_ERROR.UNKNOWN_UNIVERSITY) {
        setForm((current) => ({ ...current, university_id: '', batch_id: '' }))
        reloadUniversities({ force: true })
      }
      // The batch was deleted, or is not this university's. Either way the
      // list on screen is out of date: drop the choice and refetch it.
      if (code === AUTH_ERROR.UNKNOWN_BATCH || code === AUTH_ERROR.BATCH_UNIVERSITY_MISMATCH) {
        setForm((current) => ({ ...current, batch_id: '' }))
        reloadBatches({ force: true })
      }
      const field = authErrorField(err)
      if (field) setErrors((prev) => ({ ...prev, [field]: authErrorMessage(err) }))
      else setSubmitError(authErrorMessage(err, 'Registration failed. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const disabledReason = !canSubmit
    ? noUniversities
      ? 'Universities are not available yet. Ask an admin to add your campus.'
      : noBatches
        ? NO_BATCHES_MESSAGE
        : !verification.bothVerified
        ? verifyPrompt(emailRequired, phoneRequired)
        : 'Fill every required field and match the password rules.'
    : ''

  const mobileField = (
    <MobileField
      countryCode={form.country_code}
      mobileNational={form.mobile_national}
      onChange={update}
      error={errors.mobile_national}
      locked={verification.phoneState === VERIFY.VERIFIED}
    />
  )

  const emailField = (
    <Input
      label="Email"
      type="email"
      required
      autoComplete="email"
      value={form.email}
      onChange={update('email')}
      error={errors.email}
      disabled={verification.emailState === VERIFY.VERIFIED}
      readOnly={verification.emailState === VERIFY.VERIFIED}
    />
  )

  return (
    <form className="stack-md" onSubmit={handleSubmit} noValidate>
      {submitError && <Alert variant="danger">{submitError}</Alert>}

      {/* Each channel switched on verifies independently and must be green
          before submit; a channel switched off is collected, never verified. */}
      {phoneRequired ? (
        <OtpRow
          label="Mobile"
          state={verification.phoneState}
          code={verification.phoneCode}
          error={verification.phoneError}
          cooldown={verification.phoneCooldown}
          canStart={verification.phoneReady}
          onCodeChange={verification.setPhoneCode}
          sentTo={verification.phoneE164}
          onVerify={verification.sendPhoneOtp}
          onConfirm={verification.confirmPhoneOtp}
          onResend={verification.sendPhoneOtp}
          extra={mobileField}
        />
      ) : (
        mobileField
      )}
      <div id={RECAPTCHA_CONTAINER_ID} />

      {emailRequired ? (
        <OtpRow
          label="Email"
          state={verification.emailState}
          code={verification.emailCode}
          error={verification.emailError}
          cooldown={verification.emailCooldown}
          canStart={verification.emailReady}
          onCodeChange={verification.setEmailCode}
          sentTo={verification.email}
          onVerify={verification.sendEmailOtp}
          onConfirm={verification.confirmEmailOtp}
          onResend={verification.sendEmailOtp}
          extra={emailField}
        />
      ) : (
        emailField
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="First name"
          required
          autoComplete="given-name"
          value={form.first_name}
          onChange={update('first_name')}
          error={errors.first_name}
        />
        <Input
          label="Last name"
          required
          autoComplete="family-name"
          value={form.last_name}
          onChange={update('last_name')}
          error={errors.last_name}
        />
      </div>

      {/* Chosen from the catalogue, never typed: the value posted is the id and
          the label is whatever the backend composed for it. */}
      <Select
        label="University name"
        required
        value={form.university_id}
        onChange={updateUniversity}
        error={errors.university_id}
        disabled={universitiesLoading || noUniversities}
        hint={
          noUniversities
            ? 'Universities are not available yet. Ask an admin to add your campus.'
            : undefined
        }
      >
        <option value="" disabled>
          {universitiesLoading ? 'Loading universities…' : 'Select university'}
        </option>
        {universities.map((university) => (
          <option key={university.id} value={university.id}>
            {university.display_label}
          </option>
        ))}
      </Select>
      {universitiesError && (
        <Alert variant="warning">
          The university list could not be loaded.{' '}
          <button
            type="button"
            className="link-btn"
            onClick={() => reloadUniversities({ force: true })}
          >
            Try again
          </button>
        </Alert>
      )}

      {/* Disabled until a university is chosen, and filled only from that
          university's batch list. */}
      <Select
        label="Batch"
        required
        value={form.batch_id}
        onChange={update('batch_id')}
        error={errors.batch_id || (noBatches ? NO_BATCHES_MESSAGE : undefined)}
        disabled={!universityId || batchesLoading || !!batchesError || noBatches}
      >
        <option value="" disabled>
          {!universityId
            ? 'Select a university first'
            : batchesLoading
              ? 'Loading batches…'
              : noBatches
                ? 'No batches available'
                : 'Select batch'}
        </option>
        {batches.map((batch) => (
          <option key={batch.id} value={batch.id}>
            {batch.name}
          </option>
        ))}
      </Select>
      {batchesError && (
        <Alert variant="warning">
          The batch list could not be loaded.{' '}
          <button type="button" className="link-btn" onClick={() => reloadBatches({ force: true })}>
            Try again
          </button>
        </Alert>
      )}
      {isNonNiat ? (
        // Plain text from the college: no N… pattern and no verified line.
        <Input
          id="college-id"
          label="College ID"
          required
          value={form.college_id}
          onChange={update('college_id')}
          error={errors.college_id}
          maxLength={COLLEGE_ID_MAX_LENGTH}
          autoComplete="off"
          spellCheck={false}
          hint="The ID issued by your college."
        />
      ) : (
        <div>
          <Input
            id="niat-id"
            label="NIAT ID"
            required
            value={form.niat_id}
            onChange={updateNiatId}
            error={errors.niat_id}
            maxLength={NIAT_ID_LENGTH}
            autoComplete="off"
            spellCheck={false}
            placeholder={NIAT_ID_SAMPLE}
            aria-invalid={niatId ? !niatValid : undefined}
            aria-describedby="niat-id-status niat-id-format"
          />
          {/* Always mounted so a screen reader announces the change rather than
              the region appearing already filled in. */}
          <p
            id="niat-id-status"
            aria-live="polite"
            className={
              niatId
                ? `mt-1.5 flex items-center gap-1.5 text-[13px] font-medium ${
                    niatValid ? 'text-passed' : 'text-missing'
                  }`
                : 'sr-only'
            }
          >
            {niatId ? (
              <>
                <Icon name={niatValid ? 'checkCircle' : 'xCircle'} size={15} />
                {niatValid ? 'Verified' : 'Not verified'}
              </>
            ) : (
              ''
            )}
          </p>
          <p id="niat-id-format" className="mt-1 text-[12.5px] text-muted">
            It looks like this: <span className={MONO}>{NIAT_ID_SAMPLE}</span>
          </p>
        </div>
      )}

      <PasswordFields
        password={form.password}
        confirmPassword={form.confirm_password}
        onPasswordChange={update('password')}
        onConfirmPasswordChange={update('confirm_password')}
        errors={errors}
      />

      <Button type="submit" variant="accent" block loading={loading} disabled={!canSubmit}>
        Create account
      </Button>
      {disabledReason && <p className="text-center text-sm text-muted">{disabledReason}</p>}
    </form>
  )
}
