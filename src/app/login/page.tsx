import { Suspense } from "react";
import { headers } from "next/headers";
import { isAndroidAppUserAgent } from "@/lib/native-app";
import { LoginForm, type AuthProviders } from "./login-form";

/**
 * Which auth providers are switched on in the Supabase project, so the form only
 * offers methods that work (e.g. phone/Google stay hidden until configured).
 */
async function enabledProviders(): Promise<AuthProviders> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`auth settings ${res.status}`);
    const { external } = (await res.json()) as { external?: Record<string, boolean> };
    return { phone: Boolean(external?.phone), google: Boolean(external?.google), apple: Boolean(external?.apple) };
  } catch {
    // Email + password still works; just don't advertise anything we can't confirm.
    return { phone: false, google: false, apple: false };
  }
}

export default async function LoginPage() {
  // Decided on the server so the APK never flashes options it can't use.
  const [requestHeaders, providers] = await Promise.all([headers(), enabledProviders()]);
  const inAndroidApp = isAndroidAppUserAgent(requestHeaders.get("user-agent"));
  return (
    <Suspense>
      <LoginForm inAndroidApp={inAndroidApp} providers={providers} />
    </Suspense>
  );
}
