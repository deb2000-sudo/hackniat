import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { adminApi } from '../../api/admin'
import { WRAP_APP, EYEBROW, PANEL, MONO } from '../../components/drop/theme'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Card, { CardBody, CardHeader } from '../../components/ui/Card'
import Icon from '../../components/ui/Icon'
import Input, { PasswordInput } from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { LoadingBlock } from '../../components/ui/Spinner'

const PROFILE_FORM = {
  current_profile_password: '',
  new_profile_password: '',
  confirm_new_profile_password: '',
}

const RESET_FORM = {
  profile_password: '',
  confirm_phrase: '',
}

export default function ApplicationSettingsPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [profileForm, setProfileForm] = useState(PROFILE_FORM)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')

  const [resetForm, setResetForm] = useState(RESET_FORM)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetResult, setResetResult] = useState(null)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)

  const loadSettings = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await adminApi.getSettings()
      setSettings(data)
    } catch (error) {
      setLoadError(error.message || 'Unable to load application settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    if (!profileSuccess) return undefined
    const timer = setTimeout(() => setProfileSuccess(''), 4000)
    return () => clearTimeout(timer)
  }, [profileSuccess])

  const confirmPhrase = settings?.reset_confirm_phrase || 'RESET'
  const profilePasswordsMatch =
    profileForm.new_profile_password.length >= 6 &&
    profileForm.confirm_new_profile_password.length >= 6 &&
    profileForm.new_profile_password === profileForm.confirm_new_profile_password
  const canSubmitProfile =
    profileForm.current_profile_password.length > 0 && profilePasswordsMatch
  const profileConfirmError =
    profileForm.confirm_new_profile_password &&
    profileForm.new_profile_password !== profileForm.confirm_new_profile_password
      ? 'New profile password and confirm do not match'
      : ''

  const phraseMatches = resetForm.confirm_phrase === confirmPhrase
  const canOpenResetModal =
    resetForm.profile_password.length > 0 && phraseMatches && !resetLoading

  const updateProfile = (key) => (event) => {
    setProfileForm((current) => ({ ...current, [key]: event.target.value }))
    setProfileError('')
    setProfileSuccess('')
  }

  const updateReset = (key) => (event) => {
    setResetForm((current) => ({ ...current, [key]: event.target.value }))
    setResetError('')
  }

  const submitProfilePassword = async (event) => {
    event.preventDefault()
    if (!canSubmitProfile || profileLoading) return
    setProfileLoading(true)
    setProfileError('')
    setProfileSuccess('')
    try {
      const response = await adminApi.changeProfilePassword(profileForm)
      setProfileSuccess(response?.message || 'Profile password changed successfully')
      setProfileForm(PROFILE_FORM)
      await loadSettings()
    } catch (error) {
      setProfileError(error.message || 'Unable to change the profile password.')
    } finally {
      setProfileLoading(false)
    }
  }

  const submitReset = async () => {
    setResetLoading(true)
    setResetError('')
    try {
      const result = await adminApi.resetDatabase({
        profile_password: resetForm.profile_password,
        confirm_phrase: resetForm.confirm_phrase,
      })
      setResetResult(result)
      setResetForm(RESET_FORM)
      setConfirmResetOpen(false)
    } catch (error) {
      setResetError(error.message || 'Unable to reset the database.')
      setConfirmResetOpen(false)
    } finally {
      setResetLoading(false)
    }
  }

  if (loading && !settings) {
    return (
      <div className={`${WRAP_APP} py-7 md:py-10`}>
        <LoadingBlock label="Loading application settings…" />
      </div>
    )
  }

  return (
    <div className={`${WRAP_APP} py-7 md:py-10`}>
      <header className="mb-7 max-w-3xl sm:mb-9">
        <span className={EYEBROW}>Admin</span>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink md:text-[36px]">
          Application Settings
        </h1>
        <p className="mt-2 text-[15px] text-muted md:text-base">
          Manage the Profile Password used for destructive actions and reset wipeable data.
        </p>
      </header>

      {loadError && (
        <div className="mb-6">
          <Alert variant="danger" title="Unable to load settings">
            {loadError}
            <div className="alert-action">
              <Button size="sm" variant="ghost" onClick={loadSettings}>
                Try again
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {settings?.default_profile_password_hint && (
        <div className="mb-6">
          <Alert variant="warning" title="Change the default Profile Password.">
            The Profile Password is still set to the default hint (
            <code className={MONO}>{settings.default_profile_password_hint}</code>
            ). Update it before using destructive actions in production.
          </Alert>
        </div>
      )}

      {profileSuccess && (
        <div className="mb-6">
          <Alert variant="success">{profileSuccess}</Alert>
        </div>
      )}

      <div className="stack-lg max-w-3xl">
        <Card>
          <CardHeader>
            <div>
              <h3>Profile Password</h3>
              <p className="text-sm text-muted">
                Used to authorize destructive actions such as Reset Database — not for signing in.
              </p>
            </div>
            <Icon name="shield" size={20} className="text-muted" />
          </CardHeader>
          <CardBody>
            <form className="stack-md" onSubmit={submitProfilePassword} noValidate>
              {profileError && <Alert variant="danger">{profileError}</Alert>}

              <PasswordInput
                label="Current profile password"
                autoComplete="off"
                required
                value={profileForm.current_profile_password}
                onChange={updateProfile('current_profile_password')}
                disabled={profileLoading}
              />
              <PasswordInput
                label="New profile password"
                autoComplete="new-password"
                minLength={6}
                required
                value={profileForm.new_profile_password}
                onChange={updateProfile('new_profile_password')}
                hint="At least 6 characters"
                disabled={profileLoading}
              />
              <PasswordInput
                label="Confirm new profile password"
                autoComplete="new-password"
                minLength={6}
                required
                value={profileForm.confirm_new_profile_password}
                onChange={updateProfile('confirm_new_profile_password')}
                error={profileConfirmError}
                disabled={profileLoading}
              />

              <Button
                type="submit"
                variant="accent"
                block
                loading={profileLoading}
                disabled={!canSubmitProfile}
              >
                Change Profile Password
              </Button>

              <p className="text-sm text-muted">
                Your login password is unchanged here. Use{' '}
                <Link to="/settings/change-password" className="underline underline-offset-4">
                  Change Password
                </Link>{' '}
                to update the password you sign in with.
              </p>
            </form>
          </CardBody>
        </Card>

        <section className={`${PANEL} overflow-hidden border-[#5a2222] bg-[#1a0f0f]`}>
          <div className="flex items-start gap-3 border-b border-[#5a2222] px-5 py-4">
            <span className="grid size-10 place-items-center rounded-drop border border-[#5a2222] bg-[#2a1010] text-[#ff8a8a]">
              <Icon name="alert" size={18} />
            </span>
            <div>
              <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">
                Reset Database
              </h3>
              <p className="mt-1 text-[13.5px] text-muted">
                Permanently deletes wipeable collections. Admin accounts and the Profile Password
                are preserved.
              </p>
            </div>
          </div>

          <div className="stack-md p-5">
            {resetError && <Alert variant="danger">{resetError}</Alert>}

            {resetResult && (
              <Alert variant="success" title={resetResult.message || 'Database reset complete'}>
                <div className="stack-sm mt-2">
                  {resetResult.deleted_counts && (
                    <ul className="stack-sm">
                      {Object.entries(resetResult.deleted_counts).map(([name, count]) => (
                        <li key={name}>
                          <code className={MONO}>{name}</code>: {count}
                        </li>
                      ))}
                    </ul>
                  )}
                  {resetResult.preserved?.length ? (
                    <p className="text-sm">
                      Preserved: {resetResult.preserved.join(', ')}
                    </p>
                  ) : null}
                  <div className="alert-action">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate('/admin')}
                    >
                      Go to dashboard
                    </Button>
                  </div>
                </div>
              </Alert>
            )}

            <div>
              <span className={`${EYEBROW} mb-2`}>Wipeable collections</span>
              <ul className="mt-2 flex flex-wrap gap-2">
                {(settings?.wipeable_collections || []).map((name) => (
                  <li
                    key={name}
                    className="rounded-drop border border-[#5a2222] bg-[#2a1010] px-2.5 py-1.5 text-[12.5px] text-[#ffb4b4]"
                  >
                    <code className={MONO}>{name}</code>
                  </li>
                ))}
              </ul>
            </div>

            <Alert variant="warning">
              Admins and the Profile Password configuration are kept. Everything listed above will
              be removed.
            </Alert>

            <PasswordInput
              label="Profile Password"
              autoComplete="off"
              required
              value={resetForm.profile_password}
              onChange={updateReset('profile_password')}
              disabled={resetLoading}
            />
            <Input
              label={`Type ${confirmPhrase} to confirm`}
              value={resetForm.confirm_phrase}
              onChange={updateReset('confirm_phrase')}
              placeholder={confirmPhrase}
              disabled={resetLoading}
              hint={`Must match exactly: ${confirmPhrase}`}
              error={
                resetForm.confirm_phrase && !phraseMatches
                  ? `Enter ${confirmPhrase} exactly`
                  : ''
              }
            />

            <Button
              type="button"
              variant="danger"
              block
              disabled={!canOpenResetModal}
              loading={resetLoading}
              onClick={() => setConfirmResetOpen(true)}
              leftIcon={<Icon name="trash" size={17} />}
            >
              Reset Database
            </Button>
          </div>
        </section>
      </div>

      <Modal
        open={confirmResetOpen}
        onClose={() => !resetLoading && setConfirmResetOpen(false)}
        title="Reset database?"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={resetLoading}
              onClick={() => setConfirmResetOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" loading={resetLoading} onClick={submitReset}>
              Yes, reset database
            </Button>
          </>
        }
      >
        <p>
          This cannot be undone. All wipeable collections will be permanently deleted. Admin
          accounts and the Profile Password will be preserved.
        </p>
      </Modal>
    </div>
  )
}
