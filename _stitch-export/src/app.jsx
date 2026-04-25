// App router with role switcher

const SCREEN_GROUPS = {
  Auth: [
    { id: "A1", label: "A1 Sign in", c: A1_SignIn },
    { id: "A2", label: "A2 OTP — clean", c: (p) => <A2_OTP {...p}/> },
    { id: "A2e", label: "A2 OTP — error", c: (p) => <A2_OTP {...p} error/> },
    { id: "A3", label: "A3 Invite", c: A3_Invite },
  ],
  Admin: [
    { id: "AD1", label: "AD1 Dashboard", c: AD1_Dashboard },
    { id: "AD2", label: "AD2 Translation Memory", c: AD2_TM },
    { id: "AD3", label: "AD3 Termbase", c: AD3_Termbase },
    { id: "AD4", label: "AD4 QA Profiles", c: AD4_QA },
    { id: "AD5", label: "AD5 Users", c: AD5_Users },
    { id: "AD6", label: "AD6 Integrations", c: AD6_Integrations },
    { id: "AD7", label: "AD7 Audit Log", c: AD7_Audit },
  ],
  PM: [
    { id: "PM1", label: "PM1 Dashboard", c: PM1_Dashboard },
    { id: "PM2", label: "PM2 Jobs", c: PM2_Jobs },
    { id: "PM3", label: "PM3 Create Job", c: PM3_Create },
    { id: "PM4", label: "PM4 Translators", c: PM4_Translators },
    { id: "PM5", label: "PM5 Concordance", c: PM5_Concordance },
    { id: "PM6", label: "PM6 Reports", c: PM6_Reports },
  ],
  Translator: [
    { id: "TR1", label: "TR1 Queue", c: TR1_Queue },
    { id: "TR2", label: "TR2 Editor (★)", c: TR2_Editor },
    { id: "TR3", label: "TR3 Comments", c: TR3_Comments },
    { id: "TR4", label: "TR4 Submit & Done", c: TR4_Submit },
  ],
};

const ALL_SCREENS = Object.entries(SCREEN_GROUPS).flatMap(([g, items]) => items.map(i => ({ ...i, group: g })));

function App() {
  const init = (() => {
    const h = location.hash.replace("#", "");
    return ALL_SCREENS.find(s => s.id === h)?.id || "TR2";
  })();
  const [screen, setScreen] = React.useState(init);
  const [search, setSearch] = React.useState(false);
  const [notif, setNotif] = React.useState(false);
  const [navOpen, setNavOpen] = React.useState(true);
  const [navQuery, setNavQuery] = React.useState("");

  React.useEffect(() => {
    const fn = () => {
      const h = location.hash.replace("#", "");
      const found = ALL_SCREENS.find(s => s.id === h);
      if (found) setScreen(found.id);
    };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);

  const goto = (id) => {
    setScreen(id);
    location.hash = id;
    setNavOpen(false);
  };

  // Keyboard
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearch(true); }
      if (e.key === "Escape") { setSearch(false); setNotif(false); }
      if ((e.metaKey || e.ctrlKey) && e.key === "/") { e.preventDefault(); setNavOpen(o => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const Current = ALL_SCREENS.find(s => s.id === screen)?.c || (() => <div>Not found</div>);
  const currentMeta = ALL_SCREENS.find(s => s.id === screen);

  // Roles → user identity
  const userByGroup = {
    Auth: null,
    Admin: { name: "James Okonkwo", email: "james@cethos.com", role: "Admin" },
    PM: { name: "Sarah Park", email: "sarah.park@cethos.com", role: "Project Manager" },
    Translator: { name: "Maria Chen", email: "maria.chen@acme.com", role: "Translator" },
  };
  const user = userByGroup[currentMeta?.group];

  // intra-screen navigation
  const navMap = { dashboard: { Admin: "AD1", PM: "PM1" }, tm: "AD2", termbase: "AD3", qa: "AD4", users: "AD5", integrations: "AD6", audit: "AD7", jobs: "PM2", create: "PM3", translators: "PM4", concordance: "PM5", reports: "PM6", queue: "TR1" };
  const onNav = (id) => {
    const target = navMap[id];
    if (typeof target === "string") goto(target);
    else if (target && target[currentMeta.group]) goto(target[currentMeta.group]);
  };

  const filtered = navQuery
    ? ALL_SCREENS.filter(s => s.label.toLowerCase().includes(navQuery.toLowerCase()) || s.group.toLowerCase().includes(navQuery.toLowerCase()))
    : ALL_SCREENS;
  const grouped = filtered.reduce((acc, s) => ({ ...acc, [s.group]: [...(acc[s.group] || []), s] }), {});

  return (
    <>
      <Current
        user={user}
        onNav={onNav}
        onSearchOpen={() => setSearch(true)}
        onNotifOpen={() => setNotif(true)}
        onLogout={() => goto("A1")}
        onOpenEditor={() => goto("TR2")}
        onBack={() => goto("TR1")}
        goOTP={() => goto("A2")}
        onVerify={() => goto(currentMeta.group === "Auth" ? "TR1" : "TR1")}
      />

      <SH1_SearchPalette open={search} onClose={() => setSearch(false)}/>
      <SH2_Notifications open={notif} onClose={() => setNotif(false)}/>

      {/* Floating screen switcher */}
      <button onClick={() => setNavOpen(o => !o)} style={{
        position: "fixed", bottom: 20, right: 20, zIndex: 900,
        width: 52, height: 52, borderRadius: "50%",
        background: "var(--navy)", color: "#fff", boxShadow: "var(--shadow-lg)",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "2px solid var(--teal)",
      }} title="Switch screen (⌘/)">
        {navOpen ? <Icons.X size={20}/> : <Icons.Layers size={20}/>}
      </button>

      {navOpen && (
        <div style={{
          position: "fixed", bottom: 86, right: 20, zIndex: 899,
          width: 320, maxHeight: "70vh", background: "#fff",
          borderRadius: 14, boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--border)", overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: 14, borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>Screens · {ALL_SCREENS.length} total</div>
            <input value={navQuery} onChange={(e) => setNavQuery(e.target.value)} placeholder="Filter screens…" autoFocus style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid var(--slate-200)", borderRadius: 6, outline: "none" }}/>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {Object.entries(grouped).map(([g, items]) => (
              <div key={g}>
                <div style={{ padding: "10px 14px 4px", fontSize: 10.5, fontWeight: 700, color: "var(--teal-700)", textTransform: "uppercase", letterSpacing: 0.5, background: "var(--bg-blue)" }}>{g}</div>
                {items.map(s => (
                  <button key={s.id} onClick={() => goto(s.id)} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    width: "100%", padding: "8px 14px", textAlign: "left",
                    background: screen === s.id ? "var(--bg-blue)" : "transparent",
                    color: screen === s.id ? "var(--teal-700)" : "var(--navy)",
                    fontWeight: screen === s.id ? 600 : 500,
                    fontSize: 13, borderLeft: `3px solid ${screen === s.id ? "var(--teal)" : "transparent"}`,
                  }}>
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--slate-400)", minWidth: 30 }}>{s.id}</span>
                    {s.label.replace(/^[A-Z0-9]+\s/, "")}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div style={{ padding: 10, borderTop: "1px solid var(--border)", background: "var(--slate-50)", fontSize: 11, color: "var(--slate-500)", display: "flex", justifyContent: "space-between" }}>
            <span><kbd className="mono" style={{padding:"1px 4px",background:"#fff",border:"1px solid var(--border)",borderRadius:3}}>⌘/</kbd> toggle</span>
            <span><kbd className="mono" style={{padding:"1px 4px",background:"#fff",border:"1px solid var(--border)",borderRadius:3}}>⌘K</kbd> search</span>
          </div>
        </div>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
