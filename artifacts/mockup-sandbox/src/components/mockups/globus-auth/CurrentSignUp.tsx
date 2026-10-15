import './_group.css';

function CurrentSignUpForm() {
  return (
    <section className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-[#e0e8ed] bg-white px-10 pb-7 pt-5 shadow-[0_24px_70px_rgba(20,47,81,.12)]">
      <div className="mb-6 flex justify-center">
        <img
          src="/__mockup/images/globus-wordmark.png"
          alt="Globus Bank"
          className="h-auto w-[132px] object-contain"
        />
      </div>
      <div className="mb-7 text-center">
        <h1 className="text-[17px] font-semibold tracking-tight text-[#18324f]">Set up your account</h1>
        <p className="mt-1 text-[13px] text-[#718196]">Create a secure account to explore Globus</p>
      </div>
      <button className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-[#dfe6ec] bg-white text-[13px] font-semibold text-[#304761] shadow-sm">
        <span className="text-[17px] font-bold text-[#4285f4]">G</span>
        Continue with Google
      </button>
      <div className="my-5 flex items-center gap-3 text-[12px] text-[#8290a0]">
        <span className="h-px flex-1 bg-[#e4e9ed]" />
        or
        <span className="h-px flex-1 bg-[#e4e9ed]" />
      </div>
      <label className="mb-2 block text-[13px] font-semibold text-[#435971]" htmlFor="current-signup-email">
        Email address
      </label>
      <input
        id="current-signup-email"
        className="mb-4 h-11 w-full rounded-lg border border-[#dfe6ec] bg-[#fbfcfd] px-3 text-[13px] text-[#30465f] outline-none"
        placeholder="Enter your email address"
      />
      <label className="mb-2 block text-[13px] font-semibold text-[#435971]" htmlFor="current-signup-password">
        Password
      </label>
      <input
        id="current-signup-password"
        type="password"
        className="mb-5 h-11 w-full rounded-lg border border-[#dfe6ec] bg-[#fbfcfd] px-3 text-[13px] text-[#30465f] outline-none"
        placeholder="Create a password"
      />
      <button className="h-11 w-full rounded-full bg-[#173b62] text-[13px] font-semibold text-white shadow-sm">
        Continue&nbsp;&nbsp; ›
      </button>
      <p className="mt-7 text-center text-[12px] text-[#718196]">
        Already have an account? <span className="font-semibold text-[#357b83]">Sign in</span>
      </p>
      <p className="mt-7 text-center text-[11px] text-[#d87942]">Development mode</p>
    </section>
  );
}

export function CurrentSignUp() {
  return (
    <main className="globus-auth-preview globus-current-grid flex min-h-screen items-center justify-center px-4 py-10">
      <div className="flex w-full flex-col items-center">
        <p className="mb-5 text-center text-[11px] text-[#748498]">
          A clearer place to explore global money tools
        </p>
        <CurrentSignUpForm />
      </div>
    </main>
  );
}
