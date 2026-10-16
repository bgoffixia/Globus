import './_group.css';

function BrandPanel() {
  return (
    <aside className="gb-brand-panel">
      <div className="gb-brand-lockup">
        <img src="/__mockup/images/globus-mark.png" alt="" className="gb-mark" />
        <img src="/__mockup/images/globus-wordmark.png" alt="Globus Bank" className="gb-wordmark" />
      </div>
      <div className="gb-brand-copy">
        <span className="gb-eyebrow">A clearer view of your money</span>
        <h2>Your world.<br />In one place.</h2>
          <p>Access your accounts, follow your balances, and move money with clarity.</p>
      </div>
      <div className="gb-world-art" aria-hidden="true">
        <span className="gb-orbit gb-orbit-one" />
        <span className="gb-orbit gb-orbit-two" />
        <span className="gb-orbit-dot" />
        <span className="gb-world-label">GLOBAL LEDGER</span>
      </div>
      <div className="gb-panel-foot"><span>GLOBUS BANK</span><span>YOUR WORLD. OUR PRIORITY.</span></div>
    </aside>
  );
}

export function BankGradeSignIn() {
  return (
    <main className="gb-auth-shell">
      <BrandPanel />
      <section className="gb-form-side">
        <div className="gb-mobile-brand">
          <img src="/__mockup/images/globus-mark.png" alt="" />
          <img src="/__mockup/images/globus-wordmark.png" alt="Globus Bank" />
        </div>
        <div className="gb-auth-content">
          <div className="gb-form-heading">
            <span className="gb-step-label">MEMBER ACCESS <i /></span>
            <h1>Welcome back</h1>
            <p>Use your Globus Customer ID to access your account.</p>
          </div>
          <form className="gb-auth-form">
            <label className="gb-field-label" htmlFor="gb-customer-id">Customer ID</label>
            <input className="gb-input gb-customer-id-input" id="gb-customer-id" type="text" autoComplete="username" autoCapitalize="characters" inputMode="text" minLength={7} maxLength={7} pattern="[A-Za-z0-9]{7}" placeholder="7-character ID" required />
            <label className="gb-field-label gb-signin-spaced-label" htmlFor="gb-customer-password">Password</label>
            <input className="gb-input" id="gb-customer-password" type="password" autoComplete="current-password" required />
            <button className="gb-primary-button" type="button">Sign in <span aria-hidden="true">→</span></button>
          </form>
          <p className="gb-switch-copy gb-recovery-link"><a href="/__mockup/preview/globus-auth/BankGradeSignIn">Forgot your Customer ID or password?</a></p>
          <p className="gb-switch-copy">New to Globus? <a href="/__mockup/preview/globus-auth/BankGradeSignUp">Create an account <span aria-hidden="true">→</span></a></p>
          <p className="gb-preview-note">Preview only · no information is submitted</p>
          <div className="gb-form-footer"><span>Globus Bank</span><span>Member account access</span></div>
        </div>
      </section>
    </main>
  );
}
