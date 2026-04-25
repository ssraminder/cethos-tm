/**
 * Generate a human-friendly job reference like J-202604-A7K2.
 * Year+month for at-a-glance dating; 4-char base32 for uniqueness.
 */
export function generateJobReference(): string {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `J-${ym}-${suffix}`;
}
