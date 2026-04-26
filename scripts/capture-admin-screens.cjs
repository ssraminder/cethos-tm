// Drive system Chrome via puppeteer-core to sign in as admin and screenshot
// every admin-facing page. Output: docs/screenshots/admin/*.png
//
// Prereqs:
//   - dev server running at http://localhost:3000
//   - admin user raminder@cethos.com exists (run smoke/create-users.cjs)
//   - demo data seeded (run scripts/seed-demo-data.cjs)
//
// Strategy: temporarily clear MFA on the admin so we don't need OTP; restore at end.

const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer-core");
const { SignJWT } = require("jose");

const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const BASE = process.env.SCREENSHOT_BASE_URL || "http://localhost:3000";
const OUT_DIR = path.join(__dirname, "..", "docs", "screenshots", "admin");
const VIEWPORT = { width: 1440, height: 900 };

const ADMIN_EMAIL = "raminder@cethos.com";
const ADMIN_PASS  = "Cethos-Admin-2026!";

function loadEnv() {
  const text = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  loadEnv();
  const { createClient } = require("@supabase/supabase-js");
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Look up the admin's profile id once.
  const { data: profile } = await svc.from("profiles").select("id, mfa_required").eq("email", ADMIN_EMAIL).maybeSingle();
  if (!profile) { console.error("admin profile not found"); process.exit(1); }
  const wasMfaRequired = profile.mfa_required;
  console.log(`Found admin ${profile.id} (mfa_required=${wasMfaRequired})`);

  // Temporarily disable MFA so we can drive sign-in without an OTP roundtrip.
  if (wasMfaRequired) {
    await svc.from("profiles").update({ mfa_required: false }).eq("id", profile.id);
    console.log("Temporarily set mfa_required=false");
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: "new",
      defaultViewport: VIEWPORT,
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);

    // 1) sign-in page (unauthenticated)
    await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle2" });
    await page.screenshot({ path: path.join(OUT_DIR, "01-sign-in.png"), fullPage: false });
    console.log("✓ 01-sign-in");

    // Fill + submit
    await page.type('input[name="email"]', ADMIN_EMAIL);
    await page.type('input[name="password"]', ADMIN_PASS);

    // Submit password.
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
    ]);

    // Middleware demands the MFA cookie even when profile.mfa_required=false.
    // Mint one ourselves using APP_SECRET (same key the proxy verifies with).
    console.log("Minting MFA cookie via APP_SECRET…");
    const key = new TextEncoder().encode(process.env.APP_SECRET);
    const mfaJwt = await new SignJWT({ sub: profile.id, email: ADMIN_EMAIL })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(key);
    await page.setCookie({
      name: "cethos_mfa",
      value: mfaJwt,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    });

    // Now jump to /admin
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle2" });
    if (!page.url().includes("/admin")) {
      console.error("Could not reach /admin after cookie mint. URL:", page.url());
      const html = await page.content();
      fs.writeFileSync(path.join(OUT_DIR, "_debug-after-signin.html"), html);
      process.exit(1);
    }

    const tours = [
      ["/admin",                              "02-admin-dashboard"],
      ["/admin/tm",                           "03-tm-list"],
      ["/admin/tm/new",                       "04-tm-create"],
      ["/admin/termbases",                    "06-termbase-list"],
      ["/admin/termbases/new",                "07-termbase-create"],
      ["/admin/qa",                           "09-qa-profiles"],
      ["/admin/languages",                    "10-languages"],
      ["/admin/mt",                           "11-mt-engines"],
      ["/admin/users",                        "12-users"],
      ["/admin/integrations",                 "13-integrations"],
      ["/admin/integrations/api-keys",        "14-api-keys"],
      ["/admin/audit",                        "15-audit-log"],
      ["/admin/settings",                     "16-settings"],
    ];

    // Insert TM detail and termbase detail by looking up ids
    const { data: tmRow } = await svc.from("translation_memories").select("id").eq("name", "Acme Marketing EN→FR").maybeSingle();
    if (tmRow) tours.splice(3, 0, [`/admin/tm/${tmRow.id}`, "05-tm-detail"]);
    const { data: tbRow } = await svc.from("termbases").select("id").eq("name", "Acme Brand Glossary").maybeSingle();
    if (tbRow) tours.splice(6, 0, [`/admin/termbases/${tbRow.id}`, "08-termbase-detail"]);

    for (const [route, name] of tours) {
      console.log(`→ ${route}`);
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 400));
      await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
      console.log(`  ✓ ${name}`);
    }

    console.log("\nALL SCREENSHOTS CAPTURED ✓");
  } finally {
    if (browser) await browser.close();
    if (wasMfaRequired) {
      await svc.from("profiles").update({ mfa_required: true }).eq("id", profile.id);
      console.log("Restored mfa_required=true");
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
