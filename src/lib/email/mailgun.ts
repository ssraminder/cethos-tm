import FormData from "form-data";
import Mailgun from "mailgun.js";
import type { IMailgunClient } from "mailgun.js/Interfaces";
import { env } from "../env";

let cachedClient: IMailgunClient | null = null;

function client(): IMailgunClient {
  if (cachedClient) return cachedClient;
  if (!env.mailgun.apiKey || !env.mailgun.domain) {
    throw new Error("Mailgun is not configured (MAILGUN_API_KEY / MAILGUN_DOMAIN missing)");
  }
  // mailgun.js's default export is a constructor that takes FormData.
  const MG = Mailgun as unknown as new (fd: typeof FormData) => { client: (opts: { username: string; key: string; url?: string }) => IMailgunClient };
  const mg = new MG(FormData);
  cachedClient = mg.client({
    username: "api",
    key: env.mailgun.apiKey,
    url: env.mailgun.region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net",
  });
  return cachedClient;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ id?: string; ok: boolean }> {
  if (!env.mailgun.apiKey || !env.mailgun.domain) {
    console.warn("[mailgun] not configured — printing email body to stderr");
    console.warn(`[mailgun] To: ${input.to}\nSubject: ${input.subject}\n\n${input.text}`);
    return { ok: true };
  }
  const mg = client();
  const res = await mg.messages.create(env.mailgun.domain, {
    from: env.mailgun.fromEmail,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    "h:Reply-To": input.replyTo,
  });
  return { id: res.id, ok: res.status >= 200 && res.status < 300 };
}

export function renderOtpEmail(opts: { code: string; purpose: string; minutesValid: number }) {
  const purposeLabel: Record<string, string> = {
    signin_mfa: "Sign-in verification",
    email_verify: "Email verification",
    password_reset: "Password reset",
    invite_accept: "Invitation",
  };
  const subject = `Your Cethos CAT code: ${opts.code}`;
  const text = `Your ${purposeLabel[opts.purpose] ?? "verification"} code is:\n\n  ${opts.code}\n\nThis code expires in ${opts.minutesValid} minutes. If you did not request it, you can ignore this email.`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0C2340">
    <h1 style="font-size:18px;margin:0 0 16px">Cethos CAT</h1>
    <p style="margin:0 0 16px">Your ${purposeLabel[opts.purpose] ?? "verification"} code:</p>
    <p style="font-family:'JetBrains Mono',monospace;font-size:32px;letter-spacing:8px;font-weight:700;margin:0 0 16px;padding:16px;background:#ECFEFF;border-radius:8px;text-align:center;color:#0E7490">${opts.code}</p>
    <p style="margin:0;color:#64748B;font-size:13px">This code expires in ${opts.minutesValid} minutes. If you did not request it, you can ignore this email.</p>
  </div>`;
  return { subject, text, html };
}
