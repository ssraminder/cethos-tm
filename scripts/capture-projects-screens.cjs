// Capture screenshots of the new projects feature for the training docs.
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer-core");
const { SignJWT } = require("jose");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:3000";
const VIEWPORT = { width: 1440, height: 900 };

function loadEnv() {
  const text = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function tour(page, url, file) {
  await page.goto(url, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: file, fullPage: true });
  console.log("  ✓", path.basename(file));
}

async function signIn(page, email, password, profileId) {
  await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle2" });
  await page.type('input[name="email"]', email);
  await page.type('input[name="password"]', password);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
  ]);
  const key = new TextEncoder().encode(process.env.APP_SECRET);
  const mfaJwt = await new SignJWT({ sub: profileId, email })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(key);
  await page.setCookie({ name: "cethos_mfa", value: mfaJwt, domain: "localhost", path: "/", httpOnly: true });
}

async function main() {
  loadEnv();
  const { createClient } = require("@supabase/supabase-js");
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: project } = await svc.from("projects").select("id").eq("reference", "ACME-Q2-MKT").maybeSingle();
  if (!project) { console.error("seed first"); process.exit(1); }

  const adminOut = path.join(__dirname, "..", "docs", "screenshots", "admin");
  const pmOut = path.join(__dirname, "..", "docs", "screenshots", "pm");
  const pubAdmin = path.join(__dirname, "..", "public", "training", "admin");
  const pubPm = path.join(__dirname, "..", "public", "training", "pm");
  for (const d of [adminOut, pmOut, pubAdmin, pubPm]) fs.mkdirSync(d, { recursive: true });

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", defaultViewport: VIEWPORT, args: ["--no-sandbox"] });
  try {
    // Admin tour
    {
      console.log("admin");
      const { data: admin } = await svc.from("profiles").select("id").eq("email", "raminder@cethos.com").maybeSingle();
      const page = await browser.newPage();
      await page.setViewport(VIEWPORT);
      await signIn(page, "raminder@cethos.com", "Cethos-Admin-2026!", admin.id);
      await tour(page, `${BASE}/admin/projects`, path.join(adminOut, "20-projects-list.png"));
      await tour(page, `${BASE}/admin/projects/new`, path.join(adminOut, "21-projects-create.png"));
      await tour(page, `${BASE}/admin/projects/${project.id}`, path.join(adminOut, "22-projects-detail.png"));
      // copy to public
      for (const n of ["20-projects-list.png", "21-projects-create.png", "22-projects-detail.png"]) {
        fs.copyFileSync(path.join(adminOut, n), path.join(pubAdmin, n));
      }
      await page.close();
    }
    // PM tour
    {
      console.log("pm");
      const { data: pm } = await svc.from("profiles").select("id").eq("email", "pm@cethoscorp.com").maybeSingle();
      const page = await browser.newPage();
      await page.setViewport(VIEWPORT);
      await signIn(page, "pm@cethoscorp.com", "Cethos-PM-2026!", pm.id);
      await tour(page, `${BASE}/pm/projects`, path.join(pmOut, "08-projects-list.png"));
      await tour(page, `${BASE}/pm/projects/${project.id}`, path.join(pmOut, "09-projects-detail.png"));
      for (const n of ["08-projects-list.png", "09-projects-detail.png"]) {
        fs.copyFileSync(path.join(pmOut, n), path.join(pubPm, n));
      }
      await page.close();
    }
    console.log("\nALL CAPTURED ✓");
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
