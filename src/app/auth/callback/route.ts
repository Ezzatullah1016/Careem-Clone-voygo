import { NextResponse } from "next/server";
import { createClient } from "@/infrastructure/supabase/server";

/**
 * OAuth callback (Google / Apple). Exchanges the auth code for a session,
 * then routes users to their portal based on role.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (next) return NextResponse.redirect(`${origin}${next}`);

      const { data: auth } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user!.id)
        .single();

      const dest = profile?.role === "admin" ? "/admin" : profile?.role === "driver" ? "/driver" : "/home";
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
