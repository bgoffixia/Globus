import { useEffect, useState, type FormEvent } from "react";

const apiOrigin = (import.meta.env.VITE_BETTER_AUTH_BASE_URL as string | undefined)?.replace(/\/+$/, "");
const authRoot = apiOrigin ? `${apiOrigin}/api/better-auth` : "";
type Stage = "sign-in" | "sign-up" | "verify-email" | "enroll" | "mfa-challenge" | "signed-in";

async function request(path: string, body?: Record<string, unknown>) {
  if (!authRoot) throw new Error("VITE_BETTER_AUTH_BASE_URL is not configured for this staging frontend.");
  const response = await fetch(`${authRoot}/${path}`, {
    method: body ? "POST" : "GET",
    credentials: "include",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message ?? data?.error ?? data?.code ?? "Authentication request failed.";
    throw new Error(typeof message === "string" ? message : "Authentication request failed.");
  }
  return data;
}

async function checkProtectedAccess() {
  if (!apiOrigin) throw new Error("Staging API origin is not configured.");
  const response = await fetch(`${apiOrigin}/api/mfa-staging/access-check`, {
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 403 && data?.code === "MFA_ENROLLMENT_REQUIRED") return false;
  if (!response.ok) throw new Error(data?.error ?? "Could not verify the staging session.");
  return data?.allowed === true && data?.mfaEnabled === true;
}

export function BetterAuthMfaStagingApp() {
  const [stage, setStage] = useState<Stage>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("Isolated MFA evaluation — production authentication remains on Clerk.");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void request("get-session").then(async (session) => {
      if (!active || !session?.user) return;
      const allowed = await checkProtectedAccess();
      if (active) {
        setStage(allowed ? "signed-in" : "enroll");
        setMessage(allowed
          ? "MFA verified. Protected staging access is enabled."
          : "Your email/password session is active, but protected access is blocked until TOTP is enrolled.");
      }
    }).catch(() => {
      if (active && window.location.pathname.includes("auth-verified")) {
        setMessage("Email verified. Sign in to continue with MFA enrollment.");
      }
    });
    return () => { active = false; };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (stage === "sign-up") {
        await request("sign-up/email", {
          name: name.trim(),
          email: email.trim(),
          password,
          callbackURL: `${window.location.origin}/auth-verified`,
        });
        setStage("verify-email");
        setMessage("Check your inbox and follow the verification link. Sign-in stays blocked until the email is verified.");
      } else if (stage === "sign-in") {
        const result = await request("sign-in/email", { email: email.trim(), password });
        if (result?.twoFactorRedirect) {
          setStage("mfa-challenge");
          setMessage("First factor accepted. Enter your authenticator-app code to finish signing in.");
        } else {
          const allowed = await checkProtectedAccess();
          setStage(allowed ? "signed-in" : "enroll");
          setMessage(allowed
            ? "MFA verified. Protected staging access is enabled."
            : "Signed in, but protected access is denied until you complete TOTP enrollment.");
        }
      } else if (stage === "enroll") {
        const result = await request("two-factor/enable", {
          password,
          method: "totp",
          issuer: "Globus MFA Staging",
        });
        if (result?.method !== "totp" || !result?.totpURI) {
          throw new Error("The authenticator enrollment response was incomplete.");
        }
        setTotpUri(result.totpURI);
        setBackupCodes(Array.isArray(result.backupCodes) ? result.backupCodes : []);
        setStage("enroll");
        setMessage("Add the secret to an authenticator app, then enter its current six-digit code. Save the backup codes securely.");
        setPassword("");
      } else if (stage === "mfa-challenge") {
        await request("two-factor/verify-totp", { code: code.trim() });
        setStage("signed-in");
        setCode("");
        setMessage("Second factor verified. The staging session is now protected.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication request failed.");
    } finally {
      setBusy(false);
    }
  };

  const verifyEnrollment = async () => {
    setBusy(true);
    setError("");
    try {
      await request("two-factor/verify-totp", { code: code.trim() });
      const allowed = await checkProtectedAccess();
      if (!allowed) throw new Error("TOTP enrollment is not yet active for this session.");
      setStage("signed-in");
      setCode("");
      setMessage("TOTP successfully verified. Protected staging access is enabled.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "TOTP verification failed.");
    } finally {
      setBusy(false);
    }
  };

  const verifyBackupCode = async () => {
    setBusy(true);
    setError("");
    try {
      await request("two-factor/verify-backup-code", { code: code.trim() });
      setStage("signed-in");
      setCode("");
      setMessage("Backup code accepted. This code can no longer be reused.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Backup-code verification failed.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    setError("");
    try {
      await request("sign-out", {});
      setStage("sign-in");
      setPassword("");
      setCode("");
      setTotpUri("");
      setBackupCodes([]);
      setMessage("Signed out of the isolated Better Auth MFA staging environment.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign out failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <section className="mx-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">Globus · isolated staging</p>
        <h1 className="mt-3 text-2xl font-semibold">Better Auth MFA evaluation</h1>
        <p className="mt-2 text-sm text-slate-600">This environment uses a separate Better Auth instance and dedicated staging database. Production continues to use Clerk. Do not use real banking or customer data here.</p>
        <div className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">MFA is mandatory for protected staging access. Email verification, TOTP, and backup-code recovery are tested here; this is not a production cutover.</div>
        <p className="mt-4 text-sm text-slate-600" role="status">{message}</p>

        {stage === "signed-in" ? (
          <div className="mt-6 space-y-4">
            <p className="font-medium text-emerald-800">Protected staging session active · MFA verified</p>
            <button className="w-full rounded-lg bg-slate-900 px-4 py-3 text-white disabled:opacity-50" onClick={() => void signOut()} disabled={busy}>Sign out</button>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={submit}>
            {stage === "sign-up" && (
              <label className="block text-sm font-medium">Name
                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required />
              </label>
            )}
            {(stage === "sign-up" || stage === "sign-in") && (
              <label className="block text-sm font-medium">Email
                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </label>
            )}
            {(stage === "sign-up" || stage === "sign-in" || (stage === "enroll" && !totpUri)) && (
              <label className="block text-sm font-medium">Password
                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="password" autoComplete={stage === "sign-up" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} minLength={12} required />
              </label>
            )}
            {stage === "enroll" && totpUri && (
              <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                <p className="text-sm font-semibold">Authenticator setup</p>
                <p className="text-sm text-slate-600">In your authenticator app, add an account manually using this setup URI. Keep it private.</p>
                <textarea className="w-full rounded-lg border border-slate-300 p-2 text-xs" value={totpUri} readOnly rows={3} />
                {backupCodes.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold">One-time backup codes — save these now</p>
                    <ul className="mt-2 grid grid-cols-2 gap-2 font-mono text-sm">{backupCodes.map(item => <li key={item} className="rounded bg-slate-100 p-2">{item}</li>)}</ul>
                    <p className="mt-2 text-xs text-slate-500">They are shown only during enrollment. Store them offline; each code can be used once.</p>
                  </div>
                )}
              </div>
            )}
            {(stage === "mfa-challenge" || (stage === "enroll" && Boolean(totpUri))) && (
              <label className="block text-sm font-medium">Authenticator code
                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono tracking-widest" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} minLength={6} maxLength={12} required />
              </label>
            )}
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            {stage === "enroll" && totpUri ? (
              <button type="button" className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50" onClick={() => void verifyEnrollment()} disabled={busy || !code.trim()}>{busy ? "Please wait…" : "Verify authenticator and enable MFA"}</button>
            ) : (
              <button className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50" disabled={busy}>{busy ? "Please wait…" : stage === "sign-up" ? "Create staging account" : stage === "mfa-challenge" ? "Verify MFA code" : stage === "enroll" ? "Start authenticator setup" : "Sign in"}</button>
            )}
            {stage === "mfa-challenge" && (
              <button type="button" className="w-full text-sm text-sky-800 underline" onClick={() => void verifyBackupCode()} disabled={busy || !code.trim()}>Use a backup code instead</button>
            )}
          </form>
        )}

        {stage !== "signed-in" && (
          <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm">
            {stage === "sign-in" && <button className="text-sky-800 underline" onClick={() => { setStage("sign-up"); setError(""); }}>Create staging account</button>}
            {stage === "sign-up" && <button className="text-sky-800 underline" onClick={() => { setStage("sign-in"); setError(""); }}>Back to sign in</button>}
            {stage === "verify-email" && <button className="text-sky-800 underline" onClick={() => { setStage("sign-in"); setError(""); }}>Return to sign in</button>}
            {stage === "enroll" && !totpUri && <button className="text-sky-800 underline" onClick={() => { setStage("sign-in"); setError(""); }}>Return to sign in</button>}
          </div>
        )}
      </section>
    </main>
  );
}
