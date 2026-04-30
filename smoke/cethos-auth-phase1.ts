/**
 * Phase 1 smoke: exercise the new @cethos/auth lib end-to-end against
 * the production database. We:
 *   1. Create a test user
 *   2. Issue an email OTP, verify it
 *   3. Create a session, fetch user via session
 *   4. Set + verify a password
 *   5. Issue + verify a phone OTP
 *   6. Revoke the session
 *   7. Clean up
 *
 * Run: npx tsx smoke/cethos-auth-phase1.ts
 */
import "./_load-env";
import {
  issueOtp,
  verifyOtp,
  createSession,
  getSessionUser,
  revokeSession,
  hashPassword,
  verifyPassword,
  upsertOnSignIn,
  updatePasswordHash,
  setPhone,
} from "../src/lib/cethos-auth";
import { getServiceClient } from "../src/lib/supabase/server";

async function main() {
  const email = `phase1-smoke-${Date.now()}@cethos.test`;
  const phone = `+1555${Math.floor(Math.random() * 9000000 + 1000000)}`;
  console.log(`Test user: ${email} / ${phone}\n`);

  // 1. Upsert the user
  const user = await upsertOnSignIn({ email, default_role: "translator" });
  console.log(`✓ created user ${user.id}`);

  // 2. Email OTP. Note: email_otps.user_id has FK to auth.users (legacy);
  // the new cethos_users id won't validate there until Phase 2 drops the
  // FK. For now, leave user_id null and resolve the user by email after
  // verify — which is exactly the production flow anyway.
  const emailIssued = await issueOtp({ channel: "email", recipient: email });
  console.log(`✓ issued email OTP (code=${emailIssued.code})`);

  const wrongVerify = await verifyOtp({ channel: "email", recipient: email, code: "000000" });
  if (wrongVerify.ok) throw new Error("wrong code unexpectedly accepted");
  console.log(`✓ wrong code rejected (${wrongVerify.reason})`);

  const emailVerify = await verifyOtp({ channel: "email", recipient: email, code: emailIssued.code });
  if (!emailVerify.ok) throw new Error(`email verify failed: ${emailVerify.reason}`);
  console.log(`✓ verified email OTP`);

  const replay = await verifyOtp({ channel: "email", recipient: email, code: emailIssued.code });
  if (replay.ok) throw new Error("replayed OTP accepted — burn-on-success broken");
  console.log(`✓ replay rejected`);

  // 3. Session
  const session = await createSession({ user_id: user.id, ip_address: "127.0.0.1", user_agent: "smoke" });
  console.log(`✓ session ${session.id} expires ${session.expires_at}`);

  const sessionUser = await getSessionUser(session.id);
  if (!sessionUser || sessionUser.user.email !== email) throw new Error("getSessionUser mismatch");
  console.log(`✓ getSessionUser returned ${sessionUser.user.email}`);

  // 4. Password
  const tooShort = await hashPassword("short");
  if (tooShort.ok) throw new Error("min-length not enforced");
  console.log(`✓ password min-length enforced`);

  const hashed = await hashPassword("a-strong-password-12345");
  if (!hashed.ok) throw new Error("hashPassword failed");
  await updatePasswordHash({ user_id: user.id, password_hash: hashed.hash });
  console.log(`✓ password set`);

  if (!(await verifyPassword("a-strong-password-12345", hashed.hash))) {
    throw new Error("verifyPassword(correct) failed");
  }
  if (await verifyPassword("wrong-password", hashed.hash)) {
    throw new Error("verifyPassword(wrong) returned true");
  }
  console.log(`✓ password verify (correct + wrong)`);

  // 5. Phone OTP — phone_otps.user_id FKs to cethos_users so we CAN
  // pass it (this table was created in Phase 1).
  await setPhone(user.id, phone);
  const phoneIssued = await issueOtp({ channel: "phone", recipient: phone, user_id: user.id });
  console.log(`✓ issued phone OTP (code=${phoneIssued.code})`);

  const phoneVerify = await verifyOtp({ channel: "phone", recipient: phone, code: phoneIssued.code });
  if (!phoneVerify.ok) throw new Error(`phone verify failed: ${phoneVerify.reason}`);
  console.log(`✓ verified phone OTP`);

  // 6. Revoke session
  await revokeSession(session.id);
  const dead = await getSessionUser(session.id);
  if (dead) throw new Error("revoked session still resolves");
  console.log(`✓ session revoked`);

  // 7. Cleanup
  const supabase = await getServiceClient();
  await supabase.from("cethos_users").delete().eq("id", user.id);
  console.log(`✓ cleaned up`);

  console.log(`\n🎉 Phase 1 smoke passed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
