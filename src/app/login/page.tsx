"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Mail, Phone } from "lucide-react";
import { createClient } from "@/infrastructure/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "phone" | "otp" | "email" | "email_sent";

/**
 * Sign in: phone OTP (primary) + Google / Apple OAuth.
 * Splash-styled glass card over a soft emerald gradient.
 */
function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/home";

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setPending(false);
    if (error) return setError(error.message);
    setStep("otp");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
    setPending(false);
    if (error) return setError(error.message);
    router.push(next);
    router.refresh();
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setPending(false);
    if (error) return setError(error.message);
    setStep("email_sent");
  }

  async function oauth(provider: "google" | "apple") {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-background via-background to-primary-container/10 px-container-padding">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="glass-panel w-full max-w-md rounded-card p-8"
      >
        <div className="mb-8 text-center">
          <h1 className="text-display-lg text-primary">Voygo</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">Seamless Velocity</p>
        </div>

        {step === "email" && (
          <form onSubmit={sendMagicLink} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="pl-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>
            <Button type="submit" size="lg" disabled={pending || !email.includes("@")}>
              {pending && <Loader2 className="animate-spin" />}
              Send magic link
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep("phone")}>
              Use phone instead
            </Button>
          </form>
        )}

        {step === "email_sent" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <Mail className="h-10 w-10 text-primary" />
            <p className="text-body-md text-on-surface">
              Check <span className="font-semibold">{email}</span> — click the sign-in link we sent you.
            </p>
            <Button variant="ghost" onClick={() => setStep("email")}>
              Use a different email
            </Button>
          </div>
        )}

        {step === "phone" && (
          <form onSubmit={sendOtp} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Phone number</Label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="+1 555 000 0000"
                  className="pl-12"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoComplete="tel"
                />
              </div>
            </div>
            <Button type="submit" size="lg" disabled={pending || phone.length < 8}>
              {pending && <Loader2 className="animate-spin" />}
              Continue with phone
            </Button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={verifyOtp} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="otp">Verification code</Label>
              <Input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                maxLength={6}
                className="text-center text-headline-md tracking-[0.5em]"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
              />
              <p className="text-label-sm text-on-surface-variant">Sent to {phone}</p>
            </div>
            <Button type="submit" size="lg" disabled={pending || otp.length !== 6}>
              {pending && <Loader2 className="animate-spin" />}
              Verify &amp; sign in
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep("phone")}>
              Use a different number
            </Button>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-error-container px-4 py-3 text-label-md text-on-error-container">
            {error}
          </p>
        )}

        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-black/10" />
          <span className="text-label-sm text-on-surface-variant">or</span>
          <div className="h-px flex-1 bg-black/10" />
        </div>

        <div className="flex flex-col gap-3">
          {step !== "email" && step !== "email_sent" && (
            <Button variant="glass" size="lg" onClick={() => setStep("email")}>
              <Mail className="h-5 w-5" /> Continue with email
            </Button>
          )}
          <Button variant="glass" size="lg" onClick={() => oauth("google")}>
            <GoogleIcon /> Continue with Google
          </Button>
          <Button variant="glass" size="lg" onClick={() => oauth("apple")}>
            <AppleIcon /> Continue with Apple
          </Button>
        </div>

        <p className="mt-8 text-center text-label-sm text-on-surface-variant">
          By continuing you agree to Voygo&apos;s Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.1-7-5.1l-3.9 3C3.1 21.3 7.2 24 12 24z" />
      <path fill="#FBBC05" d="M5 14.3c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3l-3.9-3C.4 8.2 0 10 0 12s.4 3.8 1.1 5.3l3.9-3z" />
      <path fill="#EA4335" d="M12 4.6c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1 15.2 0 12 0 7.2 0 3.1 2.7 1.1 6.7l3.9 3c1-3 3.8-5.1 7-5.1z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M16.7 12.9c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 2.9-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.5-1-2.6-3.8zM14.4 5.6c.7-.8 1.1-1.9 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z" />
    </svg>
  );
}
