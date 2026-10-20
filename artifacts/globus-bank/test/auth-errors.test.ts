import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authFailureMessage, signInNextStep } from '../src/lib/auth-errors';

test('rejected credentials never start a code challenge or finalize a session', () => {
  for (const status of ['needs_first_factor', 'needs_second_factor', 'needs_client_trust', 'complete']) {
    assert.equal(signInNextStep(status, { code: 'form_password_incorrect' }), 'error');
  }
});

test('supported device trust and verification states continue without claiming success', () => {
  for (const status of ['needs_client_trust', 'needs_first_factor', 'needs_second_factor']) {
    assert.equal(signInNextStep(status, null), 'verification');
  }
  assert.equal(signInNextStep('complete', null), 'complete');
  assert.equal(signInNextStep('needs_new_password', null), 'password-update');
  assert.equal(signInNextStep('needs_identifier', null), 'unsupported');
});

test('unknown customer and incorrect password have the same public error', () => {
  assert.equal(
    authFailureMessage({ errors: [{ code: 'form_identifier_not_found' }] }, 'sign-in'),
    authFailureMessage({ errors: [{ code: 'form_password_incorrect' }] }, 'sign-in'),
  );
});

test('security requirements, lockouts and existing sessions are not labelled incorrect passwords', () => {
  assert.match(authFailureMessage({ code: 'form_password_pwned' }, 'sign-in'), /security update/);
  assert.match(authFailureMessage({ code: 'user_locked' }, 'sign-in'), /temporarily locked/);
  assert.match(authFailureMessage({ code: 'session_exists' }, 'sign-in'), /already open/);
  assert.match(authFailureMessage({ code: 'form_password_length_too_short' }, 'reset-password'), /longer password/);
});

test('verification errors distinguish expired codes from incorrect codes', () => {
  assert.match(authFailureMessage({ code: 'verification_expired' }, 'verification'), /expired/);
  assert.match(authFailureMessage({ code: 'form_code_incorrect' }, 'verification'), /newest email/);
});

test('diagnostics expose only a safe code, never error messages or metadata', () => {
  const message = authFailureMessage({
    errors: [{ code: 'unexpected_auth_failure', longMessage: 'sensitive-content', meta: { identifier: 'private@example.com' } }],
  }, 'sign-in');
  assert.match(message, /Reference: unexpected_auth_failure/);
  assert.doesNotMatch(message, /sensitive-content|private@example/);
  assert.doesNotMatch(authFailureMessage({ code: '<script>private</script>' }, 'sign-in'), /script|private/);
});
