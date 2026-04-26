// Generic role-tour screenshot driver. Pass --role admin|pm|translator.
// Mints a valid MFA cookie via APP_SECRET so we don't need OTP.
//
//   node scripts/capture-role-screens.cjs --role pm
//   node scripts/capture-role-screens.cjs --role translator

const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer-core");
const { SignJWT } = require("jose");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.SCREENSHOT_BASE_URL || "http://localhost:3000";
const VIEWPORT = { width: 1440, height: 900 };

const ROLES = {
  admin: {
    email: "raminder@cethos.com",
    password: "Cethos-Admin-2026!",
    outDir: ["docs", "screenshots", "admin"],
    pages: [], // captured by capture-admin-screens.cjs
  },
  pm: {
    email: "pm@cethoscorp.com",
    password: "Cethos-PM-2026!",
    outDir: ["docs", "screenshots", "pm"],
    pages: [
      ["/pm",                "01-pm-dashboard"],
      ["/pm/jobs",           "02-jobs-list"],
      ["__JOB__",            "03-job-detail"],          // resolved at runtime
      ["/pm/jobs/new",       "04-create-job"],
      ["/pm/translators",    "05-translators"],
      ["/pm/concordance",    "06-concordance"],
      ["/pm/reports",        "07-reports"],
    ],
  },
  translator: {
    email: "ss.raminder@gmail.com",
    password: "Cethos-Trans-2026!",
    outDir: ["docs", "screenshots", "translator"],
    pages: [
      ["/translator",            "01-translator-inbox"],
      ["__EDITOR__",             "02-segment-editor"],   // resolved at runtime
      ["/translator/concordance","03-concordance"],
      ["/translator/profile",    "04-profile"],
    ],
  },
};

function loadEnv() {
  const text = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const roleIdx = args.indexOf("--role");
  if (roleIdx === -1 || !args[roleIdx + 1]) {
    console.error("usage: node scripts/capture-role-screens.cjs --role admin|pm|translator");
    process.exit(2);
  }
  const roleKey = args[roleIdx + 1];
  const role = ROLES[roleKey];
  if (!role) { console.error("unknown role"); process.exit(2); }

  const { createClient } = require("@supabase/supabase-js");
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await svc.from("profiles").select("id, mfa_required").eq("email", role.email).maybeSingle();
  if (!profile) { console.error("user not found:", role.email); process.exit(1); }

  const outDir = path.join(__dirname, "..", ...role.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  // Resolve dynamic routes
  let demoJobId = null;
  if (role.pages.some(([r]) => r === "__JOB__" || r === "__EDITOR__")) {
    const { data: job } = await svc.from("jobs").select("id").eq("reference", "DEMO-Q2-MKT").maybeSingle();
    if (!job) { console.error("DEMO-Q2-MKT job not found, run scripts/seed-demo-data.cjs"); process.exit(1); }
    demoJobId = job.id;
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    defaultViewport: VIEWPORT,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);

    // Sign in via password form (so the supabase session cookie is set).
    await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle2" });
    await page.type('input[name="email"]', role.email);
    await page.type('input[name="password"]', role.password);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
    ]);

    // Mint MFA cookie locally to bypass the OTP step.
    const key = new TextEncoder().encode(process.env.APP_SECRET);
    const mfaJwt = await new SignJWT({ sub: profile.id, email: role.email })
      .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(key);
    await page.setCookie({
      name: "cethos_mfa", value: mfaJwt, domain: "localhost", path: "/",
      httpOnly: true, secure: false, sameSite: "Lax",
    });

    for (const [route, name] of role.pages) {
      const resolvedRoute = route === "__JOB__"
        ? `/pm/jobs/${demoJobId}`
        : route === "__EDITOR__"
          ? `/translator/editor/${demoJobId}`
          : route;
      console.log(`→ ${resolvedRoute}`);
      await page.goto(`${BASE}${resolvedRoute}`, { waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 600));
      await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
      console.log(`  ✓ ${name}`);
    }
    console.log("\nALL CAPTURED ✓");
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
