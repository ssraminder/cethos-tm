// Reusable primitives — Cethos brand

const Button = ({ children, variant = "primary", size = "md", icon, iconRight, full, danger, onClick, disabled, type = "button", style, ...rest }) => {
  const sizes = {
    sm: { padding: "6px 12px", fontSize: 13, height: 32, gap: 6 },
    md: { padding: "9px 16px", fontSize: 14, height: 38, gap: 8 },
    lg: { padding: "14px 22px", fontSize: 15, height: 48, gap: 10 },
  };
  const variants = {
    primary: { background: danger ? "var(--rose-500)" : "var(--teal)", color: "#fff", border: "1px solid transparent" },
    success: { background: "var(--emerald-600)", color: "#fff", border: "1px solid transparent" },
    secondary: { background: "#fff", color: "var(--navy)", border: "1px solid var(--slate-200)" },
    outline: { background: "transparent", color: "var(--navy)", border: "1px solid var(--slate-300)" },
    ghost: { background: "transparent", color: "var(--slate-700)", border: "1px solid transparent" },
    dark: { background: "var(--navy)", color: "#fff", border: "1px solid var(--navy)" },
    danger: { background: "var(--rose-500)", color: "#fff", border: "1px solid transparent" },
    "danger-outline": { background: "#fff", color: "var(--rose-600)", border: "1px solid var(--rose-100)" },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      ...sizes[size], ...variants[variant],
      borderRadius: 8, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: full ? "100%" : "auto", opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer",
      transition: "all 150ms ease", whiteSpace: "nowrap", letterSpacing: -0.1, ...style,
    }} {...rest}>
      {icon && <span style={{ display: "inline-flex" }}>{icon}</span>}
      {children}
      {iconRight && <span style={{ display: "inline-flex" }}>{iconRight}</span>}
    </button>
  );
};

const Input = ({ icon, iconRight, error, label, required, hint, full = true, style, ...rest }) => (
  <label style={{ display: "block", width: full ? "100%" : "auto" }}>
    {label && (
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--navy)", marginBottom: 6 }}>
        {label}{required && <span style={{ color: "var(--rose-500)", marginLeft: 4 }}>*</span>}
      </div>
    )}
    <div style={{ position: "relative" }}>
      {icon && <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--slate-400)", display: "inline-flex" }}>{icon}</span>}
      <input style={{
        width: "100%", padding: "10px 14px", paddingLeft: icon ? 38 : 14, paddingRight: iconRight ? 38 : 14,
        border: `1px solid ${error ? "var(--rose-500)" : "var(--slate-200)"}`,
        borderRadius: 8, background: "#fff", color: "var(--navy)", fontSize: 14, outline: "none",
        transition: "all 150ms ease", ...style,
      }}
      onFocus={(e) => e.target.style.boxShadow = `0 0 0 3px ${error ? "rgba(244,63,94,.18)" : "rgba(8,145,178,.18)"}`}
      onBlur={(e) => e.target.style.boxShadow = "none"}
      {...rest} />
      {iconRight && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--slate-400)", display: "inline-flex" }}>{iconRight}</span>}
    </div>
    {hint && <div style={{ fontSize: 12, color: error ? "var(--rose-500)" : "var(--slate-500)", marginTop: 6 }}>{hint}</div>}
  </label>
);

const Pill = ({ children, color = "slate", icon, size = "md", outline, style }) => {
  const palette = {
    slate: { bg: "#F1F5F9", fg: "#475569", border: "#E2E8F0" },
    teal: { bg: "#ECFEFF", fg: "#0E7490", border: "#A5F3FC" },
    navy: { bg: "#E0F2FE", fg: "#0C2340", border: "#BAE6FD" },
    emerald: { bg: "#ECFDF5", fg: "#047857", border: "#A7F3D0" },
    lime: { bg: "#ECFCCB", fg: "#3F6212", border: "#D9F99D" },
    amber: { bg: "#FFFBEB", fg: "#B45309", border: "#FDE68A" },
    rose: { bg: "#FFF1F2", fg: "#BE123C", border: "#FECDD3" },
    purple: { bg: "#F3E8FF", fg: "#7E22CE", border: "#E9D5FF" },
    indigo: { bg: "#EEF2FF", fg: "#4338CA", border: "#C7D2FE" },
    grey: { bg: "#F8FAFC", fg: "#64748B", border: "#E2E8F0" },
  };
  const c = palette[color] || palette.slate;
  const sz = size === "sm" ? { padding: "2px 8px", fontSize: 11 } : { padding: "3px 10px", fontSize: 12 };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: outline ? "transparent" : c.bg, color: c.fg,
      border: `1px solid ${outline ? c.fg + "33" : c.border}`,
      borderRadius: 999, fontWeight: 600, lineHeight: 1.4, ...sz, ...style,
    }}>
      {icon}{children}
    </span>
  );
};

const Card = ({ children, padding = 20, style, hover, onClick }) => (
  <div onClick={onClick} style={{
    background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding,
    boxShadow: "var(--shadow-soft)", transition: "all 200ms ease",
    cursor: onClick ? "pointer" : "default",
    ...(hover ? { ":hover": { boxShadow: "var(--shadow-md)" } } : {}),
    ...style,
  }}>{children}</div>
);

const Avatar = ({ name, size = 32, src, color }) => {
  const initials = name ? name.split(" ").map(s => s[0]).slice(0, 2).join("") : "?";
  const colors = ["#0891B2", "#0C2340", "#7E22CE", "#059669", "#D97706", "#BE123C", "#0E7490", "#4338CA"];
  const c = color || colors[(name || "").charCodeAt(0) % colors.length];
  if (src) {
    return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} />;
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: c, color: "#fff",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, letterSpacing: -0.3, flexShrink: 0,
    }}>{initials}</div>
  );
};

const FlagPair = ({ from, to, size = 16 }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 12, color: "var(--slate-700)" }}>
    <Flag code={from} size={size} />
    <Icons.ArrowRight size={11} stroke={2.4} />
    <Flag code={to} size={size} />
  </span>
);

const Flag = ({ code, size = 16 }) => {
  // Stylized circular flags using language code
  const colors = {
    EN: ["#012169", "#FFFFFF", "#C8102E"],
    FR: ["#002395", "#FFFFFF", "#ED2939"],
    ES: ["#AA151B", "#F1BF00", "#AA151B"],
    DE: ["#000000", "#DD0000", "#FFCE00"],
    JA: ["#FFFFFF", "#BC002D", "#FFFFFF"],
    PT: ["#006600", "#FF0000", "#FFFF00"],
    IT: ["#009246", "#FFFFFF", "#CE2B37"],
    ZH: ["#DE2910", "#FFDE00", "#DE2910"],
    KO: ["#FFFFFF", "#0047A0", "#CD2E3A"],
    NL: ["#AE1C28", "#FFFFFF", "#21468B"],
  };
  const c = colors[code] || ["#94A3B8", "#CBD5E1", "#64748B"];
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%", overflow: "hidden",
      display: "inline-flex", flexDirection: "column", border: "1px solid rgba(0,0,0,.1)",
      flexShrink: 0,
    }}>
      <span style={{ flex: 1, background: c[0] }} />
      <span style={{ flex: 1, background: c[1] }} />
      <span style={{ flex: 1, background: c[2] }} />
    </span>
  );
};

const Tabs = ({ tabs, active, onChange, variant = "underline", style }) => {
  if (variant === "pills") {
    return (
      <div style={{ display: "inline-flex", background: "var(--slate-100)", padding: 3, borderRadius: 10, gap: 2, ...style }}>
        {tabs.map((t) => {
          const id = typeof t === "string" ? t : t.id;
          const label = typeof t === "string" ? t : t.label;
          const count = typeof t === "object" ? t.count : null;
          return (
            <button key={id} onClick={() => onChange(id)} style={{
              padding: "6px 14px", fontSize: 13, fontWeight: 600, borderRadius: 8,
              background: active === id ? "#fff" : "transparent",
              color: active === id ? "var(--navy)" : "var(--slate-500)",
              boxShadow: active === id ? "0 1px 3px rgba(12,35,64,0.08)" : "none",
              transition: "all 150ms ease", display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              {label}
              {count != null && <span style={{ fontSize: 11, padding: "1px 7px", background: active === id ? "var(--bg-blue)" : "var(--slate-200)", color: active === id ? "var(--teal-700)" : "var(--slate-600)", borderRadius: 999 }}>{count}</span>}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--border)", ...style }}>
      {tabs.map((t) => {
        const id = typeof t === "string" ? t : t.id;
        const label = typeof t === "string" ? t : t.label;
        const count = typeof t === "object" ? t.count : null;
        const dot = typeof t === "object" ? t.dot : null;
        return (
          <button key={id} onClick={() => onChange(id)} style={{
            padding: "10px 14px", fontSize: 13, fontWeight: 600,
            color: active === id ? "var(--teal)" : "var(--slate-500)",
            borderBottom: `2px solid ${active === id ? "var(--teal)" : "transparent"}`,
            marginBottom: -1, transition: "all 150ms ease",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            {label}
            {count != null && <span style={{ fontSize: 11, padding: "1px 6px", background: "var(--slate-100)", color: "var(--slate-600)", borderRadius: 999 }}>{count}</span>}
            {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: dot === "rose" ? "var(--rose-500)" : "var(--amber-500)" }} />}
          </button>
        );
      })}
    </div>
  );
};

const Toggle = ({ checked, onChange, size = "md" }) => {
  const w = size === "sm" ? 32 : 40;
  const h = size === "sm" ? 18 : 22;
  const k = size === "sm" ? 14 : 18;
  return (
    <button onClick={() => onChange(!checked)} style={{
      width: w, height: h, borderRadius: 999, padding: 2,
      background: checked ? "var(--teal)" : "var(--slate-300)",
      transition: "all 150ms ease", position: "relative",
    }}>
      <span style={{
        display: "block", width: k, height: k, borderRadius: 999, background: "#fff",
        transform: `translateX(${checked ? w - k - 4 : 0}px)`, transition: "all 150ms ease",
        boxShadow: "0 1px 3px rgba(0,0,0,.2)",
      }} />
    </button>
  );
};

const Sidebar = ({ items, active, onChange, role, user, onLogout }) => (
  <aside style={{
    width: 232, background: "#fff", borderRight: "1px solid var(--border)",
    display: "flex", flexDirection: "column", flexShrink: 0, height: "100vh", position: "sticky", top: 0,
  }}>
    <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-soft)" }}>
      <Icons.Wordmark size={32} sub="Translation, evolved" />
      <div style={{ marginTop: 14, fontSize: 11, fontWeight: 600, letterSpacing: 1, color: "var(--slate-400)", textTransform: "uppercase" }}>
        {role}
      </div>
    </div>
    <nav style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
      {items.map((item) => (
        <button key={item.id} onClick={() => onChange(item.id)} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "9px 12px", borderRadius: 8, marginBottom: 2,
          background: active === item.id ? "var(--bg-blue)" : "transparent",
          color: active === item.id ? "var(--teal-700)" : "var(--slate-600)",
          fontWeight: active === item.id ? 600 : 500, fontSize: 13.5, textAlign: "left",
          transition: "all 120ms ease",
        }}
        onMouseEnter={(e) => { if (active !== item.id) e.currentTarget.style.background = "var(--slate-50)"; }}
        onMouseLeave={(e) => { if (active !== item.id) e.currentTarget.style.background = "transparent"; }}>
          <span style={{ display: "inline-flex", color: active === item.id ? "var(--teal)" : "var(--slate-400)" }}>{item.icon}</span>
          {item.label}
          {item.count != null && (
            <span style={{ marginLeft: "auto", fontSize: 11, padding: "1px 7px", background: active === item.id ? "#fff" : "var(--slate-100)", color: active === item.id ? "var(--teal-700)" : "var(--slate-500)", borderRadius: 999, fontWeight: 600 }}>{item.count}</span>
          )}
        </button>
      ))}
    </nav>
    <div style={{ padding: 12, borderTop: "1px solid var(--border-soft)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderRadius: 8 }}>
        <Avatar name={user.name} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }} className="truncate">{user.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--slate-500)" }} className="truncate">{user.email}</div>
        </div>
        <button onClick={onLogout} style={{ color: "var(--slate-400)", padding: 4 }} title="Sign out"><Icons.LogOut size={16}/></button>
      </div>
    </div>
  </aside>
);

const TopBar = ({ breadcrumb, actions, onSearchOpen, onNotifOpen, user, density, onDensity }) => (
  <header style={{
    height: 60, padding: "0 24px", background: "#fff", borderBottom: "1px solid var(--border)",
    display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 30,
  }}>
    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate-500)", fontWeight: 500 }}>
      {breadcrumb.map((b, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Icons.ChevronRight size={14} />}
          <span style={{ color: i === breadcrumb.length - 1 ? "var(--navy)" : "var(--slate-500)", fontWeight: i === breadcrumb.length - 1 ? 600 : 500 }}>{b}</span>
        </React.Fragment>
      ))}
    </div>
    <button onClick={onSearchOpen} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", borderRadius: 8,
      border: "1px solid var(--slate-200)", background: "var(--slate-50)", color: "var(--slate-500)", fontSize: 13, minWidth: 240,
    }}>
      <Icons.Search size={14} /> Search…
      <span style={{ marginLeft: "auto", fontSize: 11, padding: "1px 6px", background: "#fff", border: "1px solid var(--slate-200)", borderRadius: 4, fontFamily: "JetBrains Mono", color: "var(--slate-500)" }}>⌘K</span>
    </button>
    {actions}
    <button onClick={onNotifOpen} style={{ position: "relative", padding: 8, borderRadius: 8, color: "var(--slate-600)" }}>
      <Icons.Bell size={18} />
      <span style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 999, background: "var(--rose-500)", border: "2px solid #fff" }} />
    </button>
    <Avatar name={user.name} size={32} />
  </header>
);

// Stat card
const Stat = ({ label, value, sub, color = "navy", icon, trend }) => (
  <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--slate-500)", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      {icon && <span style={{ color: "var(--slate-300)" }}>{icon}</span>}
    </div>
    <div style={{ fontSize: 28, fontWeight: 700, color: color === "rose" ? "var(--rose-600)" : "var(--navy)", letterSpacing: -0.6, lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ marginTop: 6, fontSize: 12, color: "var(--slate-500)", display: "flex", alignItems: "center", gap: 4 }}>
      {trend && <span style={{ color: trend > 0 ? "var(--emerald-600)" : "var(--rose-500)" }}>{trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%</span>}
      {sub}
    </div>}
  </div>
);

// Mini sparkline
const Sparkline = ({ data, color = "var(--teal)", height = 40, fill = true }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const w = 100;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / (max - min || 1)) * (height - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      {fill && <polyline points={`0,${height} ${points} ${w},${height}`} fill={color} fillOpacity={0.12} />}
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
};

// Donut
const Donut = ({ segments, size = 140, thickness = 22 }) => {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--slate-100)" strokeWidth={thickness} />
      {segments.map((s, i) => {
        const dash = (s.value / total) * c;
        const off = -((acc / total) * c);
        acc += s.value;
        return <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
          strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={off} transform={`rotate(-90 ${size/2} ${size/2})`} strokeLinecap="butt" />;
      })}
      <text x={size/2} y={size/2 - 2} textAnchor="middle" style={{ fontSize: 22, fontWeight: 700, fill: "var(--navy)" }}>{total}</text>
      <text x={size/2} y={size/2 + 16} textAnchor="middle" style={{ fontSize: 11, fontWeight: 500, fill: "var(--slate-500)" }}>issues</text>
    </svg>
  );
};

// Stacked area chart
const StackedArea = ({ series, labels, height = 200, colors }) => {
  const w = 600;
  const max = labels.map((_, i) => series.reduce((s, ser) => s + ser.data[i], 0)).reduce((a, b) => Math.max(a, b), 0);
  const xStep = w / (labels.length - 1);
  let stack = labels.map(() => 0);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: "block" }}>
      {[0.25, 0.5, 0.75, 1].map((p, i) => (
        <line key={i} x1={0} x2={w} y1={height - height * p} y2={height - height * p} stroke="var(--slate-100)" strokeDasharray="2 4" />
      ))}
      {series.map((ser, si) => {
        const top = labels.map((_, i) => stack[i] + ser.data[i]);
        const path = top.map((v, i) => `${i === 0 ? "M" : "L"} ${i*xStep},${height - (v/max)*(height-10) - 4}`).join(" ");
        const bottom = stack.slice().reverse().map((v, i) => `L ${(labels.length-1-i)*xStep},${height - (v/max)*(height-10) - 4}`).join(" ");
        const fill = `${path} ${bottom} Z`;
        stack = top;
        return <path key={si} d={fill} fill={ser.color} fillOpacity={0.85} />;
      })}
    </svg>
  );
};

// Horizontal bar list
const BarList = ({ items, max, color = "var(--teal)" }) => {
  const m = max || Math.max(...items.map(x => x.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((it, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12.5, color: "var(--navy)", fontWeight: 500 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{it.label}</span>
            <span style={{ color: "var(--slate-500)" }}>{it.display || it.value.toLocaleString()}</span>
          </div>
          <div style={{ height: 8, background: "var(--slate-100)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${(it.value / m) * 100}%`, height: "100%", background: it.color || color, borderRadius: 999, transition: "width 400ms ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
};

const ProgressBar = ({ value, max = 100, color = "var(--teal)", height = 6, bg = "var(--slate-100)" }) => (
  <div style={{ height, background: bg, borderRadius: 999, overflow: "hidden", width: "100%" }}>
    <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: "100%", background: color, borderRadius: 999, transition: "width 400ms ease" }} />
  </div>
);

// Section header used across pages
const PageHeader = ({ title, subtitle, actions }) => (
  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--navy)", margin: 0, letterSpacing: -0.6 }}>{title}</h1>
      {subtitle && <p style={{ margin: "6px 0 0", color: "var(--slate-500)", fontSize: 14 }}>{subtitle}</p>}
    </div>
    {actions && <div style={{ display: "flex", gap: 10 }}>{actions}</div>}
  </div>
);

const Section = ({ title, children, action, padding = 20, style }) => (
  <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, ...style }}>
    {(title || action) && (
      <div style={{ padding: `16px ${padding}px`, borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--navy)" }}>{title}</h3>
        {action}
      </div>
    )}
    <div style={{ padding }}>{children}</div>
  </div>
);

const KBD = ({ children }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", padding: "1px 6px", background: "#fff",
    border: "1px solid var(--slate-200)", borderRadius: 4, fontFamily: "JetBrains Mono", fontSize: 11,
    color: "var(--slate-600)", fontWeight: 500, boxShadow: "0 1px 0 var(--slate-200)",
  }}>{children}</span>
);

Object.assign(window, {
  Button, Input, Pill, Card, Avatar, FlagPair, Flag, Tabs, Toggle, Sidebar, TopBar,
  Stat, Sparkline, Donut, StackedArea, BarList, ProgressBar, PageHeader, Section, KBD,
});
