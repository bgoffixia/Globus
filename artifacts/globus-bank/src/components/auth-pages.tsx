import { useState, type FormEvent, type ReactNode } from 'react';
import { useClerk, useSignIn, useSignUp } from '@clerk/react';
import { getGetBankProfileQueryKey, useCompleteRequiredPasswordReset, useGetBankProfile, useLookupCustomerId, useUpdateBankProfile } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import './auth-pages.css';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const asset = (file: string) => `${basePath}/${file}`;

type AuthFrameProps = {
  mode: 'sign-in' | 'sign-up';
  children: ReactNode;
};

export function AuthFrame({ mode, children }: AuthFrameProps) {
  const isSignUp = mode === 'sign-up';

  return (
    <main className="gb-auth-shell">
      <aside className="gb-brand-panel">
        <div className="gb-brand-lockup">
          <span className="gb-mark-wrap">
            <img src={asset('globus-mark-transparent.png')} alt="" className="gb-mark" />
          </span>
          <span className="gb-wordmark-wrap">
            <img src={asset('globus-wordmark-transparent.png')} alt="Globus Bank" className="gb-wordmark" />
          </span>
        </div>
        <div className="gb-brand-copy">
          <span className="gb-eyebrow">A clearer view of your money</span>
          <h2>{isSignUp ? <>Begin with<br />a better view.</> : <>Your world.<br />In one place.</>}</h2>
          <p>
            {isSignUp
              ? 'Create your member account and bring your Globus activity into focus.'
              : 'Access your accounts, follow your balances, and move money with clarity.'}
          </p>
        </div>
        <div className="gb-world-art" aria-hidden="true">
          <span className="gb-orbit gb-orbit-one" />
          <span className="gb-orbit gb-orbit-two" />
          <span className="gb-orbit-dot" />
          <span className="gb-world-label">GLOBAL FINANCE</span>
        </div>
        <div className="gb-panel-foot">
          <span>GLOBUS BANK</span>
          <span>YOUR WORLD. OUR PRIORITY.</span>
        </div>
      </aside>

      <section className="gb-form-side">
        <div className="gb-mobile-brand">
          <img src={asset('globus-mark-transparent.png')} alt="" />
          <img src={asset('globus-wordmark-transparent.png')} alt="Globus Bank" />
        </div>
        <div className={`gb-auth-content ${isSignUp ? 'gb-signup-content' : ''}`}>
          {children}
          <div className="gb-form-footer">
            <span>Globus Bank</span>
            <span>Member account access</span>
          </div>
        </div>
      </section>
    </main>
  );
}

export function ClerkSignInForm() {
  const [, setLocation] = useLocation();
  const { signIn, fetchStatus } = useSignIn();
  const lookupCustomerId = useLookupCustomerId();
  const [customerId, setCustomerId] = useState('');
  const [email, setEmail] = useState('');
  const [useEmail, setUseEmail] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const busy = fetchStatus === 'fetching' || lookupCustomerId.isPending;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      const identifier = useEmail
        ? email.trim()
        : (await lookupCustomerId.mutateAsync({
            data: { customerId: customerId.trim().toUpperCase() },
          })).email;
      const result = await signIn.password({
        identifier,
        password,
      });
      if (result.error || signIn.status !== 'complete') {
        setError('Your sign-in details could not be verified. Check them and try again.');
        return;
      }
      const finalized = await signIn.finalize({ navigate: () => undefined });
      if (finalized.error) {
        setError('Sign-in could not be completed. Please try again.');
        return;
      }
      setLocation('/dashboard');
    } catch {
      setError('Your sign-in details could not be verified. Check them and try again.');
    }
  };

  return (
    <div className="gb-signin-form-wrap">
      <div className="gb-form-heading">
        <span className="gb-step-label">MEMBER ACCESS <i /></span>
        <h1>Welcome back</h1>
        <p>{useEmail ? 'Sign in with your email address and password.' : 'Use your Globus Customer ID to access your account.'}</p>
      </div>
      <form className="gb-auth-form" onSubmit={submit}>
        <label className="gb-field-label" htmlFor={useEmail ? 'gb-signin-email' : 'gb-customer-id'}>
          {useEmail ? 'Email address' : 'Customer ID'}
        </label>
        <input
          id={useEmail ? 'gb-signin-email' : 'gb-customer-id'}
          className={`gb-input ${useEmail ? '' : 'gb-customer-id-input'}`}
          type={useEmail ? 'email' : 'text'}
          autoComplete={useEmail ? 'email' : 'username'}
          autoCapitalize={useEmail ? 'none' : 'characters'}
          inputMode={useEmail ? 'email' : 'text'}
          minLength={useEmail ? undefined : 7}
          maxLength={useEmail ? 254 : 7}
          pattern={useEmail ? undefined : '[A-Za-z0-9]{7}'}
          value={useEmail ? email : customerId}
          onChange={event => useEmail
            ? setEmail(event.target.value)
            : setCustomerId(event.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7))}
          required
        />
        <label className="gb-field-label gb-signin-spaced-label" htmlFor="gb-customer-password">Password</label>
        <input
          id="gb-customer-password"
          className="gb-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          required
        />
        {error && <p role="alert" className="gb-auth-error">{error}</p>}
        <button className="gb-primary-button" type="submit" disabled={busy || (useEmail ? !email.trim() : customerId.length !== 7) || !password}>
          <span>{busy ? 'Securely signing in…' : 'Sign in'}</span>
          <span aria-hidden="true">→</span>
        </button>
      </form>
      <div className="gb-login-recovery-actions">
        <button
          type="button"
          className="gb-login-recovery-action"
          onClick={() => { setUseEmail(current => !current); setError(''); }}
          aria-label={useEmail ? 'Use Customer ID to sign in' : 'Forgot your ID? Sign in with email instead'}
        >
          {useEmail ? 'Use Customer ID' : 'Forgot your ID?'}
        </button>
        <Link className="gb-login-recovery-action" href="/sign-in/email">Forgot password</Link>
      </div>
      <p className="gb-switch-copy">New to Globus? <Link href="/sign-up">Create an account <span aria-hidden="true">→</span></Link></p>
    </div>
  );
}

export function EmailRecoverySignInForm() {
  const [, setLocation] = useLocation();
  const { signIn, fetchStatus } = useSignIn();
  const profile = useGetBankProfile({ query: { queryKey: getGetBankProfileQueryKey(), enabled: false } });
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [stage, setStage] = useState<'email' | 'code' | 'password' | 'complete'>('email');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const busy = fetchStatus === 'fetching';

  const sendRecoveryCode = async () => {
    setError('');
    setNotice('');
    try {
      await signIn.create({ identifier: email.trim() });
      await signIn.resetPasswordEmailCode.sendCode();
    } catch {
      // Keep the same response for unknown addresses and other recovery failures.
    }
    setNotice('If an account can be recovered using that address, a verification code has been sent.');
  };

  const requestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendRecoveryCode();
    setStage('code');
  };

  const resendCode = async () => {
    await sendRecoveryCode();
  };

  const changeRecoveryEmail = async () => {
    await signIn.reset();
    setStage('email');
    setError('');
    setNotice('');
    setVerificationCode('');
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      const verified = await signIn.resetPasswordEmailCode.verifyCode({
        code: verificationCode.trim(),
      });
      if (verified.error || signIn.status !== 'needs_new_password') {
        setError('We could not verify those recovery details. Check the code and try again.');
        return;
      }
      setStage('password');
      setNotice('');
    } catch {
      setError('We could not verify those recovery details. Check the code and try again.');
    }
  };

  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      const reset = await signIn.resetPasswordEmailCode.submitPassword({ password: newPassword });
      if (reset.error || signIn.status !== 'complete') {
        setError('We could not complete recovery. Check your password and try again.');
        return;
      }
      const finalized = await signIn.finalize({ navigate: () => undefined });
      if (finalized.error) {
        setError('We could not complete recovery. Check your password and try again.');
        return;
      }
      const memberProfile = await profile.refetch();
      setCustomerId(memberProfile.data?.customerId ?? '');
      setStage('complete');
    } catch {
      setError('We could not complete recovery. Check your password and try again.');
    }
  };

  return (
    <div className="gb-signin-form-wrap">
      <div className="gb-form-heading">
        <span className="gb-step-label">PASSWORD RESET <i /></span>
        <h1>
          {stage === 'email' && 'Recover your account'}
          {stage === 'code' && 'Check your email'}
          {stage === 'password' && 'Choose a new password'}
          {stage === 'complete' && 'Recovery complete'}
        </h1>
        <p>
          {stage === 'email' && 'Enter the email address on your account to reset your password.'}
          {stage === 'code' && 'Enter the recovery code if one was sent to you.'}
          {stage === 'password' && 'Set a new password for your Globus account.'}
          {stage === 'complete' && 'Your password has been reset.'}
        </p>
      </div>
      {stage === 'email' && (
        <form className="gb-auth-form" onSubmit={requestCode}>
          <label className="gb-field-label" htmlFor="gb-recovery-email">Email address</label>
          <input id="gb-recovery-email" className="gb-input" type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} required />
          {error && <p role="alert" className="gb-auth-error">{error}</p>}
          <button className="gb-primary-button" type="submit" disabled={busy || !email.trim()}>
            <span>{busy ? 'Sending reset code…' : 'Send password reset code'}</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>
      )}
      {stage === 'code' && (
        <form className="gb-auth-form" onSubmit={verifyCode}>
          <label className="gb-field-label" htmlFor="gb-recovery-code">Recovery code</label>
          <input id="gb-recovery-code" className="gb-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={12} value={verificationCode} onChange={event => setVerificationCode(event.target.value.trim())} required />
          {notice && <p className="gb-auth-notice" role="status">{notice}</p>}
          {error && <p role="alert" className="gb-auth-error">{error}</p>}
          <button className="gb-primary-button" type="submit" disabled={busy || !verificationCode.trim()}>
            <span>{busy ? 'Verifying…' : 'Verify code'}</span>
            <span aria-hidden="true">→</span>
          </button>
          <button className="gb-recovery-secondary" type="button" disabled={busy} onClick={resendCode}>
            Send another code
          </button>
          <button className="gb-recovery-secondary" type="button" disabled={busy} onClick={changeRecoveryEmail}>
            Use a different email address
          </button>
        </form>
      )}
      {stage === 'password' && (
        <form className="gb-auth-form" onSubmit={resetPassword}>
          <label className="gb-field-label" htmlFor="gb-new-password">New password</label>
          <input id="gb-new-password" className="gb-input" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={event => setNewPassword(event.target.value)} required />
          <p className="gb-password-hint">Use at least 8 characters. Additional security rules are checked securely by Clerk.</p>
          {error && <p role="alert" className="gb-auth-error">{error}</p>}
          <button className="gb-primary-button" type="submit" disabled={busy || newPassword.length < 8}>
            <span>{busy ? 'Resetting password…' : 'Reset password'}</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>
      )}
      {stage === 'complete' && (
        <div className="gb-auth-form">
          {customerId ? (
            <>
              <label className="gb-field-label" htmlFor="gb-recovered-customer-id">Your Customer ID</label>
              <output id="gb-recovered-customer-id" className="gb-input gb-recovered-customer-id">{customerId}</output>
            </>
          ) : (
            <p className="gb-switch-copy">Your password is reset. Sign in to view your Customer ID on your Profile page.</p>
          )}
          <button className="gb-primary-button" type="button" onClick={() => setLocation(customerId ? '/dashboard' : '/profile')}>
            <span>{customerId ? 'Continue to your account' : 'Open Profile'}</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
      <p className="gb-switch-copy"><Link href="/sign-in">Back to sign in</Link></p>
    </div>
  );
}

export function RequiredPasswordResetPage() {
  const { signOut } = useClerk();
  const completeRequiredReset = useCompleteRequiredPasswordReset();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const busy = completeRequiredReset.isPending;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (newPassword.length < 8) {
      setError('Choose a password with at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    try {
      const result = await completeRequiredReset.mutateAsync({ data: { newPassword } });
      if (!result.completed) {
        setError('This reset request is no longer active. Sign in again or use Forgot password.');
        return;
      }
      setNotice('Your password is updated. Sign in again with your new password.');
      await signOut({ redirectUrl: `${basePath}/sign-in` || '/sign-in' });
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Password could not be updated. Try another password.');
    }
  };

  const openRecovery = async () => {
    await signOut({ redirectUrl: `${basePath}/sign-in/email` || '/sign-in/email' });
  };

  return (
    <AuthFrame mode="sign-in">
      <div className="gb-signin-form-wrap">
        <div className="gb-form-heading">
          <span className="gb-step-label">ACCOUNT SECURITY <i /></span>
          <h1>Choose a new password</h1>
          <p>An administrator required a password update. Set a new password to continue; all previous sessions have been ended.</p>
        </div>
        <form className="gb-auth-form" onSubmit={submit}>
          <label className="gb-field-label" htmlFor="gb-required-new-password">New password</label>
          <input
            id="gb-required-new-password"
            className="gb-input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            value={newPassword}
            onChange={event => setNewPassword(event.target.value)}
            required
          />
          <label className="gb-field-label" htmlFor="gb-required-confirm-password">Confirm new password</label>
          <input
            id="gb-required-confirm-password"
            className="gb-input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            value={confirmPassword}
            onChange={event => setConfirmPassword(event.target.value)}
            required
          />
          <p className="gb-password-hint">Use at least 8 characters. Clerk checks any additional password requirements.</p>
          {error && <p role="alert" className="gb-auth-error">{error}</p>}
          {notice && <p role="status" className="gb-auth-notice">{notice}</p>}
          <button className="gb-primary-button" type="submit" disabled={busy || newPassword.length < 8 || confirmPassword.length < 8}>
            <span>{busy ? 'Updating password…' : 'Update password'}</span>
            <span aria-hidden="true">→</span>
          </button>
          <button className="gb-recovery-secondary" type="button" disabled={busy} onClick={openRecovery}>
            Forgot your current password? Get a recovery email
          </button>
        </form>
      </div>
    </AuthFrame>
  );
}

type SignUpStage = 'details' | 'verify' | 'finishing' | 'profile-error' | 'created';

export function ClerkSignUpForm() {
  const [, setLocation] = useLocation();
  const { signUp, fetchStatus } = useSignUp();
  const updateProfile = useUpdateBankProfile();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerIdCopied, setCustomerIdCopied] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [stage, setStage] = useState<SignUpStage>('details');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const busy = fetchStatus === 'fetching' || updateProfile.isPending || stage === 'finishing';
  const names = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = names[0] ?? '';
  const lastName = names.slice(1).join(' ');

  const saveBankProfile = async () => {
    setError('');
    setNotice('');
    try {
      const savedProfile = await updateProfile.mutateAsync({
        data: {
          firstName,
          lastName,
          phone: phone.trim(),
          country: country.trim(),
          dateOfBirth,
          acceptedTerms: true,
        },
      });
      setCustomerId(savedProfile.customerId);
      setStage('created');
    } catch {
      setStage('profile-error');
      setError('Your sign-in is active, but your Globus profile could not be saved. Retry to finish setting up the account.');
    }
  };

  const finishSignUp = async () => {
    setStage('finishing');
    setError('');
    const result = await signUp.finalize({ navigate: () => undefined });
    if (result.error) {
      setStage('verify');
      setError(result.error.message || 'Your account could not be activated. Please try again.');
      return;
    }
    await saveBankProfile();
  };

  const startSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (names.length === 0 || !phone.trim() || !country.trim() || !dateOfBirth || !email.trim() || !password) {
      setError('Complete each required field before continuing.');
      return;
    }
    if (!acceptedTerms) {
      setError('Accept the Globus account terms to continue.');
      return;
    }

    const created = await signUp.password({
      emailAddress: email.trim(),
      password,
    });
    if (created.error) {
      setError(created.error.message || 'Your account could not be created. Check your details and try again.');
      return;
    }

    if (signUp.status === 'complete') {
      await finishSignUp();
      return;
    }

    const sent = await signUp.verifications.sendEmailCode();
    if (sent.error) {
      setError(sent.error.message || 'The email verification code could not be sent. Please try again.');
      return;
    }
    setStage('verify');
    setNotice(`Enter the verification code sent to ${email.trim()}.`);
  };

  const verifyEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const verified = await signUp.verifications.verifyEmailCode({ code: verificationCode.trim() });
    if (verified.error) {
      setError(verified.error.message || 'That code could not be verified. Check it and try again.');
      return;
    }
    if (signUp.status !== 'complete') {
      setError('Email verified, but the account still needs information. Please contact support.');
      return;
    }
    await finishSignUp();
  };

  const resendCode = async () => {
    setError('');
    setNotice('');
    const sent = await signUp.verifications.sendEmailCode();
    if (sent.error) {
      setError(sent.error.message || 'A new code could not be sent. Please try again.');
      return;
    }
    setNotice(`A new verification code was sent to ${email.trim()}.`);
  };

  const changeEmail = async () => {
    await signUp.reset();
    setVerificationCode('');
    setError('');
    setNotice('');
    setStage('details');
  };

  const copyCustomerId = async () => {
    try {
      await navigator.clipboard.writeText(customerId);
      setCustomerIdCopied(true);
      window.setTimeout(() => setCustomerIdCopied(false), 1800);
    } catch {
      setCustomerIdCopied(false);
    }
  };

  return (
    <div className="gb-signup-form-wrap">
      {stage === 'details' && (
        <>
          <div className="gb-form-heading">
            <span className="gb-step-label">GET STARTED <i /></span>
            <h1>Create your account</h1>
            <p>Set up your secure Globus member access.</p>
          </div>
          <form className="gb-auth-form gb-signup-form" onSubmit={startSignUp}>
            <div className="gb-field-grid">
              <div className="gb-field gb-field-wide">
                <label className="gb-field-label" htmlFor="gb-signup-name">Full name</label>
                <input id="gb-signup-name" className="gb-input" type="text" autoComplete="name" maxLength={160} placeholder="Your full name" value={fullName} onChange={event => setFullName(event.target.value)} required />
              </div>
              <div className="gb-field gb-field-wide">
                <label className="gb-field-label" htmlFor="gb-signup-phone">Phone number</label>
                <input id="gb-signup-phone" className="gb-input" type="tel" autoComplete="tel" maxLength={32} placeholder="+1 (555) 000-0000" value={phone} onChange={event => setPhone(event.target.value)} required />
              </div>
              <div className="gb-field">
                <label className="gb-field-label" htmlFor="gb-signup-country">Country</label>
                <input id="gb-signup-country" className="gb-input" type="text" autoComplete="country-name" maxLength={80} placeholder="Country or region" value={country} onChange={event => setCountry(event.target.value)} required />
              </div>
              <div className="gb-field">
                <label className="gb-field-label" htmlFor="gb-signup-dob">Date of birth</label>
                <input id="gb-signup-dob" className="gb-input" type="date" autoComplete="bday" max={new Date().toISOString().slice(0, 10)} value={dateOfBirth} onChange={event => setDateOfBirth(event.target.value)} required />
              </div>
              <div className="gb-field gb-field-wide">
                <label className="gb-field-label" htmlFor="gb-signup-email">Email address</label>
                <input id="gb-signup-email" className="gb-input" type="email" autoComplete="email" maxLength={254} placeholder="name@example.com" value={email} onChange={event => setEmail(event.target.value)} required />
              </div>
              <div className="gb-field gb-field-wide">
                <label className="gb-field-label" htmlFor="gb-signup-password">Password</label>
                <input id="gb-signup-password" className="gb-input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required />
              </div>
            </div>
            <p className="gb-password-hint">Use at least 8 characters. Additional security rules are checked securely by Clerk.</p>

            <label className="gb-terms-check">
              <input type="checkbox" checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)} required />
              <span>
                I confirm my profile details are accurate and accept the Globus{' '}
                account terms.
              </span>
            </label>

            {error && <p role="alert" className="gb-auth-error">{error}</p>}
            <button className="gb-primary-button" type="submit" disabled={busy || !acceptedTerms}>
              <span>{busy ? 'Creating your account…' : 'Create account'}</span>
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <p className="gb-switch-copy gb-signup-switch">Already have an account? <Link href="/sign-in">Sign in <span aria-hidden="true">→</span></Link></p>
        </>
      )}

      {stage === 'verify' && (
        <>
          <div className="gb-form-heading">
            <span className="gb-step-label">SECURE YOUR ACCOUNT <i /></span>
            <h1>Check your email</h1>
            <p>Enter the code we sent to <strong>{email}</strong> to verify your address.</p>
          </div>
          <form className="gb-auth-form" onSubmit={verifyEmail}>
            <label className="gb-field-label" htmlFor="gb-verification-code">Email verification code</label>
            <input id="gb-verification-code" className="gb-input gb-code-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={12} value={verificationCode} onChange={event => setVerificationCode(event.target.value)} required />
            {error && <p role="alert" className="gb-auth-error">{error}</p>}
            {notice && <p role="status" className="gb-auth-notice">{notice}</p>}
            <button className="gb-primary-button" type="submit" disabled={busy || verificationCode.trim().length < 4}>
              <span>{busy ? 'Verifying…' : 'Verify email'}</span>
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <div className="gb-verification-actions">
            <button type="button" onClick={resendCode} disabled={busy}>Resend code</button>
            <button type="button" onClick={changeEmail} disabled={busy}>Use a different email</button>
          </div>
        </>
      )}

      {stage === 'finishing' && (
        <div className="gb-form-heading" role="status" aria-live="polite">
          <span className="gb-step-label">ACCOUNT SETUP <i /></span>
          <h1>Finishing your account</h1>
          <p>Saving your profile securely. Please keep this page open.</p>
        </div>
      )}

      {stage === 'profile-error' && (
        <div className="gb-form-heading">
          <span className="gb-step-label">ACCOUNT SETUP <i /></span>
          <h1>Finish your profile</h1>
          <p>Your email is verified. Retry the profile save to continue into Globus.</p>
          {error && <p role="alert" className="gb-auth-error">{error}</p>}
          <button type="button" className="gb-primary-button" onClick={saveBankProfile} disabled={updateProfile.isPending}>
            <span>{updateProfile.isPending ? 'Saving profile…' : 'Retry profile save'}</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}

      {stage === 'created' && (
        <div className="gb-form-heading gb-customer-id-confirmation">
          <span className="gb-step-label">ACCOUNT READY <i /></span>
          <h1>Your Customer ID</h1>
          <p>Save this unique ID. You’ll use it with your password whenever you sign in.</p>
          <div className="gb-customer-id-card">
            <span>GLOBUS CUSTOMER ID</span>
            <strong>{customerId}</strong>
          </div>
          <button type="button" className="gb-secondary-button" onClick={copyCustomerId}>
            {customerIdCopied ? 'Copied' : 'Copy Customer ID'}
          </button>
          <button type="button" className="gb-primary-button" onClick={() => setLocation('/dashboard')}>
            <span>Continue to account</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}

      {notice && stage === 'details' && <p role="status" className="gb-auth-notice">{notice}</p>}
    </div>
  );
}
