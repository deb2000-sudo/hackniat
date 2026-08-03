import { useEffect, useMemo, useState } from 'react'
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

const RESET_COUNT_META = {
  hackathons: { label: 'Hackathons', icon: 'trophy', hint: 'Events and schedules' },
  themes: { label: 'Themes', icon: 'sparkles', hint: 'Challenge themes' },
  evaluation_requirements: {
    label: 'Requirements',
    icon: 'clipboard',
    hint: 'Submission field sets',
  },
  ai_evaluation_metric_scoring: {
    label: 'Scorecards',
    icon: 'chart',
    hint: 'Metric scoring configs',
  },
  ai_evaluation_prompts: {
    label: 'AI prompts',
    icon: 'spark',
    hint: 'Checklist & video templates',
  },
  ai_evaluation_prompt: {
    label: 'Legacy AI prompts',
    icon: 'spark',
    hint: 'Old singular collection',
  },
  submissions: { label: 'Submissions', icon: 'video', hint: 'Student entries' },
  analysis: { label: 'Analysis', icon: 'file', hint: 'AI evaluation reports' },
  users_non_admin: {
    label: 'Non-admin users',
    icon: 'users',
    hint: 'Students & evaluators',
  },
  firebase_auth_non_admin: {
    label: 'Firebase Auth',
    icon: 'shield',
    hint: 'Non-admin auth accounts',
  },
  gcs_evaluation_bucket: {
    label: 'Cloud storage objects',
    icon: 'upload',
    hint: 'Videos & banners (bucket kept)',
  },
}

function formatCollectionLabel(name) {
  return (
    RESET_COUNT_META[name]?.label ||
    String(name || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
  )
}

function ResetSummary({ result, onDismiss, onDashboard }) {
  const deletedEntries = useMemo(() => {
    const counts = result?.deleted_counts || {}
    return Object.entries(counts)
      .map(([key, count]) => ({
        key,
        count: Number(count) || 0,
        label: formatCollectionLabel(key),
        icon: RESET_COUNT_META[key]?.icon || 'trash',
        hint: RESET_COUNT_META[key]?.hint || key,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [result])

  const totalDeleted = deletedEntries.reduce((sum, item) => sum + item.count, 0)
  const preserved = Array.isArray(result?.preserved) ? result.preserved : []

  return (
    <div className={`${PANEL} overflow-hidden border-volt-edge bg-surface`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-volt-edge bg-volt-tint px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-drop border border-volt-edge bg-volt text-on-volt">
            <Icon name="check" size={18} />
          </span>
          <div>
            <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">
              Database reset complete
            </h3>
            <p className="mt-1 max-w-2xl text-[13.5px] text-muted">
              {result?.message ||
                'Wipeable application data was cleared. Admin accounts and the Profile Password were preserved.'}
            </p>
          </div>
        </div>
        <div className="rounded-drop border border-volt-edge bg-surface px-3 py-2 text-right">
          <div className={`${MONO} text-[22px] font-semibold text-volt-ink`}>{totalDeleted}</div>
          <div className="text-[11px] uppercase tracking-[0.08em] text-muted">Items removed</div>
        </div>
      </div>

      <div className="stack-md p-5">
        <div>
          <span className={EYEBROW}>Removed</span>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {deletedEntries.map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-3 rounded-drop border border-hairline bg-surface px-3.5 py-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-drop border border-hairline bg-raised text-muted">
                  <Icon name={item.icon} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium text-ink">{item.label}</div>
                  <div className="truncate text-[12px] text-muted">{item.hint}</div>
                </div>
                <strong className={`${MONO} text-[18px] text-ink`}>{item.count}</strong>
              </div>
            ))}
          </div>
        </div>

        {preserved.length > 0 && (
          <div>
            <span className={EYEBROW}>Preserved</span>
            <ul className="mt-3 flex flex-wrap gap-2">
              {preserved.map((item) => (
                <li
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-drop border border-hairline bg-raised px-2.5 py-1.5 text-[12.5px] text-ink"
                >
                  <Icon name="shield" size={13} className="text-volt-ink" />
                  <code className={MONO}>{item}</code>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            variant="accent"
            onClick={onDashboard}
            rightIcon={<Icon name="arrowRight" size={15} />}
          >
            Go to dashboard
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss summary
          </Button>
        </div>
      </div>
    </div>
  )
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
      <header className="mb-7 sm:mb-9">
        <span className={EYEBROW}>Admin</span>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-ink md:text-[36px]">
          Application Settings
        </h1>
        <p className="mt-2 max-w-3xl text-[15px] text-muted md:text-base">
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

      {resetResult && (
        <div className="mb-6">
          <ResetSummary
            result={resetResult}
            onDismiss={() => setResetResult(null)}
            onDashboard={() => navigate('/admin')}
          />
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2 xl:gap-6">
        <Card className="min-w-0">
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

        <section className={`${PANEL} min-w-0 overflow-hidden border-missing/30`}>
          <div className="flex items-start gap-3 border-b border-missing/20 bg-danger-soft px-4 py-4 sm:px-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-drop border border-missing/30 bg-surface text-missing">
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

            <div>
              <span className={EYEBROW}>What gets wiped</span>
              {/* Pills wrap to content — a fixed grid left long collection names
                  truncated beside mostly-empty cells. */}
              <ul className="mt-3 flex flex-wrap gap-2">
                {(settings?.wipeable_collections || []).map((name) => (
                  <li
                    key={name}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-missing/25 bg-danger-soft py-1.5 pr-3 pl-2.5 text-[12px] text-missing"
                  >
                    <Icon name="trash" size={12} className="shrink-0 opacity-70" />
                    <span className={`${MONO} truncate`}>{name}</span>
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
