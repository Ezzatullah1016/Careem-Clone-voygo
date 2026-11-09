"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Mail, Phone } from "lucide-react";
import { createClient } from "@/infrastructure/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "phone" | "email" | "code";
type CodeTarget = { channel: "sms"; phone: string } | { channel: "email"; email: string };

/** Supabase allows one OTP send per address per 60s by default. */
const RESEND_COOLDOWN_S = 60;
/** Supabase OTP length is configurable (6–10 digits); 6 is the default. */
const MIN_CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 10;

interface LoginFormProps {
  /**
   * Running inside the Android APK. Google blocks OAuth in embedded WebViews
   * and email links open in the external browser, so the app signs in with
   * one-time codes typed into the app.
   */
  inAndroidApp: boolean;
}

/**
 * Sign in with a one-time code sent by SMS or email (works on web and in the
 * APK), plus Google / Apple OAuth on the web. Splash-styled glass card over a
 * soft emerald gradient.
 */
export function LoginForm({ inAndroidApp }: LoginFormProps) {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/home";

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [target, setTarget] = useState<CodeTarget | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function sendCode(to: CodeTarget) {
    setPending(true);
    setError(null);
    const { error } =
      to.channel === "sms"
        ? await supabase.auth.signInWithOtp({ phone: to.phone })
        : await supabase.auth.signInWithOtp({
            email: to.email,
            // The email carries both the code (typed into the app) and a sign-in link (web).
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
            },
          });
    setPending(false);
    if (error) return setError(error.message);
    setTarget(to);
    setCode("");
    setResendIn(RESEND_COOLDOWN_S);
    setStep("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setPending(true);
    setError(null);
    const { error } =
      target.channel === "sms"
        ? await supabase.auth.verifyOtp({ phone: target.phone, token: code, type: "sms" })
        : await supabase.auth.verifyOtp({ email: target.email, token: code, type: "email" });
    if (error) {
      setPending(false);
      return setError(error.message);
    }
    // Stay "pending" while navigating so the form can't be submitted twice.
    router.push(next);
    router.refresh();
  }

  function switchTo(nextStep: "phone" | "email") {
    setError(null);
    setCode("");
    setStep(nextStep);
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendCode({ channel: "email", email: email.trim() });
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
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
              Email me a sign-in code
            </Button>
          </form>
        )}

        {step === "phone" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendCode({ channel: "sms", phone: phone.trim() });
            }}
            className="flex flex-col gap-4"
          >
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

        {step === "code" && target && (
          <form onSubmit={verifyCode} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="otp">Verification code</Label>
              <Input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                maxLength={MAX_CODE_LENGTH}
                className="text-center text-headline-md tracking-[0.5em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
              />
              <p className="text-label-sm text-on-surface-variant">
                {target.channel === "sms" ? (
                  <>Sent by SMS to {target.phone}</>
                ) : (
                  <>
                    Sent to <span className="font-semibold">{target.email}</span>. Enter the code from the email
                    {inAndroidApp ? "." : ", or tap the link in it on this device."}
                  </>
                )}
              </p>
            </div>
            <Button type="submit" size="lg" disabled={pending || code.length < MIN_CODE_LENGTH}>
              {pending && <Loader2 className="animate-spin" />}
              Verify &amp; sign in
            </Button>
            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => switchTo(target.channel === "sms" ? "phone" : "email")}
              >
                {target.channel === "sms" ? "Different number" : "Different email"}
              </Button>
              <Button type="button" variant="ghost" disabled={pending || resendIn > 0} onClick={() => void sendCode(target)}>
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </Button>
            </div>
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
          {step !== "email" && !(step === "code" && target?.channel === "email") && (
            <Button variant="glass" size="lg" onClick={() => switchTo("email")}>
              <Mail className="h-5 w-5" /> Continue with email
            </Button>
          )}
          {step !== "phone" && !(step === "code" && target?.channel === "sms") && (
            <Button variant="glass" size="lg" onClick={() => switchTo("phone")}>
              <Phone className="h-5 w-5" /> Continue with phone
            </Button>
          )}
          {!inAndroidApp && (
            <>
              <Button variant="glass" size="lg" onClick={() => oauth("google")}>
                <GoogleIcon /> Continue with Google
              </Button>
              <Button variant="glass" size="lg" onClick={() => oauth("apple")}>
                <AppleIcon /> Continue with Apple
              </Button>
            </>
          )}
        </div>

        <p className="mt-8 text-center text-label-sm text-on-surface-variant">
          By continuing you agree to Voygo&apos;s Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </main>
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
