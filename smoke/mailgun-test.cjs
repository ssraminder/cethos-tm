// Direct Mailgun smoke. Reads .env.local and posts a test message.
// Usage: node smoke/mailgun-test.cjs <recipient-email>
const fs = require("node:fs");
const path = require("node:path");
const FormData = require("form-data");
const Mailgun = require("mailgun.js");

function loadEnv() {
  const text = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  loadEnv();
  const to = process.argv[2] || "ss.raminder@gmail.com";
  const region = (process.env.MAILGUN_REGION || "us").toLowerCase();
  const url = region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";
  const domain = process.env.MAILGUN_DOMAIN;
  const apiKey = process.env.MAILGUN_API_KEY;
  const from = process.env.MAILGUN_FROM_EMAIL || `Cethos CAT <noreply@${domain}>`;
  if (!domain || !apiKey) {
    console.error("MAILGUN_DOMAIN / MAILGUN_API_KEY missing");
    process.exit(1);
  }

  const mg = new Mailgun(FormData).client({ username: "api", key: apiKey, url });

  console.log(`Sending test to ${to} via ${url} domain=${domain}`);
  const code = "123456";
  try {
    const res = await mg.messages.create(domain, {
      from,
      to,
      subject: `Cethos CAT smoke test code: ${code}`,
      text: `Smoke test from cethos-cat. Test code: ${code}\n\nIf you received this, Mailgun + the sender domain are wired correctly.`,
    });
    console.log("OK", JSON.stringify(res, null, 2));
  } catch (e) {
    console.error("FAILED");
    console.error(JSON.stringify({ status: e.status, message: e.message, details: e.details }, null, 2));
    process.exit(1);
  }
}
main();
