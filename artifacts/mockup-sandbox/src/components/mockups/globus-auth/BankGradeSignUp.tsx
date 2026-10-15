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
        <h2>Begin with<br />a better view.</h2>
        <p>Bring your accounts into focus and get started with your Globus member account.</p>
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

export function BankGradeSignUp() {
  return (
    <main className="gb-auth-shell">
      <BrandPanel />
      <section className="gb-form-side">
        <div className="gb-mobile-brand">
          <img src="/__mockup/images/globus-mark.png" alt="" />
          <img src="/__mockup/images/globus-wordmark.png" alt="Globus Bank" />
        </div>
        <div className="gb-auth-content gb-signup-content">
          <div className="gb-form-heading">
            <span className="gb-step-label">GET STARTED <i /></span>
            <h1>Create your account</h1>
            <p>Set up your Globus member access.</p>
          </div>
          <button className="gb-google-button gb-signup-google" type="button">
            <span className="gb-google-g" aria-hidden="true">G</span>
            Continue with Google
          </button>
          <div className="gb-divider"><span>or use your email</span></div>
          <form className="gb-auth-form gb-signup-form" onSubmit={(event) => event.preventDefault()}>
            <label className="gb-field-label" htmlFor="gb-signup-email">Email address</label>
            <input className="gb-input" id="gb-signup-email" type="email" autoComplete="email" placeholder="name@example.com" />
            <label className="gb-field-label gb-password-label" htmlFor="gb-signup-password">Password</label>
            <input className="gb-input" id="gb-signup-password" type="password" autoComplete="new-password" placeholder="Create a password" />
            <button className="gb-primary-button" type="submit">Create account <span aria-hidden="true">→</span></button>
          </form>
          <p className="gb-switch-copy gb-signup-switch">Already have an account? <a href="/__mockup/preview/globus-auth/BankGradeSignIn">Sign in <span aria-hidden="true">→</span></a></p>
          <div className="gb-form-footer"><span>Globus Bank</span><span>Member account access</span></div>
        </div>
      </section>
    </main>
  );
}
