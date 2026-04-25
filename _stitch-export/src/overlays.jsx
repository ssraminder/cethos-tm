// Shared overlays — SH1 Search palette, SH2 Notifications

const SH1_SearchPalette = ({ open, onClose }) => {
  if (!open) return null;
  const sections = [
    { l: "Jobs", icon: <Icons.Briefcase size={13}/>, items: [
      { t: "J-2026-04-381 · Acme Q2 Onboarding", s: "EN→FR · 64% · in progress" },
      { t: "J-2026-04-379 · Hooli Marketing", s: "EN→FR · 22% · due in 18h" },
    ]},
    { l: "Translation memory units", icon: <Icons.Database size={13}/>, items: [
      { t: "Save up to 30% on your annual plan.", s: "Acme EN→FR Master · 2 mo ago" },
      { t: "Click here to upgrade your account.", s: "Globex EN→FR · 1 yr ago" },
    ]},
    { l: "Termbase concepts", icon: <Icons.Book size={13}/>, items: [
      { t: "team", s: "Acme Brand · 4 languages · Approved" },
    ]},
    { l: "People", icon: <Icons.User size={13}/>, items: [
      { t: "Maria Chen", s: "Translator · EN→FR, EN→ES" },
    ]},
  ];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(12,35,64,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 80, backdropFilter: "blur(4px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 640, maxHeight: "70vh", background: "#fff", borderRadius: 14, boxShadow: "var(--shadow-lg)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 14, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
          <Icons.Search size={18} style={{color:"var(--slate-400)"}}/>
          <input autoFocus placeholder="Search jobs, TM units, terms, people…" defaultValue="upgrade plan" style={{ flex: 1, fontSize: 16, border: "none", outline: "none", color: "var(--navy)", fontFamily: "inherit" }}/>
          <span className="mono" style={{ fontSize: 11, color: "var(--slate-400)", padding: "3px 8px", background: "var(--slate-50)", borderRadius: 4 }}>esc</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {sections.map((sec, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ padding: "6px 12px", fontSize: 11, fontWeight: 700, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: 0.4, display: "inline-flex", alignItems: "center", gap: 6 }}>{sec.icon}{sec.l}</div>
              {sec.items.map((it, j) => (
                <button key={j} style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8, background: i === 0 && j === 0 ? "var(--bg-blue)" : "transparent", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: 13.5, fontWeight: 500, color: "var(--navy)" }}>{it.t}</div>
                    <div style={{ fontSize: 11.5, color: "var(--slate-500)" }}>{it.s}</div>
                  </div>
                  {i === 0 && j === 0 && <span className="mono" style={{ fontSize: 10, color: "var(--slate-500)", padding: "2px 5px", background: "#fff", border: "1px solid var(--border)", borderRadius: 4 }}>↵</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", background: "var(--slate-50)", display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--slate-500)" }}>
          <div style={{ display: "flex", gap: 14 }}>
            <span><kbd style={{padding:"1px 5px",background:"#fff",border:"1px solid var(--border)",borderRadius:3,fontSize:10}} className="mono">↑↓</kbd> navigate</span>
            <span><kbd style={{padding:"1px 5px",background:"#fff",border:"1px solid var(--border)",borderRadius:3,fontSize:10}} className="mono">↵</kbd> open</span>
          </div>
          <span>15 results · search powered by index</span>
        </div>
      </div>
    </div>
  );
};

const SH2_Notifications = ({ open, onClose }) => {
  if (!open) return null;
  const items = [
    { unread: true, icon: <Icons.Briefcase size={14}/>, c: "navy", t: "New job from Acme TMS", b: "J-2026-04-381 · 4,820 words · EN→FR · due in 2 days", time: "12 min ago" },
    { unread: true, icon: <Icons.MessageCircle size={14}/>, c: "purple", t: "Sarah Park commented on segment #14", b: "Marketing wants 'forfait' not 'plan' here…", time: "2 hr ago" },
    { unread: true, icon: <Icons.AlertTriangle size={14}/>, c: "amber", t: "QA threshold exceeded on J-2026-04-375", b: "12 critical issues — review required", time: "3 hr ago" },
    { unread: false, icon: <Icons.Check size={14}/>, c: "emerald", t: "Tomás submitted J-2026-04-379", b: "1,840 words · QA score 4.8 ★", time: "Yesterday" },
    { unread: false, icon: <Icons.Database size={14}/>, c: "teal", t: "TM 'Acme EN→FR Master' updated", b: "+184 units imported via TMX", time: "2 days ago" },
    { unread: false, icon: <Icons.Bell size={14}/>, c: "slate", t: "Reminder: J-2026-04-379 due in 24 hours", b: "Hooli Marketing · in progress", time: "2 days ago" },
  ];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(12,35,64,0.4)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 420, height: "100vh", background: "#fff", boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column", animation: "slideIn 200ms ease" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--navy)" }}>Notifications</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--slate-500)" }}>3 unread</p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button title="Mark all read" style={{ padding: 6, color: "var(--slate-400)", borderRadius: 6 }}><Icons.Check size={16}/></button>
            <button title="Settings" style={{ padding: 6, color: "var(--slate-400)", borderRadius: 6 }}><Icons.Settings size={16}/></button>
            <button onClick={onClose} style={{ padding: 6, color: "var(--slate-400)", borderRadius: 6 }}><Icons.X size={16}/></button>
          </div>
        </div>
        <div style={{ padding: "10px 16px 0", display: "flex", gap: 6 }}>
          {["All", "Unread", "Jobs", "Comments", "QA"].map((t, i) => (
            <button key={t} style={{
              padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
              background: i === 0 ? "var(--navy)" : "transparent",
              color: i === 0 ? "#fff" : "var(--slate-600)",
              border: i === 0 ? "none" : "1px solid var(--border)",
            }}>{t}</button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
          {items.map((n, i) => (
            <div key={i} style={{ padding: "12px 20px", borderLeft: n.unread ? "3px solid var(--teal)" : "3px solid transparent", display: "flex", gap: 12, cursor: "pointer", background: n.unread ? "var(--bg-blue)" : "" }}
              onMouseEnter={(e) => { if (!n.unread) e.currentTarget.style.background = "var(--slate-50)"; }}
              onMouseLeave={(e) => { if (!n.unread) e.currentTarget.style.background = ""; }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: n.c === "navy" ? "var(--bg-blue)" : `var(--${n.c}-50)`, color: n.c === "navy" ? "var(--navy)" : `var(--${n.c}-600)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: n.unread ? 700 : 500, color: "var(--navy)" }}>{n.t}</div>
                <div className="truncate" style={{ fontSize: 12, color: "var(--slate-600)", marginTop: 2 }}>{n.b}</div>
                <div style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 4 }}>{n.time}</div>
              </div>
              {n.unread && <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--teal)", marginTop: 6 }}/>}
            </div>
          ))}
        </div>
        <div style={{ padding: 14, borderTop: "1px solid var(--border)", textAlign: "center" }}>
          <a href="#" style={{ fontSize: 13, color: "var(--teal)", fontWeight: 600 }}>View all notifications →</a>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { SH1_SearchPalette, SH2_Notifications });
