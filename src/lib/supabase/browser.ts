"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "../env";

export function getBrowserClient() {
  return createBrowserClient(env.supabaseUrl, env.supabasePublishableKey);
}
