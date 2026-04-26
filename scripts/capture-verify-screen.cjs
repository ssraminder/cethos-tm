// One-off: drive sign-in just past the password step so we can screenshot
// the OTP /verify page. Saves to docs/screenshots/admin/01b-verify.png.
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer-core");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:3000";
const OUT = path.join(__dirname, "..", "docs", "screenshots", "admin", "01b-verify.png");
const VIEWPORT = { width: 1440, height: 900 };

const ADMIN_EMAIL = "raminder@cethos.com";
const ADMIN_PASS  = "Cethos-Admin-2026!";

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    defaultViewport: VIEWPORT,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle2" });
    await page.type('input[name="email"]', ADMIN_EMAIL);
    await page.type('input[name="password"]', ADMIN_PASS);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
    ]);
    if (!page.url().includes("/verify")) {
      console.error("Not on /verify, URL:", page.url());
      process.exit(1);
    }
    await page.screenshot({ path: OUT, fullPage: false });
    console.log("Saved", OUT);
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
