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
        <p>Access your accounts, follow your balances, and move money with a little more clarity.</p>
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
            <p>Sign in to access your Globus accounts.</p>
          </div>
          <form className="gb-auth-form" onSubmit={(event) => event.preventDefault()}>
            <label className="gb-field-label" htmlFor="gb-signin-email">Email address</label>
            <input className="gb-input" id="gb-signin-email" type="email" autoComplete="email" placeholder="name@example.com" />
            <button className="gb-primary-button" type="submit">Continue with email <span aria-hidden="true">→</span></button>
          </form>
          <div className="gb-divider"><span>or</span></div>
          <button className="gb-google-button" type="button">
            <span className="gb-google-g" aria-hidden="true">G</span>
            Continue with Google
          </button>
          <p className="gb-switch-copy">New to Globus? <a href="/__mockup/preview/globus-auth/BankGradeSignUp">Create an account <span aria-hidden="true">→</span></a></p>
          <div className="gb-form-footer"><span>Globus Bank</span><span>Member account access</span></div>
        </div>
      </section>
    </main>
  );
}
