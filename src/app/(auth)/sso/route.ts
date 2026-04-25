import { NextRequest, NextResponse } from "next/server";
import { verifyVendorJwt } from "@/lib/auth/sso";
import { getServiceClient } from "@/lib/supabase/server";
import { issueMfaCookie } from "@/lib/auth/mfa-cookie";
import { audit } from "@/lib/auth/audit";
import { env } from "@/lib/env";

// GET /sso?token=...  — single-use vendor portal handoff for translators.
// On success: ensure profile, sign in, set MFA cookie, redirect to translator inbox or job.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const jobRef = req.nextUrl.searchParams.get("job");
  if (!token) {
    return NextResponse.redirect(new URL("/sign-in?error=Missing+SSO+token", req.url));
  }
  try {
    const claims = await verifyVendorJwt(token);
    const supabase = await getServiceClient();

    // Upsert profile by email.
    const email = claims.email.toLowerCase();
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, role, status")
      .eq("email", email)
      .maybeSingle();

    let userId = existing?.id;
    if (!existing) {
      // Create supabase auth user with random password (translator never uses it; SSO only).
      const tmpPassword = `Sso!${crypto.randomUUID()}`;
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password: tmpPassword,
        email_confirm: true,
        user_metadata: { full_name: claims.full_name, role: claims.role ?? "translator" },
        app_metadata: { role: claims.role ?? "translator", auth_source: "vendor_portal_sso" },
      });
      if (createErr || !created.user) throw createErr ?? new Error("Failed to create SSO user");
      userId = created.user.id;
      await supabase.from("profiles").insert({
        id: userId!,
        email,
        full_name: claims.full_name,
        role: claims.role ?? "translator",
        status: "active",
        auth_source: "vendor_portal_sso",
        vendor_user_id: claims.vendor_user_id,
        mfa_required: false,            // SSO already validated by vendor portal
      });
    } else if (existing.status !== "active") {
      return NextResponse.redirect(new URL("/sign-in?error=Account+inactive", req.url));
    }

    // Mint a session for this user via magic link admin API.
    const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${env.appBaseUrl}/translator` },
    });
    if (linkErr || !link?.properties) throw linkErr ?? new Error("Failed to mint session");

    // The hashed_token can be exchanged on the client for a session.
    // We redirect through Supabase's verify endpoint which sets cookies and forwards.
    const verifyUrl = new URL(link.properties.action_link);
    if (jobRef) verifyUrl.searchParams.set("redirect_to", `${env.appBaseUrl}/translator/editor?ref=${encodeURIComponent(jobRef)}`);

    // Set MFA cookie now (SSO already verified user)
    await issueMfaCookie(userId!, email);

    await audit({
      category: "auth",
      action: "sso_signin",
      actorId: userId!,
      actorEmail: email,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null,
      userAgent: req.headers.get("user-agent") ?? null,
      meta: { vendor_user_id: claims.vendor_user_id, job_ref: jobRef },
    });

    return NextResponse.redirect(verifyUrl);
  } catch (e) {
    console.error("[sso] verification failed", e);
    return NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent("Invalid or expired SSO token.")}`, req.url));
  }
}
