import { Suspense } from "react";
import { headers } from "next/headers";
import { isAndroidAppUserAgent } from "@/lib/native-app";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // Decided on the server so the APK never flashes the OAuth buttons it can't use.
  const inAndroidApp = isAndroidAppUserAgent((await headers()).get("user-agent"));
  return (
    <Suspense>
      <LoginForm inAndroidApp={inAndroidApp} />
    </Suspense>
  );
}
