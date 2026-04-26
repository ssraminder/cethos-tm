// Verify the three training pages render without runtime errors and capture
// a screenshot of each. Used as the "browser preview" check for the in-app
// training feature.
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer-core");
const { SignJWT } = require("jose");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:3000";
const VIEWPORT = { width: 1440, height: 900 };
const OUT_DIR = path.join(__dirname, "..", "docs", "screenshots", "training-pages");

const ROLES = {
  admin:      { email: "raminder@cethos.com",   pass: "Cethos-Admin-2026!", route: "/admin/training" },
  pm:         { email: "pm@cethoscorp.com",     pass: "Cethos-PM-2026!",    route: "/pm/training" },
  translator: { email: "ss.raminder@gmail.com", pass: "Cethos-Trans-2026!", route: "/translator/training" },
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
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { createClient } = require("@supabase/supabase-js");
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: "new", defaultViewport: VIEWPORT, args: ["--no-sandbox"],
  });
  let allOk = true;
  try {
    for (const [roleKey, cfg] of Object.entries(ROLES)) {
      console.log(`\n→ ${roleKey} ${cfg.route}`);
      const { data: profile } = await svc.from("profiles").select("id").eq("email", cfg.email).maybeSingle();
      if (!profile) { console.error("user not found"); allOk = false; continue; }

      const page = await browser.newPage();
      await page.setViewport(VIEWPORT);

      // collect runtime errors
      const errors = [];
      page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
      page.on("response", (res) => { if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`); });

      await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle2" });
      await page.type('input[name="email"]', cfg.email);
      await page.type('input[name="password"]', cfg.pass);
      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
      ]);

      const key = new TextEncoder().encode(process.env.APP_SECRET);
      const mfaJwt = await new SignJWT({ sub: profile.id, email: cfg.email })
        .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(key);
      await page.setCookie({
        name: "cethos_mfa", value: mfaJwt, domain: "localhost", path: "/",
        httpOnly: true, secure: false, sameSite: "Lax",
      });

      await page.goto(`${BASE}${cfg.route}`, { waitUntil: "networkidle2" });
      const finalUrl = page.url();
      const title = await page.title();
      const hasTrainingDoc = await page.$("article.training-doc") !== null;
      const screenshotPath = path.join(OUT_DIR, `${roleKey}-training.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });

      console.log(`  url: ${finalUrl}`);
      console.log(`  title: ${title}`);
      console.log(`  rendered: ${hasTrainingDoc ? "yes" : "NO"}`);
      console.log(`  errors: ${errors.length === 0 ? "none" : errors.join("\n           ")}`);
      console.log(`  screenshot: ${screenshotPath}`);
      if (!hasTrainingDoc || errors.length > 0 || !finalUrl.endsWith(cfg.route)) allOk = false;

      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log(allOk ? "\nALL TRAINING PAGES OK ✓" : "\nVERIFICATION FAILED ✗");
  process.exit(allOk ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
