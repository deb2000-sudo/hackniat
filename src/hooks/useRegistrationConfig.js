import { authApi } from '../api/auth'
import { queryKeys } from '../lib/queryKeys'
import { useAsync } from './useAsync'

/**
 * Which registration channels need an OTP, from the public
 * GET /auth/registration-config. Fetched once and kept for the visit.
 *
 * A switch that is off only hides that field's Verify step — the email or
 * mobile is still collected. If the config cannot be loaded, both stay on:
 * the current OTP flow is the safe default, and the API enforces the real
 * setting at /register/complete either way.
 */
export function useRegistrationConfig() {
  const { data, loading, error } = useAsync((options) => authApi.registrationConfig(options), {
    key: queryKeys.registrationConfig,
    staleTime: Infinity,
  })
  return {
    ready: Boolean(data) || Boolean(error) || !loading,
    emailRequired: data?.email_verification_enabled !== false,
    phoneRequired: data?.mobile_verification_enabled !== false,
  }
}
