type AuthPhase = 'sign-in' | 'verification' | 'reset-password';

const credentialErrors = new Set([
  'form_identifier_not_found',
  'form_password_incorrect',
  'form_password_or_identifier_incorrect',
  'form_password_or_identifier_invalid',
  'identifier_not_found',
]);

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const value = error as { code?: unknown; errors?: Array<{ code?: unknown }> };
  const code = value.errors?.[0]?.code ?? value.code;
  // Never display messages, request bodies, metadata, or identifiers from errors.
  return typeof code === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(code)
    ? code
    : undefined;
}

export function authFailureMessage(error: unknown, phase: AuthPhase): string {
  const code = errorCode(error);
  if (code && credentialErrors.has(code)) {
    // Keep unknown identifiers indistinguishable from incorrect passwords.
    return 'The Customer ID/email or password was not accepted. Check your details or use Forgot password.';
  }
  const messages: Record<string, string> = {
    form_password_pwned: 'This password needs a security update. Use Forgot password to choose a new password before signing in.',
    form_password_length_too_short: 'Choose a longer password that meets your account’s security requirements.',
    form_password_validation_failed: 'This password does not meet the security requirements. Choose a different password.',
    too_many_requests: 'Too many attempts. Please wait before trying again.',
    user_locked: 'Sign-in is temporarily locked. Please wait before trying again or use password recovery.',
    user_locked_until: 'Sign-in is temporarily locked. Please wait before trying again or use password recovery.',
    session_exists: 'A sign-in session is already open. Reload this page to return to your account.',
    form_code_incorrect: 'That code was not accepted. Check the newest email and try again.',
    verification_expired: 'That code has expired. Request a new code and use the newest email.',
    form_code_expired: 'That code has expired. Request a new code and use the newest email.',
    strategy_for_user_invalid: 'This sign-in method is not available for the account. Contact Globus support.',
    network_error: 'The authentication service could not be reached. Check your connection and try again.',
  };
  const defaults: Record<AuthPhase, string> = {
    'sign-in': 'Sign-in could not be completed. Please try again.',
    verification: 'The verification step could not be completed. Try again or request a fresh code.',
    'reset-password': 'Your password could not be updated. Check the password requirements and try again.',
  };
  const message = (code && messages[code]) || defaults[phase];
  return code ? `${message} Reference: ${code}.` : message;
}

export function signInNextStep(status: string, error: unknown) {
  if (error) return 'error';
  if (status === 'complete') return 'complete';
  if (status === 'needs_new_password') return 'password-update';
  if (['needs_first_factor', 'needs_second_factor', 'needs_client_trust'].includes(status)) {
    return 'verification';
  }
  return 'unsupported';
}
