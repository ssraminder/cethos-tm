// PM screens PM1-PM6

const PM_NAV = [
  { id: "dashboard", label: "Dashboard", icon: <Icons.Home size={16}/> },
  { id: "jobs", label: "Jobs", icon: <Icons.Briefcase size={16}/>, count: 18 },
  { id: "create", label: "Create Job", icon: <Icons.Plus size={16}/> },
  { id: "translators", label: "Translators", icon: <Icons.Users size={16}/> },
  { id: "concordance", label: "Concordance", icon: <Icons.Search size={16}/> },
  { id: "reports", label: "Reports", icon: <Icons.BarChart size={16}/> },
];

const PMLayout = ({ active, onNav, breadcrumb, actions, children, user, onSearchOpen, onNotifOpen, onLogout }) => (
  <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-app)" }}>
    <Sidebar items={PM_NAV} active={active} onChange={onNav} role="Project Manager" user={user} onLogout={onLogout}/>
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <TopBar breadcrumb={breadcrumb} actions={actions} user={user} onSearchOpen={onSearchOpen} onNotifOpen={onNotifOpen}/>
      <main style={{ flex: 1, padding: "28px 32px", maxWidth: 1400, width: "100%" }}>{children}</main>
    </div>
  </div>
);

// PM1
const PM1_Dashboard = (props) => (
  <PMLayout {...props} active="dashboard" breadcrumb={["Dashboard"]}>
    <PageHeader title="Welcome back, Sarah" subtitle="18 active jobs across 6 clients · 4 awaiting your QA review."/>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
      <Stat label="Active jobs" value="18" sub="across 6 clients" icon={<Icons.Briefcase size={16}/>}/>
      <Stat label="Awaiting QA review" value="4" sub="oldest: 8 hr" icon={<Icons.Shield size={16}/>}/>
      <Stat label="Overdue" value="1" color="rose" sub="J-2026-04-360" icon={<Icons.AlertCircle size={16}/>}/>
      <Stat label="Avg leverage" value="62%" sub="last 30 days" trend={3} icon={<Icons.TrendingUp size={16}/>}/>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 16 }}>
      <Section title="Job pipeline">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {[
            { l: "Received", v: 6, c: "var(--slate-400)" },
            { l: "In progress", v: 9, c: "var(--teal)" },
            { l: "QA", v: 4, c: "var(--amber-500)" },
            { l: "Submitted", v: 12, c: "var(--emerald-500)" },
          ].map((s, i) => (
            <div key={i} style={{ position: "relative" }}>
              <div style={{ background: s.c, color: "#fff", padding: "20px 16px", borderRadius: 8, clipPath: i < 3 ? "polygon(0 0, 92% 0, 100% 50%, 92% 100%, 0 100%)" : "none" }}>
                <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.9, textTransform: "uppercase", letterSpacing: 0.4 }}>{s.l}</div>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{s.v}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="QA issues by job">
        <BarList items={[
          { label: "J-2026-04-375 · Hooli", value: 12, display: "12", color: "var(--rose-500)" },
          { label: "J-2026-04-381 · Acme Q2", value: 4, display: "4", color: "var(--amber-500)" },
          { label: "J-2026-04-360 · Soylent", value: 2, display: "2", color: "var(--amber-500)" },
          { label: "J-2026-04-376 · Initech", value: 1, display: "1", color: "var(--amber-500)" },
        ]}/>
      </Section>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
      <Section title="Translator workload (this week)">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {TRANSLATORS.slice(0, 6).map((t, i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500, color: "var(--navy)" }}>
                  <Avatar name={t.name} size={22}/>{t.name}
                </span>
                <span style={{ fontSize: 12, color: t.capacity > 85 ? "var(--rose-500)" : "var(--slate-500)", fontWeight: 600 }} className="mono">{t.capacity}%</span>
              </div>
              <ProgressBar value={t.capacity} color={t.capacity > 85 ? "var(--rose-500)" : t.capacity > 60 ? "var(--amber-500)" : "var(--teal)"} height={8}/>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Recent activity">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { i: <Icons.Briefcase size={14}/>, c: "navy", t: "Job J-2026-04-381 ingested from TMS · Acme Q2", time: "12 min ago" },
            { i: <Icons.Send size={14}/>, c: "emerald", t: "Tomás submitted J-2026-04-379", time: "1 hr ago" },
            { i: <Icons.AlertTriangle size={14}/>, c: "amber", t: "QA threshold exceeded on J-2026-04-375", time: "2 hr ago" },
            { i: <Icons.Check size={14}/>, c: "emerald", t: "Wei Lin completed J-2026-04-372", time: "Yesterday" },
          ].map((x, i) => (
            <div key={i} style={{ display: "flex", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: x.c === "navy" ? "var(--bg-blue)" : `var(--${x.c}-50)`, color: x.c === "navy" ? "var(--navy)" : `var(--${x.c}-600)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{x.i}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "var(--navy)" }}>{x.t}</div>
                <div style={{ fontSize: 11.5, color: "var(--slate-500)", marginTop: 2 }}>{x.time}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  </PMLayout>
);

// PM2 — Jobs list & detail
const PM2_Jobs = (props) => {
  const [view, setView] = React.useState("list");
  if (view === "list") {
    return (
      <PMLayout {...props} active="jobs" breadcrumb={["Jobs"]}>
        <PageHeader title="Jobs" subtitle="All translation jobs in your workspace."
          actions={<>
            <Tabs variant="pills" tabs={[{id:"t",label:"Table"},{id:"k",label:"Kanban"}]} active="t" onChange={()=>{}}/>
            <Button icon={<Icons.Plus size={14}/>}>Create job</Button>
          </>}/>

        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: 12, borderBottom: "1px solid var(--border-soft)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Input full={false} placeholder="Job ref or project…" icon={<Icons.Search size={14}/>} style={{ width: 240 }}/>
            <Button variant="outline" size="sm">Source: All ▾</Button>
            <Button variant="outline" size="sm">Status: All ▾</Button>
            <Button variant="outline" size="sm">Pair: All ▾</Button>
            <Button variant="outline" size="sm" icon={<Icons.Calendar size={13}/>}>Deadline ▾</Button>
            <div style={{ flex: 1 }}/>
            <span style={{ fontSize: 12, color: "var(--slate-500)" }}>{JOBS.length} jobs</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--slate-50)" }}>
                {["Job ref","Source","Pair","Words","Progress","Leverage","QA","Status","Deadline","Translator",""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: 0.4, borderBottom: "1px solid var(--border)", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {JOBS.map((j, i) => (
                <tr key={i} onClick={() => setView("detail")} style={{ borderBottom: "1px solid var(--border-soft)", cursor: "pointer" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--slate-50)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = ""}>
                  <td className="mono" style={{ padding: "12px 14px", color: "var(--navy)", fontWeight: 600 }}>{j.ref}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <Pill color={j.source === "TMS" ? "teal" : "slate"} size="sm" icon={j.source === "TMS" ? <Icons.Link size={10}/> : <Icons.Edit size={10}/>}>{j.source} · {j.project}</Pill>
                  </td>
                  <td style={{ padding: "12px 14px" }}><FlagPair from={j.pair[0]} to={j.pair[1]}/></td>
                  <td className="mono" style={{ padding: "12px 14px", color: "var(--slate-700)" }}>{j.words.toLocaleString()}</td>
                  <td style={{ padding: "12px 14px", minWidth: 110 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <ProgressBar value={j.progress} color={j.progress === 100 ? "var(--emerald-500)" : "var(--teal)"} height={6}/>
                      <span style={{ fontSize: 11, color: "var(--slate-500)", minWidth: 30, textAlign: "right" }} className="mono">{j.progress}%</span>
                    </div>
                  </td>
                  <td className="mono" style={{ padding: "12px 14px", color: "var(--slate-700)" }}>{j.leverage}%</td>
                  <td style={{ padding: "12px 14px" }}>
                    {j.qa > 0 ? <Pill color={j.qa > 5 ? "rose" : "amber"} size="sm">{j.qa}</Pill> : <span style={{color:"var(--slate-300)"}}>—</span>}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <Pill color={j.status === "Submitted" || j.status === "Closed" ? "emerald" : j.status === "QA" ? "amber" : j.status === "Draft" ? "slate" : "teal"} size="sm">{j.status}</Pill>
                  </td>
                  <td style={{ padding: "12px 14px", color: j.deadline.includes("ago") ? "var(--rose-500)" : "var(--slate-600)", fontSize: 12 }}>{j.deadline}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Avatar name={j.translator} size={20}/>
                      <span style={{ fontSize: 12, color: "var(--slate-700)" }}>{j.translator.split(" ")[0]}</span>
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}><button style={{ color: "var(--slate-400)", padding: 4 }}><Icons.MoreH size={14}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PMLayout>
    );
  }

  // Detail
  const [tab, setTab] = React.useState("overview");
  return (
    <PMLayout {...props} active="jobs" breadcrumb={[<a key="b" onClick={() => setView("list")} style={{cursor:"pointer"}}>Jobs</a>, "J-2026-04-381"]}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 className="mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)", margin: 0, letterSpacing: -0.4 }}>J-2026-04-381</h1>
            <Pill color="teal" size="sm" icon={<Icons.Link size={10}/>}>TMS · Acme Q2</Pill>
            <FlagPair from="EN" to="FR" size={18}/>
            <Pill color="teal" size="sm">In progress</Pill>
            <span style={{ fontSize: 13, color: "var(--slate-500)" }}>· Deadline <b style={{color:"var(--navy)"}}>in 2d 4h</b></span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="outline" size="sm" icon={<Icons.Eye size={13}/>}>Open in editor</Button>
          <Button variant="outline" size="sm" icon={<Icons.Refresh size={13}/>}>Reassign</Button>
          <Button variant="ghost" size="sm" style={{color:"var(--rose-500)"}}>Force complete ▾</Button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16 }}>
        {[
          { l: "Total segments", v: "482" },
          { l: "Translated", v: "312" },
          { l: "Confirmed", v: "268" },
          { l: "QA issues", v: "4", c: "amber" },
          { l: "TM leverage", v: "64%" },
          { l: "MT used", v: "18%" },
        ].map((s, i) => (
          <div key={i} style={{ borderRight: i < 5 ? "1px solid var(--border-soft)" : "" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: 0.4 }}>{s.l}</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: s.c === "amber" ? "var(--amber-600)" : "var(--navy)", marginTop: 2 }}>{s.v}</div>
          </div>
        ))}
      </div>

      <Tabs tabs={["overview","segments","resources","comments","activity","settings"].map(t => ({id:t,label:t[0].toUpperCase()+t.slice(1)}))} active={tab} onChange={setTab} style={{marginBottom: 16}}/>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        <Section title="Progress timeline">
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "10px 0" }}>
            {["Created","Assigned","Started","50%","75%","Submitted"].map((s, i) => (
              <React.Fragment key={s}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 999, background: i < 4 ? "var(--teal)" : "var(--slate-200)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {i < 4 ? <Icons.Check size={12} stroke={3}/> : <span className="mono" style={{fontSize:10,fontWeight:700,color:"var(--slate-500)"}}>{i+1}</span>}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: i < 4 ? "var(--navy)" : "var(--slate-400)", textAlign: "center" }}>{s}</div>
                </div>
                {i < 5 && <div style={{ flex: 1, height: 2, background: i < 3 ? "var(--teal)" : "var(--slate-200)" }}/>}
              </React.Fragment>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--slate-500)", textTransform: "uppercase", marginBottom: 10 }}>Source file</div>
            <div style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, background: "var(--bg-blue)", color: "var(--teal)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><Icons.File size={18}/></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: "var(--navy)" }}>acme-q2-onboarding.docx</div>
                <div style={{ fontSize: 12, color: "var(--slate-500)" }}>482 segments · 4,820 words · uploaded by TMS Webhook</div>
              </div>
              <Button variant="outline" size="sm" icon={<Icons.Download size={13}/>}>Download</Button>
              <Button variant="ghost" size="sm">Replace</Button>
            </div>
          </div>
        </Section>

        <Section title="Translator">
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
            <Avatar name="Maria Chen" size={48}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: "var(--navy)", fontSize: 15 }}>Maria Chen</div>
              <div style={{ fontSize: 12, color: "var(--slate-500)" }}>maria.chen@acme.com · SSO from vendor portal</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div style={{ padding: 10, background: "var(--slate-50)", borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: "var(--slate-500)" }}>Rate</div>
              <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--navy)" }}>$0.08/word</div>
            </div>
            <div style={{ padding: 10, background: "var(--slate-50)", borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: "var(--slate-500)" }}>Capacity</div>
              <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--amber-600)" }}>78%</div>
            </div>
            <div style={{ padding: 10, background: "var(--slate-50)", borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: "var(--slate-500)" }}>On-time</div>
              <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--emerald-600)" }}>96%</div>
            </div>
            <div style={{ padding: 10, background: "var(--slate-50)", borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: "var(--slate-500)" }}>QA score</div>
              <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--navy)" }}>4.7 ★</div>
            </div>
          </div>
          <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "var(--slate-700)" }}><Icons.Calendar size={13} style={{display:"inline",marginRight:6,verticalAlign:-2}}/>Deadline: Apr 26, 18:00 UTC</span>
            <button style={{ color: "var(--slate-400)" }}><Icons.Edit size={13}/></button>
          </div>
        </Section>
      </div>
    </PMLayout>
  );
};

// PM3 — Create Job wizard
const PM3_Create = (props) => {
  const [step, setStep] = React.useState(1);
  const steps = ["Source file","Languages","Resources","Assignment","Review"];
  return (
    <PMLayout {...props} active="create" breadcrumb={["Create job"]}>
      <PageHeader title="Create a new job" subtitle="Manual upload — for tests, training, or off-TMS work."/>

      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        {/* Stepper */}
        <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 8 }}>
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div onClick={() => setStep(i+1)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <div style={{ width: 30, height: 30, borderRadius: 999, background: i+1 === step ? "var(--teal)" : i+1 < step ? "var(--emerald-500)" : "var(--slate-100)", color: i+1 <= step ? "#fff" : "var(--slate-500)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>
                  {i+1 < step ? <Icons.Check size={14} stroke={3}/> : i+1}
                </div>
                <div style={{ fontSize: 13, fontWeight: i+1 === step ? 600 : 500, color: i+1 === step ? "var(--navy)" : "var(--slate-500)" }}>{s}</div>
              </div>
              {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: i+1 < step ? "var(--emerald-500)" : "var(--slate-100)", borderRadius: 999 }}/>}
            </React.Fragment>
          ))}
        </div>

        <div style={{ padding: 28, minHeight: 420 }}>
          {step === 1 && <>
            <h3 style={{margin:"0 0 4px",color:"var(--navy)",fontSize:18}}>Upload your source file</h3>
            <p style={{margin:"0 0 18px",color:"var(--slate-500)",fontSize:13}}>We'll detect format and segment it automatically.</p>
            <div style={{ border: "2px dashed var(--slate-300)", borderRadius: 12, padding: 36, textAlign: "center", background: "var(--slate-50)" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#fff", color: "var(--teal)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Icons.Upload size={24}/></div>
              <div style={{ fontWeight: 600, color: "var(--navy)" }}>Drop a source file here, or click to browse</div>
              <div style={{ fontSize: 12, color: "var(--slate-500)", marginTop: 6 }}>.docx · .xlsx · .pptx · .pdf · .xliff · .srt · .json · .html · 50MB max</div>
            </div>

            <div style={{ marginTop: 18, padding: 16, border: "1px solid var(--border)", borderRadius: 10, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 36, height: 36, background: "var(--bg-blue)", color: "var(--teal)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><Icons.File size={18}/></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: "var(--navy)" }}>acme-q2-onboarding.docx</div>
                <div style={{ fontSize: 12, color: "var(--slate-500)" }}>1.2MB · DOCX</div>
              </div>
              <Pill color="teal" size="sm">Detected: DOCX</Pill>
              <button style={{ color: "var(--slate-400)" }}><Icons.X size={16}/></button>
            </div>
            <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--navy)", marginBottom: 6 }}>Segmenter rule (SRX)</div>
                <select style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--slate-200)", borderRadius: 8, fontSize: 14, background: "#fff", color: "var(--navy)" }}><option>Default</option><option>Marketing</option><option>Legal</option></select>
              </div>
              <Input label="Internal name" placeholder="e.g. Acme Q2 Onboarding"/>
              <Input label="Client tag" placeholder="e.g. ACME"/>
            </div>
            <div style={{ marginTop: 18, padding: 14, background: "var(--bg-blue)", border: "1px solid #BAE6FD", borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--teal-700)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>Detected · 482 segments · 4,820 words</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {["Welcome to Acme — let's get you set up.","Tell us a bit about your team.","How many people are in your organization?"].map((s, i) => (
                  <div key={i} className="mono" style={{ fontSize: 12, color: "var(--navy)", padding: "4px 8px", background: "#fff", borderRadius: 4 }}>{i+1}. {s}</div>
                ))}
              </div>
            </div>
          </>}

          {step === 2 && <>
            <h3 style={{margin:"0 0 4px",color:"var(--navy)",fontSize:18}}>Languages</h3>
            <p style={{margin:"0 0 18px",color:"var(--slate-500)",fontSize:13}}>One job per language pair. Need multiple? Create one per pair.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ padding: 16, border: "2px solid var(--teal)", background: "var(--bg-blue)", borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--teal-700)", textTransform: "uppercase", marginBottom: 6 }}>Source — Auto-detected</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Flag code="EN" size={24}/><span style={{fontSize:18,fontWeight:600,color:"var(--navy)"}}>English (US)</span></div>
              </div>
              <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--slate-500)", textTransform: "uppercase", marginBottom: 8 }}>Target</div>
                <select style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--slate-200)", borderRadius: 8, fontSize: 14, color: "var(--navy)" }}><option>French (France)</option><option>Spanish</option></select>
              </div>
            </div>
            <div style={{ marginTop: 16, padding: 14, background: "var(--slate-50)", borderRadius: 10, fontSize: 13, color: "var(--slate-600)" }}>
              Word count for this pair: <b className="mono" style={{color:"var(--navy)"}}>4,820 words</b>
            </div>
          </>}

          {step === 3 && <>
            <h3 style={{margin:"0 0 4px",color:"var(--navy)",fontSize:18}}>Linguistic resources</h3>
            <p style={{margin:"0 0 18px",color:"var(--slate-500)",fontSize:13}}>Connect TMs, termbases, and choose your QA profile + MT.</p>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", marginBottom: 8 }}>Translation Memories (priority order)</div>
              {[{n:"Acme EN→FR Master",p:1},{n:"Marketing EN→FR",p:2},{n:"Global EN→FR Fallback",p:3}].map((tm, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, border: "1px solid var(--border)", borderRadius: 8, marginBottom: 6, background: "#fff" }}>
                  <Icons.GripVertical size={16} style={{color:"var(--slate-400)"}}/>
                  <span className="mono" style={{ fontSize: 11, padding: "2px 8px", background: "var(--slate-100)", borderRadius: 4, color: "var(--slate-600)" }}>#{tm.p}</span>
                  <span style={{ flex: 1, fontWeight: 500, color: "var(--navy)" }}>{tm.n}</span>
                  <button style={{ color: "var(--slate-400)" }}><Icons.X size={14}/></button>
                </div>
              ))}
              <Button variant="outline" size="sm" icon={<Icons.Plus size={13}/>}>Add TM</Button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, color: "var(--navy)" }}>MT pre-translation</div>
                  <Toggle checked onChange={()=>{}}/>
                </div>
                <select style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--slate-200)", borderRadius: 8, fontSize: 13 }}><option>DeepL · Pro</option><option>Google Cloud</option></select>
              </div>
              <div style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 10 }}>
                <div style={{ fontWeight: 600, color: "var(--navy)", marginBottom: 8 }}>QA profile</div>
                <select style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--slate-200)", borderRadius: 8, fontSize: 13 }}><option>Marketing strict</option><option>Default</option></select>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", marginBottom: 8 }}>Termbases</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["Acme Brand Glossary","Marketing Forbidden FR","UI Strings"].map(t => <Pill key={t} color="teal" size="md" icon={<Icons.Book size={11}/>}>{t} <Icons.X size={11} style={{marginLeft:4}}/></Pill>)}
                <Button variant="outline" size="sm" icon={<Icons.Plus size={12}/>}>Add</Button>
              </div>
            </div>
          </>}

          {step === 4 && <>
            <h3 style={{margin:"0 0 4px",color:"var(--navy)",fontSize:18}}>Assignment & deadline</h3>
            <p style={{margin:"0 0 18px",color:"var(--slate-500)",fontSize:13}}>We've filtered to translators with EN→FR who have capacity.</p>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--navy)", marginBottom: 8 }}>Translator (best fit shown first)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {TRANSLATORS.filter(t => t.pairs.some(p => p[0] === "EN" && p[1] === "FR")).slice(0, 3).map((t, i) => (
                  <label key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, border: `2px solid ${i === 0 ? "var(--teal)" : "var(--border)"}`, borderRadius: 10, background: i === 0 ? "var(--bg-blue)" : "#fff", cursor: "pointer" }}>
                    <input type="radio" name="tr" defaultChecked={i === 0} style={{accentColor:"var(--teal)"}}/>
                    <Avatar name={t.name} size={36}/>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: "var(--navy)" }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: "var(--slate-500)" }}>{t.pairs.map(p => p.join("→")).join(", ")} · {t.qa}★ · {t.ontime}% on-time</div>
                    </div>
                    <Pill color={t.capacity > 80 ? "rose" : "emerald"} size="sm">{t.capacity}% capacity</Pill>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Deadline" type="text" defaultValue="Apr 26, 2026 — 18:00 UTC" icon={<Icons.Calendar size={14}/>}/>
              <Input label="Reviewer (optional)" placeholder="Search…" icon={<Icons.User size={14}/>}/>
            </div>
          </>}

          {step === 5 && <>
            <h3 style={{margin:"0 0 4px",color:"var(--navy)",fontSize:18}}>Review and create</h3>
            <p style={{margin:"0 0 18px",color:"var(--slate-500)",fontSize:13}}>Quick check — change any value below or step back.</p>
            <div style={{ background: "var(--slate-50)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
              {[
                { l: "Source file", v: "acme-q2-onboarding.docx · 482 segments · 4,820 words" },
                { l: "Pair", v: <FlagPair from="EN" to="FR" size={16}/> },
                { l: "TMs", v: "Acme EN→FR Master · Marketing EN→FR · Global Fallback" },
                { l: "MT", v: "DeepL Pro (pre-translate)" },
                { l: "Termbases", v: "Acme Brand Glossary · Marketing Forbidden FR · UI Strings" },
                { l: "QA profile", v: "Marketing strict" },
                { l: "Translator", v: "Maria Chen — $0.08/word" },
                { l: "Deadline", v: "Apr 26, 2026 — 18:00 UTC" },
                { l: "Estimated cost", v: <span className="mono" style={{color:"var(--navy)",fontWeight:700}}>$385.60</span> },
              ].map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 16, padding: "8px 0", borderBottom: i < 8 ? "1px dashed var(--border)" : "" }}>
                  <div style={{ fontSize: 12.5, color: "var(--slate-500)", fontWeight: 500 }}>{r.l}</div>
                  <div style={{ fontSize: 13, color: "var(--navy)" }}>{r.v}</div>
                </div>
              ))}
            </div>
          </>}
        </div>

        <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", background: "var(--slate-50)" }}>
          <Button variant="ghost" onClick={() => setStep(Math.max(1, step - 1))} icon={<Icons.ArrowLeft size={14}/>} disabled={step === 1}>Back</Button>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="outline">Save as draft</Button>
            {step < 5 ? <Button onClick={() => setStep(step + 1)} iconRight={<Icons.ArrowRight size={14}/>}>Continue</Button>
              : <Button variant="success" icon={<Icons.Check size={14}/>}>Create and notify translator</Button>}
          </div>
        </div>
      </div>
    </PMLayout>
  );
};

// PM4 — Translators
const PM4_Translators = (props) => (
  <PMLayout {...props} active="translators" breadcrumb={["Translators"]}>
    <PageHeader title="Translators" subtitle="Capacity, performance, and best fit across your roster."/>

    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 14, marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
      <Tabs variant="pills" tabs={["All","Available","Busy","SSO","Direct"]} active="All" onChange={()=>{}}/>
      <Input full={false} placeholder="Search…" icon={<Icons.Search size={14}/>} style={{ width: 220 }}/>
      <div style={{ flex: 1 }}/>
      <Button variant="outline" size="sm">Sort: Best fit ▾</Button>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
      {TRANSLATORS.map((t, i) => (
        <div key={i} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Avatar name={t.name} size={44}/>
              <div>
                <div style={{ fontWeight: 700, color: "var(--navy)" }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "var(--slate-500)" }}>{t.jobs} active jobs</div>
              </div>
            </div>
            <Pill color={t.status === "Available" ? "emerald" : "amber"} size="sm">{t.status}</Pill>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {t.pairs.map((p, j) => <FlagPair key={j} from={p[0]} to={p[1]} size={14}/>)}
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
              <span style={{ color: "var(--slate-500)", fontWeight: 500 }}>Capacity this week</span>
              <span style={{ color: t.capacity > 85 ? "var(--rose-500)" : "var(--navy)", fontWeight: 600 }} className="mono">{t.capacity}%</span>
            </div>
            <ProgressBar value={t.capacity} color={t.capacity > 85 ? "var(--rose-500)" : t.capacity > 60 ? "var(--amber-500)" : "var(--teal)"}/>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
            <div style={{ padding: 8, background: "var(--slate-50)", borderRadius: 6, textAlign: "center" }}>
              <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)" }}>{t.leverage}%</div>
              <div style={{ fontSize: 10.5, color: "var(--slate-500)" }}>leverage</div>
            </div>
            <div style={{ padding: 8, background: "var(--slate-50)", borderRadius: 6, textAlign: "center" }}>
              <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)" }}>{t.ontime}%</div>
              <div style={{ fontSize: 10.5, color: "var(--slate-500)" }}>on-time</div>
            </div>
            <div style={{ padding: 8, background: "var(--slate-50)", borderRadius: 6, textAlign: "center" }}>
              <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)" }}>{t.qa}★</div>
              <div style={{ fontSize: 10.5, color: "var(--slate-500)" }}>QA</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button size="sm" full>Assign to job</Button>
            <Button size="sm" variant="outline">Profile</Button>
          </div>
        </div>
      ))}
    </div>
  </PMLayout>
);

// PM5 — Concordance
const PM5_Concordance = (props) => (
  <PMLayout {...props} active="concordance" breadcrumb={["Concordance"]}>
    <PageHeader title="Concordance" subtitle="Search every translation memory in your workspace."/>

    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 18, marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <Input full placeholder="Search across all TMs…" icon={<Icons.Search size={16}/>} defaultValue="invite your team" style={{fontSize:15}}/>
        <Button size="md">Search</Button>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button variant="outline" size="sm">All TMs ▾</Button>
        <Button variant="outline" size="sm" icon={<Icons.Languages size={13}/>}>EN → FR ▾</Button>
        <Button variant="outline" size="sm" icon={<Icons.Calendar size={13}/>}>Any date ▾</Button>
        <Button variant="outline" size="sm">All clients ▾</Button>
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          { tm: "Acme EN→FR Master", src: "Invite your team to start working together.", tgt: "Invitez votre équipe à commencer à travailler ensemble.", by: "Maria Chen", date: "3 days ago" },
          { tm: "Marketing EN→FR", src: "Invite your team to collaborate.", tgt: "Invitez votre équipe à collaborer.", by: "Lena Vogt", date: "1 wk ago" },
          { tm: "Acme EN→FR Master", src: "Invite up to 5 teammates by email.", tgt: "Invitez jusqu'à 5 coéquipiers par e-mail.", by: "Maria Chen", date: "2 wks ago" },
          { tm: "Globex EN→FR", src: "We'll send invitations to your team.", tgt: "Nous enverrons des invitations à votre équipe.", by: "Camille Laurent", date: "1 mo ago" },
          { tm: "Hooli EN→FR", src: "Invite teammates and assign roles.", tgt: "Invitez des coéquipiers et attribuez des rôles.", by: "Maria Chen", date: "2 mo ago" },
        ].map((r, i) => (
          <div key={i} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Pill color="teal" size="sm">{r.tm}</Pill>
                <FlagPair from="EN" to="FR" size={14}/>
              </div>
              <Button variant="ghost" size="sm" disabled icon={<Icons.ArrowRight size={12}/>} title="Available when arrived from editor">Insert into editor</Button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="mono" style={{ fontSize: 13, color: "var(--navy)" }}>{r.src.replace("invite your team", "")}<span style={{background:"var(--amber-100)",padding:"1px 4px",borderRadius:3}}>invite your team</span>{r.src.includes("invite your team") ? "" : ""}</div>
              <div className="mono" style={{ fontSize: 13, color: "var(--slate-700)" }}>{r.tgt}</div>
            </div>
            <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--slate-500)", display: "flex", gap: 12 }}>
              <span><Avatar name={r.by} size={14}/> {r.by}</span><span>·</span><span>{r.date}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 16, height: "fit-content" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)", marginBottom: 10 }}>Filter</div>
        {["TM","Language pair","Client","Status"].map(g => (
          <div key={g} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{g}</div>
            {(g === "TM" ? ["Acme EN→FR Master (12)","Marketing EN→FR (4)","Globex EN→FR (2)"] : g === "Client" ? ["Acme (14)","Hooli (3)","Globex (2)"] : g === "Language pair" ? ["EN → FR (18)","EN → ES (4)"] : ["Active (16)","Forbidden (2)"]).map(o => (
              <label key={o} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--slate-600)", padding: "3px 0" }}>
                <input type="checkbox" defaultChecked style={{accentColor:"var(--teal)"}}/>{o}
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  </PMLayout>
);

// PM6 — Reports
const PM6_Reports = (props) => (
  <PMLayout {...props} active="reports" breadcrumb={["Reports"]}>
    <PageHeader title="Reports" subtitle="Throughput, quality, leverage — across your workspace."
      actions={<><Button variant="outline" size="sm" icon={<Icons.Download size={13}/>}>Export PDF</Button><Button variant="outline" size="sm" icon={<Icons.Download size={13}/>}>CSV</Button></>}/>

    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 14, marginBottom: 16, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <Button variant="outline" size="sm" icon={<Icons.Calendar size={13}/>}>Apr 1 – Apr 24, 2026 ▾</Button>
      <Button variant="outline" size="sm">All pairs ▾</Button>
      <Button variant="outline" size="sm">All translators ▾</Button>
      <Button variant="outline" size="sm">All sources ▾</Button>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 16 }}>
      <Section title="TM leverage trend">
        <StackedArea labels={Array.from({length:14},(_,i)=>i)}
          series={[
            { color: "var(--emerald-500)", data: [22,24,26,25,28,30,32,31,33,36,38,40,42,44] },
            { color: "var(--lime-500)", data: [12,13,15,14,16,15,17,18,16,18,19,20,19,21] },
            { color: "var(--amber-500)", data: [14,15,13,16,15,17,18,16,18,19,20,19,21,22] },
          ]}/>
      </Section>
      <Section title="QA score distribution">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 180, padding: "10px 0" }}>
          {[3,8,18,42,28,12,4].map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: "100%", background: i === 3 || i === 4 ? "var(--teal)" : "var(--slate-200)", height: `${v * 3}px`, borderRadius: "4px 4px 0 0" }}/>
              <div className="mono" style={{ fontSize: 10, color: "var(--slate-500)" }}>{(i + 3).toFixed(1)}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>

    <Section title="Throughput — words per day per translator" style={{marginBottom:16}}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 200, padding: "10px 0" }}>
        {TRANSLATORS.slice(0,8).map((t, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ width: "100%", display: "flex", flexDirection: "column-reverse", height: 160 }}>
              {[
                {h: 30 + (i*4)%50, c: "var(--teal)"},
                {h: 20 + (i*3)%30, c: "var(--lime-500)"},
                {h: 15 + (i*5)%25, c: "var(--amber-500)"},
              ].map((x, j) => (
                <div key={j} style={{ height: `${x.h}px`, background: x.c, borderRadius: j === 2 ? "4px 4px 0 0" : 0 }}/>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--navy)", textAlign: "center" }}>{t.name.split(" ")[0]}</div>
          </div>
        ))}
      </div>
    </Section>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Section title="Top forbidden terms triggered">
        <BarList items={[
          { label: "click here (UI)", value: 84, color: "var(--rose-500)" },
          { label: "synergy (Brand)", value: 41, color: "var(--rose-500)" },
          { label: "leverage (Brand)", value: 28, color: "var(--amber-500)" },
          { label: "groupe → use 'équipe' (FR)", value: 19, color: "var(--amber-500)" },
        ]}/>
      </Section>
      <Section title="Avg time per segment (by pair)">
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          {[
            { p: ["EN","FR"], t: "1m 24s", v: 384 },
            { p: ["EN","ES"], t: "1m 12s", v: 218 },
            { p: ["EN","DE"], t: "2m 02s", v: 142 },
            { p: ["EN","JA"], t: "2m 38s", v: 98 },
            { p: ["EN","ZH"], t: "1m 58s", v: 64 },
          ].map((r,i) => (
            <tr key={i} style={{ borderBottom: i < 4 ? "1px solid var(--border-soft)" : "" }}>
              <td style={{ padding: "8px 0" }}><FlagPair from={r.p[0]} to={r.p[1]}/></td>
              <td className="mono" style={{ padding: "8px 0", textAlign: "right", color: "var(--navy)", fontWeight: 600 }}>{r.t}</td>
              <td className="mono" style={{ padding: "8px 0 8px 12px", textAlign: "right", color: "var(--slate-500)" }}>{r.v} segs</td>
            </tr>
          ))}
        </table>
      </Section>
    </div>
  </PMLayout>
);

Object.assign(window, { PM_NAV, PMLayout, PM1_Dashboard, PM2_Jobs, PM3_Create, PM4_Translators, PM5_Concordance, PM6_Reports });
