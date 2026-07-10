"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client (anon key, RLS enforced). Singleton per tab. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export type BrowserSupabase = ReturnType<typeof createClient>;
