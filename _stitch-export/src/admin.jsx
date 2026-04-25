// Admin screens AD1-AD7

const ADMIN_NAV = [
  { id: "dashboard", label: "Dashboard", icon: <Icons.Home size={16}/> },
  { id: "tm", label: "Translation Memory", icon: <Icons.Database size={16}/> },
  { id: "termbase", label: "Termbases", icon: <Icons.Book size={16}/> },
  { id: "qa", label: "QA Profiles", icon: <Icons.Shield size={16}/> },
  { id: "languages", label: "Languages", icon: <Icons.Globe size={16}/> },
  { id: "mt", label: "MT Engines", icon: <Icons.Sparkles size={16}/> },
  { id: "users", label: "Users", icon: <Icons.Users size={16}/> },
  { id: "integrations", label: "Integrations", icon: <Icons.Layers size={16}/> },
  { id: "audit", label: "Audit Log", icon: <Icons.Activity size={16}/> },
  { id: "settings", label: "Settings", icon: <Icons.Settings size={16}/> },
];

const AdminLayout = ({ active, onNav, breadcrumb, actions, children, user, onSearchOpen, onNotifOpen, onLogout }) => (
  <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-app)" }}>
    <Sidebar items={ADMIN_NAV} active={active} onChange={onNav} role="Admin" user={user} onLogout={onLogout}/>
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <TopBar breadcrumb={breadcrumb} actions={actions} user={user} onSearchOpen={onSearchOpen} onNotifOpen={onNotifOpen}/>
      <main style={{ flex: 1, padding: "28px 32px", maxWidth: 1400, width: "100%" }}>{children}</main>
    </div>
  </div>
);

// AD1 — Admin Dashboard
const AD1_Dashboard = (props) => (
  <AdminLayout {...props} active="dashboard" breadcrumb={["Dashboard"]}>
    <PageHeader title="Welcome back, James" subtitle="Here's what's happening across your CAT workspace today." />

    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
      <Stat label="Active jobs" value="64" sub="across 12 clients" icon={<Icons.Briefcase size={16}/>} trend={8}/>
      <Stat label="TM units" value="4.2M" sub="+18.4K this week" icon={<Icons.Database size={16}/>} trend={2}/>
      <Stat label="Termbase entries" value="18,304" sub="across 14 termbases" icon={<Icons.Book size={16}/>} />
      <Stat label="Avg TM leverage" value="58%" sub="last 30 days" icon={<Icons.TrendingUp size={16}/>} trend={4}/>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, marginBottom: 16 }}>
      <Section title="Leverage trend — last 30 days" action={<Pill color="slate" size="sm">Stacked</Pill>}>
        <div style={{ display: "flex", gap: 18, fontSize: 12, marginBottom: 12, color: "var(--slate-600)" }}>
          {[
            { c: "var(--emerald-500)", l: "100%" },
            { c: "var(--lime-500)", l: "95-99%" },
            { c: "var(--amber-500)", l: "75-94%" },
            { c: "var(--slate-300)", l: "No match" },
          ].map((x, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: x.c }}/>{x.l}
            </span>
          ))}
        </div>
        <StackedArea
          labels={Array.from({length: 14}, (_, i) => i)}
          series={[
            { color: "var(--emerald-500)", data: [12,14,16,15,18,20,22,21,19,22,24,26,28,30] },
            { color: "var(--lime-500)", data: [8,9,10,11,12,11,13,14,12,14,15,16,15,17] },
            { color: "var(--amber-500)", data: [10,11,9,12,13,12,14,16,15,17,18,17,19,20] },
            { color: "var(--slate-300)", data: [6,7,5,8,7,9,10,9,8,10,11,10,12,13] },
          ]}
          height={180}
        />
      </Section>

      <Section title="QA issues by severity" action={<Pill color="slate" size="sm">Last 7d</Pill>}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Donut size={140} thickness={22} segments={[
            { value: 8, color: "var(--rose-500)" },
            { value: 24, color: "var(--amber-500)" },
            { value: 52, color: "var(--slate-300)" },
          ]}/>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { c: "var(--rose-500)", l: "Critical", v: 8 },
              { c: "var(--amber-500)", l: "Major", v: 24 },
              { c: "var(--slate-400)", l: "Minor", v: 52 },
            ].map((x, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate-700)" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: x.c }}/>{x.l}
                </span>
                <span style={{ fontWeight: 700, color: "var(--navy)" }}>{x.v}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 16 }}>
      <Section title="Top language pairs by activity">
        <BarList items={[
          { label: <span style={{display:"inline-flex",alignItems:"center",gap:8}}><FlagPair from="EN" to="FR"/> EN → FR</span>, value: 1242000, display: "1.24M words" },
          { label: <span style={{display:"inline-flex",alignItems:"center",gap:8}}><FlagPair from="EN" to="ES"/> EN → ES</span>, value: 980000, display: "980K words" },
          { label: <span style={{display:"inline-flex",alignItems:"center",gap:8}}><FlagPair from="EN" to="DE"/> EN → DE</span>, value: 620000, display: "620K words" },
          { label: <span style={{display:"inline-flex",alignItems:"center",gap:8}}><FlagPair from="EN" to="JA"/> EN → JA</span>, value: 410000, display: "410K words" },
          { label: <span style={{display:"inline-flex",alignItems:"center",gap:8}}><FlagPair from="EN" to="PT"/> EN → PT</span>, value: 312000, display: "312K words" },
        ]}/>
      </Section>

      <Section title="MT engine usage">
        <BarList items={[
          { label: "DeepL", value: 64, display: "64%", color: "var(--teal)" },
          { label: "Google Cloud", value: 28, display: "28%", color: "var(--navy)" },
          { label: "Custom NMT", value: 8, display: "8%", color: "var(--purple-500)" },
        ]} max={100}/>
      </Section>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
      <Section title="System health">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { l: "API", s: "Operational", c: "emerald", icon: <Icons.Server size={14}/>, bar: null },
            { l: "MT quota", s: "78% used", c: "amber", icon: <Icons.Sparkles size={14}/>, bar: 78 },
            { l: "Storage", s: "Healthy", c: "emerald", icon: <Icons.Cloud size={14}/>, bar: 34 },
            { l: "Webhook delivery", s: "99.4% success", c: "emerald", icon: <Icons.Zap size={14}/>, bar: null },
          ].map((x, i) => (
            <div key={i} style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>
                  <span style={{ color: "var(--slate-400)" }}>{x.icon}</span>{x.l}
                </span>
                <Pill color={x.c} size="sm">{x.s}</Pill>
              </div>
              {x.bar != null && <ProgressBar value={x.bar} color={x.c === "amber" ? "var(--amber-500)" : "var(--teal)"} height={6}/>}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Recent activity">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { i: <Icons.Database size={14}/>, c: "teal", t: "TM 'Legal Master EN→DE' imported", w: "James", time: "12 min ago" },
            { i: <Icons.AlertCircle size={14}/>, c: "rose", t: "Term 'team→groupe' marked forbidden", w: "Sarah", time: "1 hr ago" },
            { i: <Icons.Shield size={14}/>, c: "amber", t: "QA Profile 'Marketing strict' updated", w: "James", time: "2 hr ago" },
            { i: <Icons.Briefcase size={14}/>, c: "navy", t: "Job J-2026-04-381 ingested from TMS", w: "System", time: "3 hr ago" },
          ].map((x, i) => (
            <div key={i} style={{ display: "flex", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `var(--${x.c === "navy" ? "bg-blue" : x.c === "teal" ? "teal-50" : x.c === "rose" ? "rose-50" : "amber-50"})`, color: `var(--${x.c === "navy" ? "navy" : x.c === "teal" ? "teal" : x.c+"-500"})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{x.i}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "var(--navy)" }}>{x.t}</div>
                <div style={{ fontSize: 11.5, color: "var(--slate-500)", marginTop: 2 }}>{x.w} · {x.time}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  </AdminLayout>
);

// AD2 — TM List + Detail
const AD2_TM = (props) => {
  const [view, setView] = React.useState("list");
  const [selectedUnit, setSelectedUnit] = React.useState(null);

  if (view === "list") {
    return (
      <AdminLayout {...props} active="tm" breadcrumb={["Translation Memories"]}>
        <PageHeader title="Translation Memories" subtitle="Reusable bilingual data shared across jobs."
          actions={<>
            <Button variant="outline" icon={<Icons.Upload size={14}/>}>Import TMX</Button>
            <Button icon={<Icons.Plus size={14}/>}>Create TM</Button>
          </>} />

        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: 16, borderBottom: "1px solid var(--border-soft)", display: "flex", gap: 10 }}>
            <Input full={false} placeholder="Search TMs by name…" icon={<Icons.Search size={14}/>} style={{ width: 280 }}/>
            <div style={{ flex: 1 }}/>
            <Tabs variant="pills" tabs={[{id:"all",label:"All"},{id:"global",label:"Global"},{id:"client",label:"Client"},{id:"project",label:"Project"}]} active="all" onChange={()=>{}}/>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--slate-50)", textAlign: "left" }}>
                {["Name", "Pair", "Scope", "Units", "Last updated", "Used in jobs", ""].map(h => (
                  <th key={h} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: 0.4, borderBottom: "1px solid var(--border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TM_LIST.map((tm, i) => (
                <tr key={i} onClick={() => setView("detail")} style={{ borderBottom: "1px solid var(--border-soft)", cursor: "pointer" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--slate-50)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = ""}>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: "var(--navy)" }}>{tm.name}</td>
                  <td style={{ padding: "14px 16px" }}><FlagPair from={tm.from} to={tm.to}/></td>
                  <td style={{ padding: "14px 16px" }}><Pill color={tm.scope==="Global"?"navy":tm.scope==="Client"?"emerald":"amber"} size="sm">{tm.scope}</Pill></td>
                  <td style={{ padding: "14px 16px", color: "var(--slate-700)", fontWeight: 500 }} className="mono">{tm.units.toLocaleString()}</td>
                  <td style={{ padding: "14px 16px", color: "var(--slate-500)" }}>{tm.updated}</td>
                  <td style={{ padding: "14px 16px", color: "var(--slate-700)" }}>{tm.jobs}</td>
                  <td style={{ padding: "14px 16px", textAlign: "right" }}>
                    <button style={{ color: "var(--slate-400)", padding: 6 }}><Icons.MoreH size={16}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminLayout>
    );
  }

  // detail
  const [tab, setTab] = React.useState("units");
  return (
    <AdminLayout {...props} active="tm" breadcrumb={[<a key="b" onClick={() => setView("list")} style={{cursor:"pointer"}}>TMs</a>, "Acme EN→FR Master"]}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--navy)", margin: 0, letterSpacing: -0.5 }}>Acme EN→FR Master</h1>
            <button style={{ color: "var(--slate-400)" }}><Icons.Edit size={14}/></button>
            <FlagPair from="EN" to="FR" size={18}/>
            <Pill color="emerald" size="sm">Client · Acme</Pill>
          </div>
          <div style={{ display: "flex", gap: 24, marginTop: 10, fontSize: 13, color: "var(--slate-500)" }}>
            <span><b style={{color:"var(--navy)"}} className="mono">1,284,302</b> units</span>
            <span><b style={{color:"var(--navy)"}}>18</b> jobs using</span>
            <span>Updated <b style={{color:"var(--navy)"}}>2 min ago</b></span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="outline" size="sm" icon={<Icons.Upload size={13}/>}>Import TMX</Button>
          <Button variant="outline" size="sm" icon={<Icons.Download size={13}/>}>Export TMX</Button>
          <Button variant="outline" size="sm" icon={<Icons.Refresh size={13}/>}>Maintenance</Button>
          <Button variant="outline" size="sm" icon={<Icons.Settings size={13}/>}>Settings</Button>
        </div>
      </div>

      <Tabs tabs={[{id:"units",label:"Units"},{id:"concordance",label:"Concordance"},{id:"imports",label:"Imports"},{id:"maint",label:"Maintenance"},{id:"settings",label:"Settings"}]} active={tab} onChange={setTab} style={{marginBottom: 16}}/>

      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: 14, borderBottom: "1px solid var(--border-soft)", display: "flex", gap: 8, alignItems: "center" }}>
          <Input full={false} placeholder="Search source or target — supports regex" icon={<Icons.Search size={14}/>} style={{ width: 360 }}/>
          <Button variant="outline" size="sm" icon={<Icons.Filter size={13}/>}>Filters</Button>
          <span style={{ fontSize: 12, color: "var(--slate-500)" }}>Created date · Created by · Has note · Has issue</span>
          <div style={{ flex: 1 }}/>
          <span style={{ fontSize: 12, color: "var(--slate-500)" }}>Showing 1–10 of <b className="mono">1.28M</b></span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--slate-50)", textAlign: "left" }}>
              {["Source", "Target", "Quality", "Created by", "Updated", "Status", ""].map(h => (
                <th key={h} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: 0.4, borderBottom: "1px solid var(--border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TM_UNITS.map((u, i) => (
              <tr key={i} onClick={() => setSelectedUnit(u)} style={{ borderBottom: "1px solid var(--border-soft)", cursor: "pointer", background: selectedUnit === u ? "var(--bg-blue)" : "" }}
                onMouseEnter={(e) => { if (selectedUnit !== u) e.currentTarget.style.background = "var(--slate-50)"; }}
                onMouseLeave={(e) => { if (selectedUnit !== u) e.currentTarget.style.background = ""; }}>
                <td style={{ padding: "12px 16px", color: "var(--navy)", maxWidth: 280 }} className="mono"><div className="truncate">{u.src}</div></td>
                <td style={{ padding: "12px 16px", color: "var(--slate-700)", maxWidth: 280 }} className="mono"><div className="truncate">{u.tgt}</div></td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ display: "inline-flex", gap: 1 }}>{[1,2,3,4,5].map(n => <Icons.Star key={n} size={11} stroke={0} style={{ fill: n <= u.quality ? "var(--amber-500)" : "var(--slate-200)" }}/>)}</span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Avatar name={u.by} size={20}/>
                    <span style={{ fontSize: 12.5, color: "var(--slate-700)" }}>{u.by}</span>
                  </span>
                </td>
                <td style={{ padding: "12px 16px", color: "var(--slate-500)", fontSize: 12 }}>{u.updated}</td>
                <td style={{ padding: "12px 16px" }}><Pill color={u.status==="Active"?"emerald":"rose"} size="sm">{u.status}</Pill></td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                  {u.note && <Icons.MessageCircle size={14} style={{color:"var(--slate-400)"}}/>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail drawer */}
      {selectedUnit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(12,35,64,0.4)", zIndex: 100, display: "flex", justifyContent: "flex-end" }} onClick={() => setSelectedUnit(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: 640, height: "100vh", background: "#fff", boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column", animation: "slideIn 200ms ease" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--slate-500)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>TM Unit · #18,4203</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)", marginTop: 2 }}>Edit unit</div>
              </div>
              <button onClick={() => setSelectedUnit(null)} style={{ color: "var(--slate-400)", padding: 6 }}><Icons.X size={18}/></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--slate-500)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><Flag code="EN"/> EN — Source</div>
                <textarea defaultValue={selectedUnit.src} style={{ width: "100%", padding: 12, border: "1px solid var(--slate-200)", borderRadius: 8, fontSize: 14, minHeight: 80, fontFamily: "JetBrains Mono", color: "var(--navy)" }}/>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--slate-500)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><Flag code="FR"/> FR — Target</div>
                <textarea defaultValue={selectedUnit.tgt} style={{ width: "100%", padding: 12, border: "1px solid var(--slate-200)", borderRadius: 8, fontSize: 14, minHeight: 80, fontFamily: "JetBrains Mono", color: "var(--navy)" }}/>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Input label="Domain" defaultValue="Marketing"/>
                <Input label="Client" defaultValue="Acme"/>
                <Input label="Project ref" defaultValue="ACME-Q2-LANDING"/>
                <Input label="Note" defaultValue="Use 'coéquipiers' for team-warmth contexts."/>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", marginBottom: 8 }}>Version history</div>
                {[
                  { v: "v3", who: "Maria Chen", date: "2 min ago", note: "Polished phrasing" },
                  { v: "v2", who: "Lena Vogt", date: "Yesterday", note: "Imported from TMX" },
                  { v: "v1", who: "Auto-import", date: "3 mo ago" },
                ].map((h, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < 2 ? "1px solid var(--border-soft)" : "" }}>
                    <Pill size="sm" color="navy">{h.v}</Pill>
                    <Avatar name={h.who} size={20}/>
                    <span style={{ fontSize: 13, color: "var(--navy)" }}>{h.who}</span>
                    <span style={{ fontSize: 12, color: "var(--slate-500)", flex: 1 }}>{h.note}</span>
                    <span style={{ fontSize: 12, color: "var(--slate-500)" }}>{h.date}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: 16, borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="danger-outline" size="sm" icon={<Icons.AlertCircle size={13}/>}>Mark forbidden</Button>
                <Button variant="danger-outline" size="sm" icon={<Icons.Trash size={13}/>}>Delete unit</Button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" size="sm" onClick={() => setSelectedUnit(null)}>Cancel</Button>
                <Button size="sm">Save changes</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

// AD3 — Termbase Detail
const AD3_Termbase = (props) => {
  const concepts = [
    { id: 1, term: "team", domain: "Brand", status: "Approved", forbidden: false },
    { id: 2, term: "collaborate", domain: "Brand", status: "Approved", forbidden: false },
    { id: 3, term: "real time", domain: "Tech", status: "Approved", forbidden: false },
    { id: 4, term: "synergy", domain: "Brand", status: "Forbidden", forbidden: true },
    { id: 5, term: "leverage", domain: "Brand", status: "Pending", forbidden: false },
    { id: 6, term: "click here", domain: "UI", status: "Forbidden", forbidden: true },
    { id: 7, term: "sign in", domain: "UI", status: "Approved", forbidden: false },
  ];
  const [active, setActive] = React.useState(1);
  const c = concepts.find(x => x.id === active);

  return (
    <AdminLayout {...props} active="termbase" breadcrumb={["Termbases", "Acme Brand Glossary"]}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--navy)", margin: 0, letterSpacing: -0.5 }}>Acme Brand Glossary</h1>
            <button style={{ color: "var(--slate-400)" }}><Icons.Edit size={14}/></button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {["EN","FR","ES","DE"].map(c => (
              <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", background: "var(--slate-50)", border: "1px solid var(--border)", borderRadius: 999, fontSize: 12, fontWeight: 600, color: "var(--navy)" }}>
                <Flag code={c} size={14}/>{c}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="outline" size="sm" icon={<Icons.Upload size={13}/>}>Import TBX</Button>
          <Button variant="outline" size="sm" icon={<Icons.Download size={13}/>}>Export</Button>
          <Button size="sm" icon={<Icons.Plus size={13}/>}>Add concept</Button>
        </div>
      </div>

      <Tabs tabs={["Concepts","Imports","Settings"]} active="Concepts" onChange={()=>{}} style={{marginBottom: 16}}/>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, minHeight: 600 }}>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 12, borderBottom: "1px solid var(--border-soft)", display: "flex", flexDirection: "column", gap: 8 }}>
            <Input placeholder="Search concepts…" icon={<Icons.Search size={14}/>}/>
            <div style={{ display: "flex", gap: 6 }}>
              <Pill size="sm" color="emerald">All</Pill>
              <Pill size="sm" color="grey">Approved</Pill>
              <Pill size="sm" color="grey">Pending</Pill>
              <Pill size="sm" color="grey">Forbidden</Pill>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {concepts.map(c => (
              <button key={c.id} onClick={() => setActive(c.id)} style={{
                width: "100%", textAlign: "left", padding: "12px 16px",
                background: active === c.id ? "var(--bg-blue)" : "transparent",
                borderLeft: `3px solid ${active === c.id ? "var(--teal)" : "transparent"}`,
                borderBottom: "1px solid var(--border-soft)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, color: "var(--navy)", fontSize: 14, textDecoration: c.forbidden ? "line-through" : "none" }}>{c.term}</span>
                  {c.forbidden && <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--rose-500)" }}/>}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <Pill size="sm" color="grey">{c.domain}</Pill>
                  <Pill size="sm" color={c.status === "Approved" ? "emerald" : c.status === "Forbidden" ? "rose" : "amber"}>{c.status}</Pill>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 20, borderBottom: "1px solid var(--border-soft)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--slate-500)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Concept ID · ACM-{String(c.id).padStart(4, "0")}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--navy)", marginTop: 2, textDecoration: c.forbidden ? "line-through" : "" }}>{c.term}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select style={{ padding: "6px 10px", border: "1px solid var(--slate-200)", borderRadius: 8, fontSize: 13, background: "#fff", color: "var(--navy)" }}>
                  <option>{c.domain}</option><option>UI</option><option>Tech</option>
                </select>
              </div>
            </div>
            <textarea defaultValue="A group of people working together on shared goals. In Acme contexts, prefer warm, inclusive language." style={{ width: "100%", padding: 12, border: "1px solid var(--slate-200)", borderRadius: 8, fontSize: 13.5, minHeight: 60, color: "var(--navy)" }} placeholder="Definition…"/>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { lang: "EN", code: "EN", terms: [{ t: c.term, pos: "noun", status: "Approved" }] },
              { lang: "FR — Français", code: "FR", terms: [
                { t: "équipe", pos: "noun", gender: "fem.", status: "Approved" },
                { t: "groupe", pos: "noun", gender: "masc.", status: "Forbidden" },
              ]},
              { lang: "ES — Español", code: "ES", terms: [{ t: "equipo", pos: "noun", gender: "masc.", status: "Approved" }] },
              { lang: "DE — Deutsch", code: "DE", terms: [{ t: "Team", pos: "noun", gender: "neuter", status: "Approved" }] },
            ].map((sec, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10 }}>
                <div style={{ padding: "10px 14px", background: "var(--slate-50)", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-soft)" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600, color: "var(--navy)", fontSize: 13.5 }}>
                    <Flag code={sec.code} size={14}/>{sec.lang}
                  </div>
                  <button style={{ fontSize: 12, color: "var(--teal)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}><Icons.Plus size={12}/> Add term</button>
                </div>
                <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {sec.terms.map((t, j) => (
                    <div key={j} style={{ display: "grid", gridTemplateColumns: "1.5fr 100px 90px 1fr 130px", gap: 8, alignItems: "center" }}>
                      <input defaultValue={t.t} style={{ padding: "7px 10px", border: "1px solid var(--slate-200)", borderRadius: 6, fontSize: 13, color: "var(--navy)", textDecoration: t.status === "Forbidden" ? "line-through" : "none", background: t.status === "Forbidden" ? "var(--rose-50)" : "#fff" }}/>
                      <select defaultValue={t.pos} style={{ padding: "7px 10px", border: "1px solid var(--slate-200)", borderRadius: 6, fontSize: 12, background: "#fff", color: "var(--slate-700)" }}><option>noun</option><option>verb</option></select>
                      <select defaultValue={t.gender || "—"} style={{ padding: "7px 10px", border: "1px solid var(--slate-200)", borderRadius: 6, fontSize: 12, background: "#fff", color: "var(--slate-700)" }}><option>{t.gender || "—"}</option></select>
                      <input placeholder="Usage example…" defaultValue={j === 0 && i === 1 ? "Notre équipe travaille en temps réel." : ""} style={{ padding: "7px 10px", border: "1px solid var(--slate-200)", borderRadius: 6, fontSize: 12.5, color: "var(--slate-600)" }}/>
                      <select defaultValue={t.status} style={{ padding: "7px 10px", border: `1px solid ${t.status === "Forbidden" ? "var(--rose-100)" : t.status === "Approved" ? "var(--emerald-100)" : "var(--amber-100)"}`, borderRadius: 6, fontSize: 12, fontWeight: 600, background: t.status === "Forbidden" ? "var(--rose-50)" : t.status === "Approved" ? "var(--emerald-50)" : "var(--amber-50)", color: t.status === "Forbidden" ? "var(--rose-600)" : t.status === "Approved" ? "var(--emerald-700)" : "var(--amber-600)" }}>
                        <option>Approved</option><option>Pending</option><option>Forbidden</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: 14, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: 8 }}>
            <Button variant="danger-outline" size="sm" icon={<Icons.Trash size={13}/>}>Delete concept</Button>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="ghost" size="sm">Discard</Button>
              <Button size="sm">Save</Button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

// AD4 — QA Profiles
const AD4_QA = (props) => {
  const profiles = ["Default", "Marketing strict", "Legal", "Technical"];
  const [active, setActive] = React.useState("Marketing strict");
  const rules = [
    { name: "Tag mismatch", desc: "Inline tags missing or out of order", sev: "Critical", on: true },
    { name: "Number mismatch", desc: "Numeric values differ between source and target", sev: "Critical", on: true },
    { name: "Missing/extra spaces", desc: "Leading, trailing, or double spaces", sev: "Minor", on: true },
    { name: "Forbidden terms from termbase", desc: "Triggers when forbidden term is used", sev: "Major", on: true },
    { name: "Untranslated segment", desc: "Target identical to source where unexpected", sev: "Major", on: true },
    { name: "Identical source and target", desc: "Same as above, but for short strings", sev: "Minor", on: false },
    { name: "Length ratio", desc: "Target length / source length above threshold", sev: "Minor", on: true, slider: 25 },
    { name: "Repeated word", desc: "Same word repeated consecutively in target", sev: "Minor", on: true },
    { name: "Punctuation mismatch", desc: "Final punctuation differs", sev: "Minor", on: true },
  ];

  return (
    <AdminLayout {...props} active="qa" breadcrumb={["QA Profiles"]}>
      <PageHeader title="QA Profiles" subtitle="Quality assurance rules applied to translator output."
        actions={<Button icon={<Icons.Plus size={14}/>}>New profile</Button>} />

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16 }}>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          {profiles.map(p => (
            <button key={p} onClick={() => setActive(p)} style={{
              width: "100%", textAlign: "left", padding: "13px 16px",
              background: active === p ? "var(--bg-blue)" : "transparent",
              borderLeft: `3px solid ${active === p ? "var(--teal)" : "transparent"}`,
              borderBottom: "1px solid var(--border-soft)",
              fontSize: 13.5, fontWeight: 600, color: active === p ? "var(--teal-700)" : "var(--navy)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              {p}
              {p === "Default" && <Pill size="sm" color="grey">Default</Pill>}
            </button>
          ))}
        </div>

        <div>
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
              <Input label="Profile name" defaultValue={active}/>
              <Input label="Description" defaultValue="Aggressive checks for marketing copy — tag, number, length, and forbidden term mismatches block submission."/>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
            <Section title="Rule groups">
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {rules.map((r, i) => (
                  <div key={i} style={{ padding: "12px 0", borderBottom: i < rules.length - 1 ? "1px solid var(--border-soft)" : "" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Toggle checked={r.on} onChange={()=>{}}/>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--navy)" }}>{r.name}</div>
                        <div style={{ fontSize: 12, color: "var(--slate-500)" }}>{r.desc}</div>
                      </div>
                      <select defaultValue={r.sev} style={{ padding: "6px 10px", border: `1px solid ${r.sev === "Critical" ? "var(--rose-100)" : r.sev === "Major" ? "var(--amber-100)" : "var(--slate-200)"}`, borderRadius: 6, fontSize: 12, fontWeight: 600, color: r.sev === "Critical" ? "var(--rose-600)" : r.sev === "Major" ? "var(--amber-600)" : "var(--slate-600)", background: r.sev === "Critical" ? "var(--rose-50)" : r.sev === "Major" ? "var(--amber-50)" : "var(--slate-50)" }}>
                          <option>Critical</option><option>Major</option><option>Minor</option>
                        </select>
                      </div>
                    {r.slider && (
                      <div style={{ marginLeft: 52, marginTop: 8, display: "flex", alignItems: "center", gap: 12 }}>
                        <input type="range" min={5} max={100} defaultValue={r.slider} style={{ flex: 1, accentColor: "var(--teal)" }}/>
                        <span className="mono" style={{ fontSize: 12, color: "var(--slate-600)", fontWeight: 600 }}>±{r.slider}%</span>
                      </div>
                    )}
                  </div>
                ))}
                <div style={{ marginTop: 12, padding: 12, border: "1.5px dashed var(--slate-200)", borderRadius: 8, display: "flex", gap: 8, alignItems: "center" }}>
                  <input placeholder="Custom regex pattern…" className="mono" style={{ flex: 1, padding: "6px 10px", border: "1px solid var(--slate-200)", borderRadius: 6, fontSize: 12.5 }}/>
                  <input placeholder="Error message…" style={{ flex: 1, padding: "6px 10px", border: "1px solid var(--slate-200)", borderRadius: 6, fontSize: 12.5 }}/>
                  <Button size="sm" variant="outline" icon={<Icons.Plus size={12}/>}>Add</Button>
                </div>
              </div>
            </Section>

            <Section title="Live preview" action={<Pill size="sm" color="amber">3 issues</Pill>}>
              <div style={{ background: "var(--slate-50)", borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>Source</div>
                <div className="mono" style={{ fontSize: 13, color: "var(--navy)", marginBottom: 14 }}>Save up to <span style={{background:"var(--amber-100)",padding:"1px 4px",borderRadius:3}}>30%</span> on your annual plan. <span style={{background:"var(--rose-100)",padding:"1px 4px",borderRadius:3,color:"var(--rose-600)"}}>{`{1}`}</span>Click here{`{/1}`} to upgrade.</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>Target</div>
                <div className="mono" style={{ fontSize: 13, color: "var(--navy)" }}>Économisez jusqu'à <span style={{background:"var(--amber-100)",padding:"1px 4px",borderRadius:3}}>40%</span> sur votre forfait annuel. <span style={{background:"var(--rose-100)",padding:"1px 4px",borderRadius:3,color:"var(--rose-600)",textDecoration:"line-through"}}>Cliquez ici</span> pour mettre à niveau.</div>
              </div>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { sev: "Critical", c: "rose", t: "Number mismatch — '30%' vs '40%'" },
                  { sev: "Major", c: "amber", t: "Forbidden term — 'Cliquez ici' (use 'Cliquez pour…')" },
                  { sev: "Critical", c: "rose", t: "Tag mismatch — missing {/1} pair" },
                ].map((iss, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: `var(--${iss.c}-50)`, border: `1px solid var(--${iss.c}-100)`, borderRadius: 6 }}>
                    <Pill color={iss.c} size="sm">{iss.sev}</Pill>
                    <span style={{ fontSize: 12.5, color: "var(--navy)" }}>{iss.t}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <Button>Save profile</Button>
            <Button variant="outline">Set as default</Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

// AD5 — Users
const AD5_Users = (props) => {
  const users = [
    { name: "James Okonkwo", email: "james@cethos.com", role: "Admin", auth: "Email", langs: "—", status: "Active", last: "Just now" },
    { name: "Sarah Park", email: "sarah.park@cethos.com", role: "PM", auth: "Email", langs: "—", status: "Active", last: "12 min ago" },
    { name: "Maria Chen", email: "maria.chen@acme.com", role: "Translator", auth: "SSO", langs: "EN→FR, EN→ES", status: "Active", last: "2 hr ago" },
    { name: "Tomás Diaz", email: "tomas@freelance.dev", role: "Translator", auth: "SSO", langs: "EN→ES, EN→PT", status: "Active", last: "Yesterday" },
    { name: "Lena Vogt", email: "lena.vogt@vogt.de", role: "Translator", auth: "Email", langs: "EN→DE", status: "Active", last: "3 hr ago" },
    { name: "Akira Tanaka", email: "akira@tanaka-trans.jp", role: "Translator", auth: "SSO", langs: "EN→JA", status: "Active", last: "Yesterday" },
    { name: "Wei Lin", email: "wei.lin@translate.cn", role: "Translator", auth: "Email", langs: "EN→ZH", status: "Pending", last: "—" },
    { name: "Camille Laurent", email: "camille@laurent-trad.fr", role: "Translator", auth: "Email", langs: "EN→FR", status: "Suspended", last: "2 wks ago" },
  ];
  return (
    <AdminLayout {...props} active="users" breadcrumb={["Users"]}>
      <PageHeader title="Users" subtitle="Admin, PM, and direct-login translators. Vendor-portal translators are managed in the vendor portal."
        actions={<Button icon={<Icons.Plus size={14}/>}>Invite user</Button>} />

      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: 14, borderBottom: "1px solid var(--border-soft)", display: "flex", gap: 10, alignItems: "center" }}>
          <Tabs variant="pills" tabs={[{id:"all",label:"All",count:128},{id:"adm",label:"Admins",count:3},{id:"pm",label:"PMs",count:14},{id:"tr",label:"Translators",count:108},{id:"sus",label:"Suspended",count:3}]} active="all" onChange={()=>{}}/>
          <div style={{ flex: 1 }}/>
          <Input full={false} placeholder="Search users…" icon={<Icons.Search size={14}/>} style={{ width: 240 }}/>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--slate-50)" }}>
              <th style={{ width: 40, padding: "10px 16px" }}><input type="checkbox"/></th>
              {["User","Role","Auth source","Languages","Status","Last active",""].map(h => (
                <th key={h} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: 0.4, borderBottom: "1px solid var(--border)", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                <td style={{ padding: "12px 16px" }}><input type="checkbox"/></td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={u.name} size={32}/>
                    <span>
                      <div style={{ fontWeight: 600, color: "var(--navy)" }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: "var(--slate-500)" }}>{u.email}</div>
                    </span>
                  </span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <Pill color={u.role === "Admin" ? "navy" : u.role === "PM" ? "purple" : "teal"} size="sm">{u.role}</Pill>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <Pill color={u.auth === "Email" ? "indigo" : "emerald"} size="sm" icon={u.auth === "Email" ? <Icons.Mail size={10}/> : <Icons.Globe size={10}/>}>{u.auth === "Email" ? "Email" : "SSO from vendor portal"}</Pill>
                </td>
                <td style={{ padding: "12px 16px", color: "var(--slate-700)", fontSize: 12.5 }}>{u.langs}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--slate-700)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: u.status === "Active" ? "var(--emerald-500)" : u.status === "Pending" ? "var(--amber-500)" : "var(--slate-400)" }}/>{u.status}
                  </span>
                </td>
                <td style={{ padding: "12px 16px", color: "var(--slate-500)", fontSize: 12 }}>{u.last}</td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}><button style={{ color: "var(--slate-400)", padding: 6 }}><Icons.MoreH size={16}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: 12, borderTop: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: "var(--slate-500)" }}>
          <span>Showing 1–8 of 128</span>
          <div style={{ display: "flex", gap: 4 }}>
            <Button size="sm" variant="outline">Previous</Button>
            <Button size="sm" variant="outline">Next</Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

// AD6 — Integrations
const AD6_Integrations = (props) => {
  const intCard = ({ title, status, statusColor, icon, body, key }) => (
    <div key={key} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--bg-blue)", color: "var(--teal)", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)" }}>{title}</div>
          </div>
        </div>
        <Pill color={statusColor} size="sm" icon={<span style={{ width: 6, height: 6, borderRadius: 999, background: `var(--${statusColor}-500)` }}/>}>{status}</Pill>
      </div>
      {body}
    </div>
  );
  return (
    <AdminLayout {...props} active="integrations" breadcrumb={["Integrations"]}>
      <PageHeader title="Integrations" subtitle="Connect Cethos to your TMS, vendor portal, MT engines, and webhooks."/>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {intCard({
          title: "Vendor Portal SSO", status: "Connected", statusColor: "emerald", icon: <Icons.Key size={20}/>,
          body: <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <Input label="JWT issuer URL" defaultValue="https://portal.cethos.com/sso"/>
              <Input label="Allowed audience" defaultValue="cethos-cat-prod"/>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--navy)", marginBottom: 6 }}>Public key</div>
              <div className="mono" style={{ padding: 10, background: "var(--slate-50)", border: "1px solid var(--slate-200)", borderRadius: 8, fontSize: 11.5, color: "var(--slate-700)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="truncate">-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOC…</span>
                <button style={{ color: "var(--slate-500)", padding: 4 }}><Icons.Copy size={14}/></button>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--navy)", marginBottom: 6 }}>Expected claims</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["sub","email","translator_id","language_pairs","job_ref"].map(c => <Pill key={c} color="grey" size="sm">{c}</Pill>)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Button size="sm" variant="outline" icon={<Icons.Refresh size={13}/>}>Rotate keys</Button>
              <Button size="sm" icon={<Icons.Zap size={13}/>}>Test handshake</Button>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--slate-500)" }}>Last tested 4 min ago</span>
            </div>
          </>
        })}
        {intCard({
          title: "TMS Job Push API", status: "Active", statusColor: "emerald", icon: <Icons.Zap size={20}/>,
          body: <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--navy)", marginBottom: 6 }}>API key</div>
                <div className="mono" style={{ padding: "8px 10px", background: "var(--slate-50)", border: "1px solid var(--slate-200)", borderRadius: 8, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>cth_••••••••••a9f3</span>
                  <span style={{ display: "flex", gap: 4 }}><button style={{padding:4,color:"var(--slate-500)"}}><Icons.Eye size={13}/></button><button style={{padding:4,color:"var(--slate-500)"}}><Icons.Copy size={13}/></button></span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--navy)", marginBottom: 6 }}>Endpoint</div>
                <div className="mono" style={{ padding: "8px 10px", background: "var(--slate-50)", border: "1px solid var(--slate-200)", borderRadius: 8, fontSize: 12, color: "var(--slate-700)" }}>POST /api/jobs/ingest</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--navy)", marginBottom: 6 }}>Recent ingest events</div>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              {[
                { t: "14:32:18", j: "J-2026-04-381", s: "200 OK", c: "emerald", d: "184ms" },
                { t: "14:18:02", j: "J-2026-04-380", s: "200 OK", c: "emerald", d: "112ms" },
                { t: "13:48:11", j: "J-2026-04-379", s: "200 OK", c: "emerald", d: "201ms" },
                { t: "13:02:55", j: "J-2026-04-378", s: "422 invalid", c: "rose", d: "62ms" },
              ].map((e, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td className="mono" style={{ padding: "6px 0", color: "var(--slate-500)" }}>{e.t}</td>
                  <td className="mono" style={{ padding: "6px 8px", color: "var(--navy)" }}>{e.j}</td>
                  <td style={{ padding: "6px 8px" }}><Pill color={e.c} size="sm">{e.s}</Pill></td>
                  <td className="mono" style={{ padding: "6px 0", color: "var(--slate-500)", textAlign: "right" }}>{e.d}</td>
                </tr>
              ))}
            </table>
          </>
        })}
        {intCard({
          title: "MT Engines", status: "3 active", statusColor: "emerald", icon: <Icons.Sparkles size={20}/>,
          body: <>
            {[
              { name: "DeepL", tier: "Pro · 500K words/mo", quota: 78, on: true, c: "var(--teal)" },
              { name: "Google Cloud Translation", tier: "Pay-as-you-go", quota: 22, on: true, c: "var(--navy)" },
              { name: "Custom NMT", tier: "https://mt.acme-internal.io", quota: 4, on: true, c: "var(--purple-500)" },
            ].map((e, i) => (
              <div key={i} style={{ padding: "12px 0", borderBottom: i < 2 ? "1px solid var(--border-soft)" : "" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--navy)", fontSize: 13.5 }}>{e.name}</div>
                    <div style={{ fontSize: 12, color: "var(--slate-500)" }}>{e.tier}</div>
                  </div>
                  <Toggle checked={e.on} onChange={()=>{}} size="sm"/>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <ProgressBar value={e.quota} color={e.c} height={5}/>
                  <span className="mono" style={{ fontSize: 11, color: "var(--slate-500)", minWidth: 36 }}>{e.quota}%</span>
                </div>
              </div>
            ))}
          </>
        })}
        {intCard({
          title: "Webhooks", status: "Healthy", statusColor: "emerald", icon: <Icons.Link size={20}/>,
          body: <>
            {[
              { e: "job_complete", url: "https://acme.tms.io/webhooks/cethos", s: "99.8%", t: "12 min ago" },
              { e: "qa_threshold_exceeded", url: "https://hooli.io/api/cethos-qa", s: "100%", t: "2 hr ago" },
              { e: "tm_updated", url: "https://internal.acme.com/sync", s: "98.2%", t: "Yesterday" },
            ].map((w, i) => (
              <div key={i} style={{ padding: "12px 0", borderBottom: i < 2 ? "1px solid var(--border-soft)" : "" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <code className="mono" style={{ fontSize: 12, color: "var(--teal)", fontWeight: 600 }}>{w.e}</code>
                  <Pill color="emerald" size="sm">{w.s}</Pill>
                </div>
                <div className="mono" style={{ fontSize: 11.5, color: "var(--slate-500)" }} ><div className="truncate">{w.url}</div></div>
                <div style={{ fontSize: 11.5, color: "var(--slate-400)", marginTop: 2 }}>Last fired {w.t}</div>
              </div>
            ))}
          </>
        })}
      </div>
    </AdminLayout>
  );
};

// AD7 — Audit Log
const AD7_Audit = (props) => {
  const [selected, setSelected] = React.useState(null);
  const actionColor = (a) => ({
    sign_in: "navy", tm_unit_create: "teal", tm_import: "teal",
    termbase_entry_forbid: "rose", settings_change: "amber",
    job_create: "purple", job_assign: "purple", job_complete: "emerald",
  }[a] || "slate");

  return (
    <AdminLayout {...props} active="audit" breadcrumb={["Audit Log"]}>
      <PageHeader title="Audit Log" subtitle="Every meaningful action across the workspace, retained for 18 months."
        actions={<Button variant="outline" icon={<Icons.Download size={14}/>}>Export CSV</Button>} />

      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: 14, borderBottom: "1px solid var(--border-soft)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Input full={false} placeholder="Actor or resource…" icon={<Icons.Search size={14}/>} style={{ width: 240 }}/>
          <Button variant="outline" size="sm" icon={<Icons.Filter size={13}/>}>All actions ▾</Button>
          <Button variant="outline" size="sm" icon={<Icons.Calendar size={13}/>}>Last 24h ▾</Button>
          <div style={{ flex: 1 }}/>
          <span style={{ fontSize: 12, color: "var(--slate-500)" }}>284 events · auto-refresh on</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "var(--slate-50)" }}>
              {["Timestamp","Actor","Action","Target","IP","User agent",""].map(h => (
                <th key={h} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: 0.4, borderBottom: "1px solid var(--border)", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AUDIT_LOG.map((e, i) => (
              <tr key={i} onClick={() => setSelected(e)} style={{ borderBottom: "1px solid var(--border-soft)", cursor: "pointer", background: selected === e ? "var(--bg-blue)" : "" }}>
                <td className="mono" style={{ padding: "10px 16px", color: "var(--slate-500)", fontSize: 11.5 }}>{e.ts.replace("T", " ").replace("Z","")}</td>
                <td style={{ padding: "10px 16px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Avatar name={e.actor} size={20}/>
                    <span style={{ color: "var(--navy)", fontWeight: 500 }}>{e.actor}</span>
                  </span>
                </td>
                <td style={{ padding: "10px 16px" }}><Pill color={actionColor(e.action)} size="sm">{e.action}</Pill></td>
                <td style={{ padding: "10px 16px", color: "var(--teal)", fontWeight: 500 }}>{e.target}</td>
                <td className="mono" style={{ padding: "10px 16px", color: "var(--slate-500)", fontSize: 11.5 }}>{e.ip}</td>
                <td style={{ padding: "10px 16px", color: "var(--slate-500)", fontSize: 11.5 }} className="truncate">Mozilla/5.0…</td>
                <td style={{ padding: "10px 16px", textAlign: "right" }}><button style={{ color: "var(--slate-400)", padding: 4 }}><Icons.ChevronRight size={14}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(12,35,64,0.4)", zIndex: 100, display: "flex", justifyContent: "flex-end" }} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: 560, height: "100vh", background: "#fff", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <Pill color={actionColor(selected.action)} size="sm">{selected.action}</Pill>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)", marginTop: 6 }}>{selected.target}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ color: "var(--slate-400)", padding: 6 }}><Icons.X size={18}/></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                {[
                  { l: "Timestamp", v: selected.ts },
                  { l: "Actor", v: selected.actor },
                  { l: "IP", v: selected.ip },
                  { l: "Session", v: "sess_8a3f9210" },
                ].map((x, i) => (
                  <div key={i} style={{ padding: 10, background: "var(--slate-50)", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "var(--slate-500)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{x.l}</div>
                    <div className="mono" style={{ fontSize: 12.5, color: "var(--navy)", marginTop: 2 }}>{x.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", marginBottom: 8 }}>Diff</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ padding: 12, background: "var(--rose-50)", border: "1px solid var(--rose-100)", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--rose-600)", marginBottom: 6 }}>BEFORE</div>
                  <pre className="mono" style={{ fontSize: 11.5, color: "var(--slate-700)", margin: 0, whiteSpace: "pre-wrap" }}>{`{
  "lengthRatio": 25,
  "blocking": false,
  "rules": 8
}`}</pre>
                </div>
                <div style={{ padding: 12, background: "var(--emerald-50)", border: "1px solid var(--emerald-100)", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--emerald-700)", marginBottom: 6 }}>AFTER</div>
                  <pre className="mono" style={{ fontSize: 11.5, color: "var(--slate-700)", margin: 0, whiteSpace: "pre-wrap" }}>{`{
  "lengthRatio": 20,
  "blocking": true,
  "rules": 9
}`}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

Object.assign(window, { ADMIN_NAV, AdminLayout, AD1_Dashboard, AD2_TM, AD3_Termbase, AD4_QA, AD5_Users, AD6_Integrations, AD7_Audit });
