// Auth screens — A1 Sign In, A2 OTP, A3 Invite

const AuthShell = ({ children }) => (
  <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1fr 1fr", background: "#fff" }}>
    {/* Left brand panel */}
    <div style={{
      background: "linear-gradient(135deg, #0C2340 0%, #0E2B52 50%, #0891B2 130%)",
      padding: "48px 56px", display: "flex", flexDirection: "column", justifyContent: "space-between",
      color: "#fff", position: "relative", overflow: "hidden",
    }}>
      {/* Decorative grid */}
      <svg style={{ position: "absolute", inset: 0, opacity: 0.08 }} width="100%" height="100%">
        <defs>
          <pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#fff" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)"/>
      </svg>
      {/* Glow */}
      <div style={{ position: "absolute", top: -100, right: -120, width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle, rgba(6,182,212,0.5), transparent 65%)", filter: "blur(20px)" }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        <Icons.Wordmark dark accent="#22D3EE" size={36} sub="Translation, evolved" />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 460 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, opacity: 0.7, textTransform: "uppercase", marginBottom: 18 }}>
          For translators, by translators
        </div>
        <h1 style={{ fontSize: 44, lineHeight: 1.1, margin: 0, fontWeight: 700, letterSpacing: -1.2 }}>
          Where translators do their best work.
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.55, marginTop: 18, opacity: 0.85, fontWeight: 400 }}>
          Translation memory, terminology, machine translation, and QA — all in one fast, focused editor.
        </p>

        {/* Mini stats */}
        <div style={{ display: "flex", gap: 32, marginTop: 36 }}>
          {[
            { v: "4.2M", l: "TM units" },
            { v: "98%", l: "uptime" },
            { v: "<80ms", l: "segment switch" },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.4 }}>{s.v}</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 1, fontSize: 12, opacity: 0.6 }}>
        © 2026 Cethos. Translation, evolved.
      </div>
    </div>

    {/* Right form */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>{children}</div>
    </div>
  </div>
);

const A1_SignIn = ({ onSignIn, goOTP }) => {
  const [show, setShow] = React.useState(false);
  return (
    <AuthShell>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: "var(--navy)", margin: 0, letterSpacing: -0.6 }}>Sign in</h2>
        <p style={{ margin: "6px 0 0", color: "var(--slate-500)", fontSize: 14 }}>Welcome back. Pick up where you left off.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Input label="Email" type="email" placeholder="you@company.com" defaultValue="maria.chen@acme.com" required icon={<Icons.Mail size={15}/>} />
        <Input label="Password" type={show ? "text" : "password"} placeholder="••••••••••" defaultValue="hunter2hunter2" required
          icon={<Icons.Lock size={15}/>}
          iconRight={<button onClick={() => setShow(s => !s)} style={{ color: "var(--slate-500)" }}>{show ? <Icons.EyeOff size={15}/> : <Icons.Eye size={15}/>}</button>}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: -4 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate-600)", cursor: "pointer" }}>
            <input type="checkbox" defaultChecked style={{ accentColor: "var(--teal)" }} /> Remember me
          </label>
          <a href="#" style={{ fontSize: 13, color: "var(--teal)", fontWeight: 600 }}>Forgot password?</a>
        </div>

        <Button full size="lg" onClick={() => goOTP()}>Sign in</Button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--slate-400)", fontSize: 12 }}>
          <span style={{ flex: 1, height: 1, background: "var(--border)" }} /> OR <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        <Button full variant="outline" size="lg" icon={<Icons.ArrowUpRight size={16}/>}>Open from vendor portal</Button>
        <p style={{ fontSize: 12.5, color: "var(--slate-500)", textAlign: "center", margin: 0, lineHeight: 1.5 }}>
          Translators usually arrive here via a job link from the vendor portal.
        </p>
      </div>

      <div style={{ marginTop: 36, display: "flex", justifyContent: "center", gap: 18, fontSize: 12, color: "var(--slate-400)" }}>
        <a href="#" style={{ color: "inherit" }}>Terms</a>
        <a href="#" style={{ color: "inherit" }}>Privacy</a>
        <a href="#" style={{ color: "inherit" }}>Status</a>
      </div>
    </AuthShell>
  );
};

const A2_OTP = ({ onVerify, onBack, error: showError }) => {
  const [code, setCode] = React.useState(["", "", "", "", "", ""]);
  const [seconds, setSeconds] = React.useState(42);
  const refs = React.useRef([]);
  React.useEffect(() => {
    if (seconds > 0) {
      const t = setTimeout(() => setSeconds(s => s - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [seconds]);
  const handle = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...code]; next[i] = v; setCode(next);
    if (v && i < 5) refs.current[i+1]?.focus();
  };
  return (
    <AuthShell>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--bg-blue)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--teal)", marginBottom: 18 }}>
        <Icons.Shield size={26}/>
      </div>
      <h2 style={{ fontSize: 26, fontWeight: 700, color: "var(--navy)", margin: 0, letterSpacing: -0.6 }}>Verify it's you</h2>
      <p style={{ margin: "6px 0 24px", color: "var(--slate-500)", fontSize: 14, lineHeight: 1.55 }}>
        We sent a 6-digit code to <span style={{ color: "var(--navy)", fontWeight: 600 }}>m***@acme.com</span>. Expires in <span style={{ color: "var(--navy)", fontWeight: 600 }}>10 minutes</span>.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {code.map((c, i) => (
          <input key={i} ref={el => refs.current[i] = el} value={c} onChange={(e) => handle(i, e.target.value)}
            maxLength={1} inputMode="numeric"
            style={{
              flex: 1, height: 56, textAlign: "center", fontSize: 22, fontWeight: 700,
              fontFamily: "JetBrains Mono", color: "var(--navy)",
              border: `1.5px solid ${showError ? "var(--rose-500)" : c ? "var(--teal)" : "var(--slate-200)"}`,
              borderRadius: 10, outline: "none", background: showError ? "var(--rose-50)" : "#fff",
            }} />
        ))}
      </div>

      {showError && (
        <div style={{ background: "var(--rose-50)", border: "1px solid var(--rose-100)", color: "var(--rose-600)", padding: "10px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Icons.AlertCircle size={15}/> Incorrect code. 2 attempts left.
        </div>
      )}

      <div style={{ fontSize: 13, color: "var(--slate-500)", marginBottom: 20 }}>
        {seconds > 0 ? <>Resend in <span className="mono" style={{ color: "var(--navy)", fontWeight: 600 }}>0:{String(seconds).padStart(2, "0")}</span></> : <a href="#" style={{ color: "var(--teal)", fontWeight: 600 }} onClick={(e) => { e.preventDefault(); setSeconds(42); }}>Resend code</a>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Button full size="lg" onClick={onVerify}>Verify</Button>
        <Button full variant="ghost" size="md" onClick={onBack} icon={<Icons.ArrowLeft size={14}/>}>Back to sign in</Button>
      </div>
    </AuthShell>
  );
};

const A3_Invite = ({ onAccept }) => {
  const [pw, setPw] = React.useState("Acme2026!");
  const checks = [
    { label: "12+ characters", ok: pw.length >= 12 },
    { label: "A number", ok: /\d/.test(pw) },
    { label: "A symbol", ok: /[^a-z0-9]/i.test(pw) },
    { label: "An uppercase letter", ok: /[A-Z]/.test(pw) },
  ];
  const score = checks.filter(c => c.ok).length;
  const scoreColor = ["var(--rose-500)", "var(--rose-500)", "var(--amber-500)", "var(--lime-500)", "var(--emerald-500)"][score];

  return (
    <AuthShell>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <Avatar name="Sarah Park" size={48} />
        <div style={{ fontSize: 13, color: "var(--slate-500)" }}>
          <div style={{ color: "var(--navy)", fontWeight: 600 }}>Sarah Park</div>
          <div>invited you to TranslationAI as a Project Manager</div>
        </div>
      </div>

      <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--navy)", margin: 0, letterSpacing: -0.5 }}>Create your account</h2>
      <p style={{ margin: "6px 0 22px", color: "var(--slate-500)", fontSize: 14 }}>You'll be able to manage jobs and translators for Acme.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input label="Email" disabled defaultValue="alex.morgan@acme.com" icon={<Icons.Mail size={15}/>} />
        <Input label="Full name" placeholder="Alex Morgan" defaultValue="Alex Morgan" required />
        <div>
          <Input label="Password" type="password" placeholder="••••••••••" required value={pw} onChange={e => setPw(e.target.value)} />
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i < score ? scoreColor : "var(--slate-100)" }} />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 10 }}>
            {checks.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: c.ok ? "var(--emerald-600)" : "var(--slate-500)" }}>
                {c.ok ? <Icons.Check size={13} stroke={3}/> : <span style={{ width: 13, height: 13, borderRadius: 999, border: "1.5px solid var(--slate-300)" }}/>}
                {c.label}
              </div>
            ))}
          </div>
        </div>
        <Input label="Confirm password" type="password" placeholder="••••••••••" required defaultValue="Acme2026!"/>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--slate-600)", lineHeight: 1.5 }}>
          <input type="checkbox" defaultChecked style={{ marginTop: 3, accentColor: "var(--teal)" }}/>
          I agree to the <a href="#" style={{ color: "var(--teal)" }}>Terms of Service</a> and <a href="#" style={{ color: "var(--teal)" }}>Privacy Policy</a>.
        </label>
        <Button full size="lg" onClick={onAccept}>Create account</Button>
        <p style={{ fontSize: 12.5, color: "var(--slate-500)", textAlign: "center", margin: 0 }}>
          We'll send a verification code to your email next.
        </p>
      </div>
    </AuthShell>
  );
};

Object.assign(window, { A1_SignIn, A2_OTP, A3_Invite });
