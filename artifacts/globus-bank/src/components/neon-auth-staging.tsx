import { useEffect, useState, type FormEvent } from 'react';

const authUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined;
type Stage = 'sign-in' | 'sign-up' | 'verify' | 'signed-in';

async function authRequest(path: string, body?: Record<string, string>) {
  if (!authUrl) throw new Error('Neon Auth staging URL is not configured.');
  const response = await fetch(`${authUrl.replace(/\/+$/, '')}/${path}`, {
    method: body ? 'POST' : 'GET',
    credentials: 'include',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message ?? data?.error ?? 'Authentication request failed.';
    throw new Error(typeof message === 'string' ? message : 'Authentication request failed.');
  }
  return data;
}

export function NeonAuthStagingApp() {
  const [stage, setStage] = useState<Stage>('sign-in');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('Staging only — production authentication remains on Clerk.');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void authRequest('get-session').then((session) => {
      if (active && session?.user) setStage('signed-in');
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (stage === 'sign-up') {
        await authRequest('sign-up/email', { name: name.trim(), email: email.trim(), password });
        setStage('verify');
        setMessage('A verification code has been sent to your email. Enter the newest code to verify this staging account.');
      } else if (stage === 'verify') {
        await authRequest('email-otp/verify-email', { email: email.trim(), otp: otp.trim() });
        setStage('sign-in');
        setOtp('');
        setMessage('Email verified. Sign in with your staging credentials.');
      } else if (stage === 'sign-in') {
        await authRequest('sign-in/email', { email: email.trim(), password });
        setStage('signed-in');
        setMessage('Signed in to the isolated Neon Auth staging environment.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication request failed.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    setError('');
    try {
      await authRequest('sign-out', {});
      setStage('sign-in');
      setPassword('');
      setMessage('Signed out of the Neon Auth staging environment.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign out failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">Globus · isolated staging</p>
        <h1 className="mt-3 text-2xl font-semibold">Neon Auth evaluation</h1>
        <p className="mt-2 text-sm text-slate-600">This test environment is separate from production. Clerk remains the production identity provider. Do not use real banking or customer data here.</p>
        <div className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Email verification is required. This staging flow does not provide MFA and must not be used for production access.</div>
        <p className="mt-4 text-sm text-slate-600" role="status">{message}</p>
        {stage === 'signed-in' ? (
          <div className="mt-6">
            <p className="font-medium">Staging session active</p>
            <button className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-3 text-white disabled:opacity-50" onClick={() => void signOut()} disabled={busy}>Sign out</button>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={submit}>
            {stage === 'sign-up' && (
              <label className="block text-sm font-medium">Name
                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required />
              </label>
            )}
            {stage !== 'verify' && (
              <label className="block text-sm font-medium">Email
                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </label>
            )}
            {stage === 'verify' ? (
              <label className="block text-sm font-medium">Email verification code
                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={e => setOtp(e.target.value)} required />
              </label>
            ) : (
              <label className="block text-sm font-medium">Password
                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="password" autoComplete={stage === 'sign-up' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} minLength={8} required />
              </label>
            )}
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            <button className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50" disabled={busy}>{busy ? 'Please wait…' : stage === 'verify' ? 'Verify email' : stage === 'sign-up' ? 'Create staging account' : 'Sign in'}</button>
          </form>
        )}
        {stage !== 'signed-in' && (
          <div className="mt-5 flex justify-center gap-4 text-sm">
            {stage === 'sign-in' && <button className="text-sky-800 underline" onClick={() => { setStage('sign-up'); setError(''); }}>Create staging account</button>}
            {stage === 'sign-up' && <button className="text-sky-800 underline" onClick={() => { setStage('sign-in'); setError(''); }}>Back to sign in</button>}
            {stage === 'verify' && <button className="text-sky-800 underline" onClick={() => { setStage('sign-in'); setError(''); }}>Cancel verification</button>}
          </div>
        )}
      </section>
    </main>
  );
}
