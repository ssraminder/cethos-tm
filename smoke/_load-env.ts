// Loads .env.local into process.env. Imported as a side-effect FIRST in
// smoke scripts so it runs before any modules that read env vars at
// import time (e.g. src/lib/env.ts).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const envFile = path.join(__dirname, "..", ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
  }
}
