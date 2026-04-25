// Translator screens TR1-TR4

const TR_NAV = [
  { id: "queue", label: "My Queue", icon: <Icons.Briefcase size={16}/>, count: 3 },
  { id: "completed", label: "Completed", icon: <Icons.Check size={16}/> },
  { id: "concordance", label: "Concordance", icon: <Icons.Search size={16}/> },
  { id: "stats", label: "My Stats", icon: <Icons.BarChart size={16}/> },
];

const TRLayout = ({ active, onNav, breadcrumb, actions, children, user, onSearchOpen, onNotifOpen, onLogout, sourcePill }) => (
  <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-app)" }}>
    <Sidebar items={TR_NAV} active={active} onChange={onNav} role="Translator" user={user} onLogout={onLogout} sourcePill={sourcePill}/>
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <TopBar breadcrumb={breadcrumb} actions={actions} user={user} onSearchOpen={onSearchOpen} onNotifOpen={onNotifOpen}/>
      <main style={{ flex: 1, padding: "28px 32px", maxWidth: 1400, width: "100%" }}>{children}</main>
    </div>
  </div>
);

// TR1 — Queue
const TR1_Queue = (props) => {
  const myJobs = [
    { ref: "J-2026-04-381", project: "Acme Q2 Onboarding", source: "Vendor portal", pair: ["EN","FR"], words: 4820, progress: 64, deadline: "in 2d 4h", urgency: "ok" },
    { ref: "J-2026-04-379", project: "Hooli Marketing", source: "Vendor portal", pair: ["EN","FR"], words: 1840, progress: 22, deadline: "in 18 hr", urgency: "soon" },
    { ref: "J-2026-04-372", project: "Acme Help Center", source: "Vendor portal", pair: ["EN","ES"], words: 2240, progress: 0, deadline: "in 5 days", urgency: "ok" },
  ];
  return (
    <TRLayout {...props} active="queue" breadcrumb={["My Queue"]}
      sourcePill={<Pill color="emerald" size="sm" icon={<Icons.Globe size={10}/>}>Signed in via vendor portal</Pill>}>
      <PageHeader title="Hi Maria — let's get to work" subtitle="3 active jobs · 1 due in under 24 hours."/>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
        <Stat label="Words this week" value="6,240" sub="goal 10k" icon={<Icons.Edit size={16}/>}/>
        <Stat label="Avg leverage" value="58%" sub="—" icon={<Icons.TrendingUp size={16}/>}/>
        <Stat label="QA score" value="4.7 ★" sub="last 30 days" icon={<Icons.Star size={16}/>}/>
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: 0.6, margin: "0 0 12px" }}>Active jobs</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {myJobs.map((j, i) => (
          <button key={i} onClick={() => props.onOpenEditor && props.onOpenEditor()} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 18, textAlign: "left", display: "grid", gridTemplateColumns: "1.5fr 1fr 1.4fr auto", gap: 18, alignItems: "center", cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--teal)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = ""; }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--slate-500)" }}>{j.ref}</span>
                <FlagPair from={j.pair[0]} to={j.pair[1]} size={14}/>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>{j.project}</div>
              <div style={{ fontSize: 12, color: "var(--slate-500)", marginTop: 2 }}>From {j.source}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--slate-500)", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Progress</div>
              <ProgressBar value={j.progress}/>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12 }}>
                <span style={{ color: "var(--slate-500)" }}>{Math.round(j.words * j.progress/100).toLocaleString()} / {j.words.toLocaleString()} words</span>
                <span className="mono" style={{ color: "var(--navy)", fontWeight: 600 }}>{j.progress}%</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--slate-500)", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Deadline</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: j.urgency === "soon" ? "var(--rose-500)" : "var(--emerald-500)" }}/>
                <span style={{ fontWeight: 600, color: j.urgency === "soon" ? "var(--rose-500)" : "var(--navy)" }}>{j.deadline}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--slate-500)", marginTop: 2 }}>Apr 26, 18:00 UTC</div>
            </div>
            <Button icon={<Icons.ArrowRight size={14}/>}>{j.progress > 0 ? "Continue" : "Start"}</Button>
          </button>
        ))}
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: 0.6, margin: "32px 0 12px" }}>Recently completed</h2>
      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        {[
          { ref: "J-2026-04-365", project: "Acme Q1 Newsletter", words: 1240, qa: 4.8, when: "Yesterday" },
          { ref: "J-2026-04-358", project: "Globex Press Release", words: 820, qa: 5.0, when: "3 days ago" },
        ].map((j, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: 14, borderBottom: i < 1 ? "1px solid var(--border-soft)" : "" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--emerald-50)", color: "var(--emerald-600)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icons.Check size={16}/></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>{j.project}</div>
              <div style={{ fontSize: 11.5, color: "var(--slate-500)" }} className="mono">{j.ref} · {j.words} words</div>
            </div>
            <Pill color="emerald" size="sm" icon={<Icons.Star size={10}/>}>{j.qa}</Pill>
            <span style={{ fontSize: 12, color: "var(--slate-500)", minWidth: 90, textAlign: "right" }}>{j.when}</span>
          </div>
        ))}
      </div>
    </TRLayout>
  );
};

// TR2 — THE EDITOR
const TR2_Editor = ({ onBack, ...props }) => {
  const segments = SEGMENTS;
  const [active, setActive] = React.useState(2);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [rightTab, setRightTab] = React.useState("tm");
  const seg = segments[active];

  const statusColor = (s) => ({ confirmed: "emerald", translated: "teal", draft: "amber", new: "slate", active: "teal", untranslated: "slate", locked: "slate" }[s] || "slate");

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-app)", overflow: "hidden" }}>
      {/* Editor topbar */}
      <div style={{ height: 56, background: "#fff", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 20px", gap: 16, flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--slate-600)", fontSize: 13, fontWeight: 500, padding: "6px 10px", borderRadius: 6 }} onMouseEnter={(e)=>e.currentTarget.style.background="var(--slate-100)"} onMouseLeave={(e)=>e.currentTarget.style.background=""}><Icons.ArrowLeft size={14}/> Queue</button>
        <div style={{ width: 1, height: 24, background: "var(--border)" }}/>
        <Icons.Wordmark color="var(--navy)" accent="var(--teal)" />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 12 }}>
          <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>J-2026-04-381</span>
          <span style={{ color: "var(--slate-400)" }}>·</span>
          <span style={{ fontSize: 13, color: "var(--slate-700)" }}>Acme Q2 Onboarding</span>
          <FlagPair from="EN" to="FR" size={14}/>
          <Pill color="amber" size="sm">Due in 2d 4h</Pill>
        </div>
        <div style={{ flex: 1 }}/>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", background: "var(--slate-50)", borderRadius: 999, fontSize: 12 }}>
          <span style={{ color: "var(--slate-500)" }}>312 of 482</span>
          <span style={{ width: 1, height: 12, background: "var(--border)" }}/>
          <span style={{ color: "var(--navy)", fontWeight: 600 }}>64%</span>
          <span style={{ width: 1, height: 12, background: "var(--border)" }}/>
          <Icons.Save size={12} style={{color:"var(--emerald-500)"}}/>
          <span style={{ color: "var(--slate-500)" }}>Saved 2s ago</span>
        </div>
        <Button variant="outline" size="sm" icon={<Icons.MessageCircle size={13}/>}>Comments</Button>
        <Button variant="outline" size="sm" icon={<Icons.Shield size={13}/>}>QA <Pill color="amber" size="sm" style={{marginLeft:6}}>4</Pill></Button>
        <Button size="sm" icon={<Icons.Send size={13}/>}>Submit</Button>
      </div>

      {/* Main 3-pane editor */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "260px 1fr 360px", overflow: "hidden" }}>
        {/* LEFT: segment list */}
        <div style={{ background: "#fff", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 12, borderBottom: "1px solid var(--border-soft)" }}>
            <Input placeholder="Filter segments…" icon={<Icons.Search size={13}/>}/>
            <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
              {[
                { id: "all", l: "All", n: 482 },
                { id: "new", l: "New", n: 170, c: "var(--slate-400)" },
                { id: "draft", l: "Draft", n: 44, c: "var(--amber-500)" },
                { id: "translated", l: "Done", n: 268, c: "var(--teal)" },
                { id: "issues", l: "Issues", n: 4, c: "var(--rose-500)" },
              ].map(f => (
                <button key={f.id} onClick={() => setStatusFilter(f.id)} style={{
                  padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: statusFilter === f.id ? "var(--navy)" : "var(--slate-50)",
                  color: statusFilter === f.id ? "#fff" : "var(--slate-600)",
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                  {f.c && <span style={{ width: 6, height: 6, borderRadius: 999, background: f.c }}/>}
                  {f.l} <span style={{ opacity: 0.6 }}>{f.n}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {segments.map((s, i) => (
              <button key={i} onClick={() => setActive(i)} style={{
                width: "100%", textAlign: "left", padding: "10px 14px",
                background: active === i ? "var(--bg-blue)" : "transparent",
                borderLeft: `3px solid ${active === i ? "var(--teal)" : "transparent"}`,
                borderBottom: "1px solid var(--border-soft)",
                display: "flex", gap: 10, alignItems: "flex-start",
              }}>
                <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--slate-400)", paddingTop: 2, minWidth: 22 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="truncate" style={{ fontSize: 12, color: "var(--navy)", fontWeight: active === i ? 600 : 400 }}>{s.source}</div>
                  <div className="truncate" style={{ fontSize: 11, color: "var(--slate-500)", marginTop: 2 }}>{s.target || <span style={{fontStyle:"italic"}}>untranslated</span>}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, paddingTop: 2 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: `var(--${statusColor(s.status)}-500, var(--slate-400))` }}/>
                  {s.match && <span className="mono" style={{ fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: s.match >= 100 ? "var(--emerald-50)" : s.match >= 95 ? "var(--lime-50)" : "var(--amber-50)", color: s.match >= 100 ? "var(--emerald-600)" : s.match >= 95 ? "var(--lime-600)" : "var(--amber-600)" }}>{s.match}%</span>}
                  {s.qa && <Icons.AlertCircle size={10} style={{color:"var(--rose-500)"}}/>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* CENTER: segment pane */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "#FAFBFD" }}>
          {/* Mini-toolbar */}
          <div style={{ padding: "10px 24px", background: "#fff", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <button style={{ padding: "6px 8px", borderRadius: 6, color: "var(--slate-500)" }}><Icons.ArrowLeft size={14}/></button>
            <span className="mono" style={{ fontSize: 12, color: "var(--slate-600)" }}>Segment <b style={{color:"var(--navy)"}}>{active + 1}</b> of <b style={{color:"var(--navy)"}}>482</b></span>
            <button style={{ padding: "6px 8px", borderRadius: 6, color: "var(--slate-500)" }}><Icons.ArrowRight size={14}/></button>
            <div style={{ width: 1, height: 16, background: "var(--border)" }}/>
            <button title="Bold" style={{ padding: "6px 8px", borderRadius: 6, color: "var(--slate-500)", fontWeight: 700, fontSize: 13 }}>B</button>
            <button title="Italic" style={{ padding: "6px 8px", borderRadius: 6, color: "var(--slate-500)", fontStyle: "italic", fontSize: 13 }}>I</button>
            <button title="Tag" style={{ padding: "6px 8px", borderRadius: 6, color: "var(--slate-500)" }}><Icons.Tag size={13}/></button>
            <div style={{ width: 1, height: 16, background: "var(--border)" }}/>
            <Button variant="ghost" size="sm" icon={<Icons.Sparkles size={12}/>}>Insert MT</Button>
            <Button variant="ghost" size="sm" icon={<Icons.Database size={12}/>}>Best TM match</Button>
            <Button variant="ghost" size="sm" icon={<Icons.Copy size={12}/>}>Copy source</Button>
            <div style={{ flex: 1 }}/>
            <span className="mono" style={{ fontSize: 11, color: "var(--slate-500)", padding: "3px 8px", background: "var(--slate-50)", borderRadius: 4 }}>⌘ Enter to confirm</span>
          </div>

          {/* The segment */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 100px" }}>
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
              {/* Header */}
              <div style={{ padding: "12px 18px", background: "var(--slate-50)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--slate-500)" }}>SEGMENT {active + 1}</span>
                  <Pill color={statusColor(seg.status)} size="sm">{seg.status}</Pill>
                  {seg.match && <Pill color={seg.match >= 100 ? "emerald" : seg.match >= 95 ? "lime" : "amber"} size="sm" icon={<Icons.Database size={10}/>}>{seg.match}% TM match</Pill>}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button style={{ padding: 6, color: "var(--slate-400)" }}><Icons.MessageCircle size={14}/></button>
                  <button style={{ padding: 6, color: "var(--slate-400)" }}><Icons.Lock size={14}/></button>
                  <button style={{ padding: 6, color: "var(--slate-400)" }}><Icons.MoreH size={14}/></button>
                </div>
              </div>

              {/* Source */}
              <div style={{ padding: 18, borderBottom: "1px solid var(--border-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Flag code="EN" size={14}/>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: 0.4 }}>English (US)</span>
                </div>
                <div style={{ fontSize: 17, lineHeight: 1.6, color: "var(--navy)", fontFamily: "Source Serif Pro, Georgia, serif" }}>
                  Save up to <span style={{ background: "#FEF3C7", padding: "0 4px", borderRadius: 3, borderBottom: "2px dotted var(--amber-500)", cursor: "help" }} title="Number — must match in target">30%</span> on your annual <span style={{ background: "var(--bg-blue)", padding: "0 4px", borderRadius: 3, borderBottom: "2px dotted var(--teal)", cursor: "help" }} title="Termbase: plan → forfait">plan</span>. <span className="mono" style={{ background: "var(--slate-100)", padding: "1px 6px", borderRadius: 4, fontSize: 14, color: "var(--slate-700)", fontWeight: 600 }}>{`{1}`}</span>Click here<span className="mono" style={{ background: "var(--slate-100)", padding: "1px 6px", borderRadius: 4, fontSize: 14, color: "var(--slate-700)", fontWeight: 600 }}>{`{/1}`}</span> to upgrade your team.
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--slate-500)", display: "flex", gap: 16 }}>
                  <span><Icons.Hash size={11} style={{display:"inline",verticalAlign:-2,marginRight:4}}/>22 words · 124 chars</span>
                  <span>Context: <b style={{color:"var(--navy)"}}>Pricing CTA banner</b></span>
                </div>
              </div>

              {/* Target */}
              <div style={{ padding: 18, background: "var(--bg-blue)", borderTop: "2px solid var(--teal)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Flag code="FR" size={14}/>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--teal-700)", textTransform: "uppercase", letterSpacing: 0.4 }}>French (France) · Target</span>
                  </div>
                  <span className="mono" style={{ fontSize: 11, color: "var(--slate-500)", padding: "2px 6px", background: "#fff", borderRadius: 4 }}>+18% length</span>
                </div>
                <div contentEditable suppressContentEditableWarning style={{
                  minHeight: 90, fontSize: 17, lineHeight: 1.6, color: "var(--navy)",
                  fontFamily: "Source Serif Pro, Georgia, serif",
                  padding: 14, background: "#fff", borderRadius: 8, border: "2px solid var(--teal)",
                  outline: "none",
                }}>
                  Économisez jusqu'à <span style={{ background: "#FEE2E2", padding: "0 4px", borderRadius: 3, color: "var(--rose-600)", borderBottom: "2px wavy var(--rose-500)" }}>40%</span> sur votre forfait annuel. <span className="mono" style={{ background: "var(--slate-100)", padding: "1px 6px", borderRadius: 4, fontSize: 14, color: "var(--slate-700)", fontWeight: 600 }}>{`{1}`}</span><span style={{ textDecoration: "line-through", color: "var(--rose-500)" }}>Cliquez ici</span><span className="mono" style={{ background: "var(--rose-50)", padding: "1px 6px", borderRadius: 4, fontSize: 14, color: "var(--rose-500)", fontWeight: 600, border: "1px dashed var(--rose-500)" }}>{`{/1}`}</span> pour mettre à niveau votre équipe.<span style={{ display: "inline-block", width: 2, height: 18, background: "var(--teal)", verticalAlign: -3, marginLeft: 1, animation: "blink 1s infinite" }}/>
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--slate-500)", display: "flex", justifyContent: "space-between" }}>
                  <span>26 words · 152 chars</span>
                  <span style={{ display: "flex", gap: 12 }}>
                    <button style={{ color: "var(--teal)", fontWeight: 600, fontSize: 12 }}>Save draft</button>
                    <button style={{ color: "var(--slate-500)", fontSize: 12 }}>⌘↵ Confirm</button>
                  </span>
                </div>
              </div>

              {/* Inline QA issues */}
              <div style={{ padding: "14px 18px", background: "#FEFBF1", borderTop: "1px solid var(--amber-100)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--amber-700)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icons.AlertTriangle size={12}/> 3 QA issues on this segment
                </div>
                {[
                  { sev: "Critical", c: "rose", t: "Number mismatch", d: "Source has '30%', target has '40%'", action: "Replace with 30%" },
                  { sev: "Critical", c: "rose", t: "Tag pair mismatch", d: "Target {/1} placement breaks the link", action: "Auto-fix" },
                  { sev: "Major", c: "amber", t: "Forbidden term", d: "'Cliquez ici' is forbidden — use 'Cliquez pour…'", action: "Apply suggestion" },
                ].map((iss, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderTop: i > 0 ? "1px dashed var(--amber-200)" : "" }}>
                    <Pill color={iss.c} size="sm">{iss.sev}</Pill>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>{iss.t}</span>
                      <span style={{ fontSize: 12, color: "var(--slate-600)", marginLeft: 8 }}>· {iss.d}</span>
                    </div>
                    <Button size="sm" variant="outline" icon={<Icons.Zap size={11}/>}>{iss.action}</Button>
                    <button style={{ color: "var(--slate-400)", padding: 4 }}><Icons.X size={14}/></button>
                  </div>
                ))}
              </div>

              <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--slate-500)" }}>
                  <Avatar name="Maria Chen" size={18}/> You · last edited 1 min ago
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="outline" size="sm">Skip</Button>
                  <Button variant="outline" size="sm" icon={<Icons.Lock size={12}/>}>Confirm + lock</Button>
                  <Button size="sm" icon={<Icons.Check size={12}/>}>Confirm & next</Button>
                </div>
              </div>
            </div>

            {/* Adjacent segments preview */}
            <div style={{ marginTop: 16, padding: 12, background: "var(--slate-50)", borderRadius: 10, fontSize: 12, color: "var(--slate-500)" }}>
              <div style={{ fontWeight: 600, color: "var(--slate-600)", marginBottom: 6, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>Next up</div>
              <div className="mono" style={{ color: "var(--navy)" }}>{segments[active+1]?.source}</div>
            </div>
          </div>
        </div>

        {/* RIGHT: TM/MT/Termbase */}
        <div style={{ background: "#fff", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
            {[
              { id: "tm", l: "TM", n: 4, icon: <Icons.Database size={12}/> },
              { id: "mt", l: "MT", n: 2, icon: <Icons.Sparkles size={12}/> },
              { id: "term", l: "Terms", n: 3, icon: <Icons.Book size={12}/> },
              { id: "conc", l: "Concord.", icon: <Icons.Search size={12}/> },
            ].map(t => (
              <button key={t.id} onClick={() => setRightTab(t.id)} style={{
                flex: 1, padding: "12px 8px", background: "transparent", borderBottom: `2px solid ${rightTab === t.id ? "var(--teal)" : "transparent"}`,
                color: rightTab === t.id ? "var(--navy)" : "var(--slate-500)", fontWeight: rightTab === t.id ? 600 : 500, fontSize: 12,
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
              }}>
                {t.icon}{t.l}{t.n != null && <span style={{ fontSize: 10, padding: "1px 5px", background: rightTab === t.id ? "var(--teal)" : "var(--slate-200)", color: rightTab === t.id ? "#fff" : "var(--slate-600)", borderRadius: 999, fontWeight: 700 }}>{t.n}</span>}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
            {rightTab === "tm" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { match: 98, src: "Save up to 30% on your annual plan.", tgt: "Économisez jusqu'à 30 % sur votre forfait annuel.", tm: "Acme EN→FR Master", by: "Maria Chen", date: "2 mo ago" },
                  { match: 92, src: "Save up to 25% on your monthly plan.", tgt: "Économisez jusqu'à 25 % sur votre forfait mensuel.", tm: "Marketing EN→FR", by: "Lena Vogt", date: "4 mo ago" },
                  { match: 78, src: "Get 30% off when you upgrade.", tgt: "Bénéficiez de 30 % de réduction lors de la mise à niveau.", tm: "Acme EN→FR Master", by: "Maria Chen", date: "6 mo ago" },
                  { match: 65, src: "Click here to upgrade your account.", tgt: "Cliquez pour mettre à niveau votre compte.", tm: "Globex EN→FR", by: "Camille L.", date: "1 yr ago" },
                ].map((m, i) => (
                  <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ padding: "8px 12px", background: "var(--slate-50)", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-soft)" }}>
                      <span className="mono" style={{ fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: m.match >= 100 ? "var(--emerald-500)" : m.match >= 95 ? "var(--lime-500)" : m.match >= 75 ? "var(--amber-500)" : "var(--slate-400)", color: "#fff" }}>{m.match}%</span>
                      <span style={{ fontSize: 11, color: "var(--slate-500)" }}>{m.tm}</span>
                    </div>
                    <div style={{ padding: 10 }}>
                      <div className="mono" style={{ fontSize: 12, color: "var(--navy)", marginBottom: 6 }}>{m.src.replace("30%","").split("annual")[0]}<mark style={{background:"#FEF3C7",padding:"0 2px"}}>30%</mark>{m.src.split("30%")[1] || ""}</div>
                      <div className="mono" style={{ fontSize: 12, color: "var(--teal-700)", padding: "6px 8px", background: "var(--bg-blue)", borderRadius: 6 }}>{m.tgt}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                        <span style={{ fontSize: 10.5, color: "var(--slate-500)" }}><Avatar name={m.by} size={14}/> {m.by} · {m.date}</span>
                        <Button size="sm" variant="outline" icon={<Icons.ArrowRight size={11}/>}>Insert</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {rightTab === "mt" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { engine: "DeepL", color: "var(--teal)", text: "Économisez jusqu'à 30 % sur votre abonnement annuel. Cliquez pour mettre à niveau votre équipe.", conf: 94 },
                  { engine: "Google Cloud", color: "var(--navy)", text: "Économisez jusqu'à 30 % sur votre forfait annuel. Cliquez ici pour mettre à niveau votre équipe.", conf: 89 },
                ].map((m, i) => (
                  <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: m.color }}><Icons.Sparkles size={11}/>{m.engine}</span>
                      <span className="mono" style={{ fontSize: 10.5, color: "var(--slate-500)" }}>conf {m.conf}%</span>
                    </div>
                    <div className="mono" style={{ fontSize: 12, color: "var(--navy)", lineHeight: 1.5, padding: 8, background: "var(--slate-50)", borderRadius: 6 }}>{m.text}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <Button size="sm" variant="outline" full icon={<Icons.ArrowRight size={11}/>}>Insert</Button>
                      <button title="thumbs up" style={{ padding: 6, color: "var(--slate-400)" }}><Icons.ThumbsUp size={12}/></button>
                      <button title="thumbs down" style={{ padding: 6, color: "var(--slate-400)" }}><Icons.ThumbsDown size={12}/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {rightTab === "term" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { src: "plan", tgt: "forfait", tb: "Acme Brand", note: "Use 'forfait' not 'plan' (anglicism)", status: "Approved", insertable: true },
                  { src: "team", tgt: "équipe", tb: "Acme Brand", note: "Prefer 'équipe', not 'groupe'", status: "Approved", insertable: true },
                  { src: "click here", tgt: "—", tb: "UI Strings", note: "Forbidden in FR — use 'Cliquez pour…'", status: "Forbidden", insertable: false },
                ].map((t, i) => (
                  <div key={i} style={{ border: `1px solid ${t.status === "Forbidden" ? "var(--rose-100)" : "var(--border)"}`, borderRadius: 10, padding: 12, background: t.status === "Forbidden" ? "var(--rose-50)" : "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <Pill color={t.status === "Forbidden" ? "rose" : "emerald"} size="sm">{t.status}</Pill>
                      <span style={{ fontSize: 11, color: "var(--slate-500)" }}>{t.tb}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--navy)" }}>{t.src}</span>
                      <Icons.ArrowRight size={12} style={{color:"var(--slate-400)"}}/>
                      <span style={{ fontSize: 14, fontWeight: 600, color: t.status === "Forbidden" ? "var(--rose-500)" : "var(--teal)", textDecoration: t.status === "Forbidden" ? "line-through" : "" }}>{t.tgt}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--slate-600)", fontStyle: "italic", marginBottom: 8 }}>{t.note}</div>
                    {t.insertable && <Button size="sm" variant="outline" icon={<Icons.ArrowRight size={11}/>}>Insert target</Button>}
                  </div>
                ))}
              </div>
            )}

            {rightTab === "conc" && (
              <div>
                <Input placeholder="Search source or target…" icon={<Icons.Search size={13}/>} defaultValue="upgrade"/>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { s: "Click to upgrade your account.", t: "Cliquez pour mettre à niveau votre compte.", tm: "Acme EN→FR" },
                    { s: "Upgrade anytime from settings.", t: "Mettez à niveau à tout moment depuis les paramètres.", tm: "Marketing EN→FR" },
                  ].map((r, i) => (
                    <div key={i} style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 8 }}>
                      <div className="mono" style={{ fontSize: 12, color: "var(--navy)", marginBottom: 4 }}>{r.s.replace("upgrade", "")}<mark style={{background:"#FEF3C7",padding:"0 2px"}}>upgrade</mark>{r.s.split("upgrade")[1]||""}</div>
                      <div className="mono" style={{ fontSize: 12, color: "var(--teal-700)" }}>{r.t}</div>
                      <div style={{ fontSize: 10.5, color: "var(--slate-500)", marginTop: 4 }}>{r.tm}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
      `}</style>
    </div>
  );
};

// TR3 — Comments
const TR3_Comments = (props) => {
  const threads = [
    { seg: 14, status: "open", from: "Sarah Park", role: "PM", time: "2h ago", body: "Marketing wants 'forfait' not 'plan' here — confirmed with the brand team.", replies: 1 },
    { seg: 47, status: "resolved", from: "You", role: "Translator", time: "Yesterday", body: "Should this stay in English? It's a brand name.", replies: 2 },
    { seg: 102, status: "open", from: "Sarah Park", role: "PM", time: "Yesterday", body: "Per legal, retain the original capitalization for 'Cookie' here.", replies: 0 },
    { seg: 188, status: "open", from: "James O.", role: "Reviewer", time: "Yesterday", body: "The 'meet & greet' phrasing feels off — consider 'rencontre informelle'?", replies: 3 },
  ];
  return (
    <TRLayout {...props} active="queue" breadcrumb={[<a key="b" style={{cursor:"pointer"}}>J-2026-04-381</a>, "Comments"]}>
      <PageHeader title="Comments — J-2026-04-381" subtitle="4 threads · 3 open · last activity 2 hours ago"/>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Tabs variant="pills" tabs={[{id:"all",l:"All",count:4},{id:"o",l:"Open",count:3},{id:"r",l:"Resolved",count:1},{id:"me",l:"Mentioning me",count:1}].map(t=>({id:t.id,label:t.l,count:t.count}))} active="all" onChange={()=>{}}/>
        <div style={{ flex: 1 }}/>
        <Button variant="outline" size="sm" icon={<Icons.Filter size={13}/>}>Filter</Button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {threads.map((t, i) => (
          <div key={i} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", opacity: t.status === "resolved" ? 0.7 : 1 }}>
            <div style={{ padding: "10px 16px", background: "var(--slate-50)", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="mono" style={{ fontSize: 11, padding: "2px 8px", background: "var(--navy)", color: "#fff", borderRadius: 4, fontWeight: 700 }}>SEG #{t.seg}</span>
                <Pill color={t.status === "open" ? "amber" : "emerald"} size="sm">{t.status}</Pill>
                {t.replies > 0 && <span style={{ fontSize: 12, color: "var(--slate-500)" }}>{t.replies} {t.replies === 1 ? "reply" : "replies"}</span>}
              </div>
              <Button variant="ghost" size="sm" icon={<Icons.ArrowRight size={12}/>}>Open in editor</Button>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ background: "var(--slate-50)", padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 12 }}>
                <div className="mono" style={{ color: "var(--navy)" }}>Welcome to your <mark style={{background:"#FEF3C7"}}>plan</mark>. Manage your team from settings.</div>
                <div className="mono" style={{ color: "var(--slate-700)", marginTop: 4 }}>Bienvenue dans votre <mark style={{background:"#FEF3C7"}}>plan</mark>. Gérez votre équipe depuis les paramètres.</div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <Avatar name={t.from} size={32}/>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: "var(--navy)", fontSize: 13 }}>{t.from}</span>
                    <Pill color={t.role === "PM" ? "purple" : t.role === "Reviewer" ? "navy" : "teal"} size="sm">{t.role}</Pill>
                    <span style={{ fontSize: 12, color: "var(--slate-500)" }}>· {t.time}</span>
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--slate-700)", lineHeight: 1.5 }}>{t.body}</div>
                </div>
              </div>
              {t.status === "open" && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-soft)", display: "flex", gap: 10 }}>
                  <Avatar name="Maria Chen" size={28}/>
                  <input placeholder="Reply to thread… use @ to mention" style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--slate-200)", borderRadius: 8, fontSize: 13 }}/>
                  <Button size="sm" variant="outline">Resolve</Button>
                  <Button size="sm">Reply</Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </TRLayout>
  );
};

// TR4 — Submit & Done
const TR4_Submit = (props) => {
  const [step, setStep] = React.useState("review"); // review | confirm | done

  if (step === "done") {
    return (
      <TRLayout {...props} active="queue" breadcrumb={["J-2026-04-381", "Submitted"]}>
        <div style={{ maxWidth: 600, margin: "60px auto", textAlign: "center" }}>
          <div style={{ width: 88, height: 88, borderRadius: "50%", background: "var(--emerald-50)", color: "var(--emerald-500)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 24, position: "relative" }}>
            <Icons.Check size={44} stroke={3}/>
            <div style={{ position: "absolute", inset: -8, borderRadius: "50%", border: "2px solid var(--emerald-500)", opacity: 0.3 }}/>
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 700, color: "var(--navy)", margin: 0, letterSpacing: -0.6 }}>Job submitted — nice work, Maria.</h1>
          <p style={{ fontSize: 15, color: "var(--slate-500)", marginTop: 10 }}>
            J-2026-04-381 was delivered to Acme. Your TM units are saved and your stats are updated.
          </p>

          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 24, marginTop: 28, textAlign: "left" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
              {[
                { l: "Words delivered", v: "4,820" },
                { l: "TM units saved", v: "+312" },
                { l: "Final QA score", v: "4.8 ★" },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: "center", borderRight: i < 2 ? "1px solid var(--border-soft)" : "" }}>
                  <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: "var(--navy)" }}>{s.v}</div>
                  <div style={{ fontSize: 12, color: "var(--slate-500)", marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, padding: 14, background: "var(--bg-blue)", borderRadius: 10, fontSize: 13, color: "var(--navy)", lineHeight: 1.5 }}>
              <Icons.Send size={14} style={{display:"inline",verticalAlign:-2,marginRight:6,color:"var(--teal)"}}/>
              Sent back to <b>Acme TMS</b> via webhook · ID <span className="mono">whk_8a31f902</span>
            </div>
          </div>

          <div style={{ marginTop: 28, display: "flex", gap: 10, justifyContent: "center" }}>
            <Button size="lg" onClick={() => props.onNav && props.onNav("queue")} icon={<Icons.Briefcase size={14}/>}>Back to queue</Button>
            <Button variant="outline" size="lg" icon={<Icons.ArrowRight size={14}/>}>Pick up J-2026-04-379 next</Button>
          </div>

          <p style={{ fontSize: 12, color: "var(--slate-400)", marginTop: 28 }}>You'll be notified when this job is reviewed.</p>
        </div>
      </TRLayout>
    );
  }

  return (
    <TRLayout {...props} active="queue" breadcrumb={[<a key="b" style={{cursor:"pointer"}}>J-2026-04-381</a>, "Submit"]}>
      <PageHeader title="Final review before submission" subtitle="Make sure all critical issues are resolved. This will lock the job and send results to Acme."/>

      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: 18, borderBottom: "1px solid var(--border-soft)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <Icons.AlertTriangle size={18} style={{color:"var(--amber-500)"}}/>
            <h3 style={{ margin: 0, color: "var(--navy)", fontSize: 16 }}>1 critical issue must be resolved</h3>
          </div>
          <div style={{ padding: 14, background: "var(--rose-50)", border: "1px solid var(--rose-100)", borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
            <Pill color="rose" size="sm">Critical</Pill>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>Tag mismatch on segment #47</div>
              <div style={{ fontSize: 12, color: "var(--slate-600)" }}>Target is missing the closing {`{/1}`} tag</div>
            </div>
            <Button size="sm" variant="outline" icon={<Icons.ArrowRight size={12}/>}>Go to segment</Button>
          </div>
        </div>

        <div style={{ padding: 18 }}>
          <h4 style={{ margin: "0 0 14px", color: "var(--navy)", fontSize: 14 }}>Submission summary</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
            {[
              { l: "Confirmed", v: "481 / 482", c: "emerald" },
              { l: "QA — major", v: "0", c: "emerald" },
              { l: "QA — minor", v: "3", c: "amber" },
              { l: "Avg time/segment", v: "1m 18s", c: "navy" },
            ].map((s, i) => (
              <div key={i} style={{ padding: "14px 18px", borderRight: i < 3 ? "1px solid var(--border-soft)" : "" }}>
                <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: s.c === "amber" ? "var(--amber-600)" : s.c === "navy" ? "var(--navy)" : "var(--emerald-600)" }}>{s.v}</div>
                <div style={{ fontSize: 11.5, color: "var(--slate-500)", marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 18, borderTop: "1px solid var(--border-soft)" }}>
          <h4 style={{ margin: "0 0 12px", color: "var(--navy)", fontSize: 14 }}>What happens on submit</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { i: <Icons.Database size={13}/>, t: "312 new TM units saved to Acme EN→FR Master" },
              { i: <Icons.Send size={13}/>, t: "Translated XLIFF posted to Acme TMS via webhook" },
              { i: <Icons.Lock size={13}/>, t: "Job locked — further edits require unlock by PM" },
              { i: <Icons.Bell size={13}/>, t: "Sarah Park (PM) notified for final review" },
            ].map((x, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--slate-700)" }}>
                <span style={{ width: 24, height: 24, borderRadius: 6, background: "var(--bg-blue)", color: "var(--teal)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{x.i}</span>
                {x.t}
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 18, borderTop: "1px solid var(--border-soft)" }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "var(--navy)", marginBottom: 6 }}>Optional note to Sarah</label>
          <textarea placeholder="Anything she should know? Tricky decisions, source ambiguities…" style={{ width: "100%", padding: 12, border: "1px solid var(--slate-200)", borderRadius: 8, fontSize: 13, minHeight: 70, fontFamily: "inherit" }}/>
        </div>

        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)", background: "var(--slate-50)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate-700)" }}>
            <input type="checkbox" defaultChecked style={{accentColor:"var(--teal)"}}/>
            I confirm this translation is ready for delivery.
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost">Cancel</Button>
            <Button variant="success" size="md" icon={<Icons.Send size={14}/>} onClick={() => setStep("done")}>Submit job to Acme</Button>
          </div>
        </div>
      </div>
    </TRLayout>
  );
};

Object.assign(window, { TR_NAV, TRLayout, TR1_Queue, TR2_Editor, TR3_Comments, TR4_Submit });
