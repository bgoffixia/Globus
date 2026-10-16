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
          <p>Create your member account and bring your Globus activity into focus.</p>
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
            <p>Set up your secure Globus member access.</p>
          </div>
          <form className="gb-auth-form gb-signup-form">
            <label className="gb-field-label" htmlFor="gb-signup-name">Full name</label>
            <input className="gb-input" id="gb-signup-name" type="text" autoComplete="name" placeholder="Your full name" />
            <label className="gb-field-label gb-signup-spaced-label" htmlFor="gb-signup-phone">Phone number</label>
            <input className="gb-input" id="gb-signup-phone" type="tel" autoComplete="tel" placeholder="+1 (555) 000-0000" />
            <label className="gb-field-label gb-signup-spaced-label" htmlFor="gb-signup-country">Country</label>
            <input className="gb-input" id="gb-signup-country" type="text" autoComplete="country-name" placeholder="Country or region" />
            <label className="gb-field-label gb-signup-spaced-label" htmlFor="gb-signup-dob">Date of birth</label>
            <input className="gb-input" id="gb-signup-dob" type="date" autoComplete="bday" />
            <label className="gb-field-label gb-signup-spaced-label" htmlFor="gb-signup-email">Email address</label>
            <input className="gb-input" id="gb-signup-email" type="email" autoComplete="email" placeholder="name@example.com" />
            <label className="gb-field-label gb-signup-spaced-label" htmlFor="gb-signup-password">Password</label>
            <input className="gb-input" id="gb-signup-password" type="password" autoComplete="new-password" minLength={8} placeholder="Create a password" />
            <p className="gb-password-hint">Use at least 8 characters. Additional security rules are checked securely by Clerk.</p>
            <label className="gb-terms-check">
              <input type="checkbox" required />
              <span>I confirm my profile details are accurate and accept the Globus <a href="/__mockup/preview/globus-auth/BankGradeSignUp">account terms</a> and <a href="/__mockup/preview/globus-auth/BankGradeSignUp">privacy notice</a>.</span>
            </label>
            <button className="gb-primary-button" type="button">Create account <span aria-hidden="true">→</span></button>
          </form>
          <p className="gb-switch-copy gb-signup-switch">Already have an account? <a href="/__mockup/preview/globus-auth/BankGradeSignIn">Sign in <span aria-hidden="true">→</span></a></p>
          <p className="gb-preview-note">Preview only · no information is submitted</p>
          <div className="gb-form-footer"><span>Globus Bank</span><span>Member account access</span></div>
        </div>
      </section>
    </main>
  );
}
