"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Lock, Mail, Phone, User } from "lucide-react";
import { createClient } from "@/infrastructure/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Step = "password" | "email_link" | "email_sent" | "phone" | "sms_code" | "confirm_sent";
type PasswordMode = "signin" | "signup";

/** Which Supabase auth providers are switched on (read from the project's /auth/v1/settings). */
export interface AuthProviders {
  phone: boolean;
  google: boolean;
  apple: boolean;
}

/** Supabase's default minimum password length. */
const MIN_PASSWORD = 6;
/** Supabase allows one OTP send per number per 60s by default. */
const RESEND_COOLDOWN_S = 60;

interface LoginFormProps {
  /**
   * Running inside the Android APK. Google blocks OAuth in embedded WebViews and
   * email links open in the phone's browser, so the app signs in with email +
   * password (and SMS codes when phone auth is enabled).
   */
  inAndroidApp: boolean;
  providers: AuthProviders;
}

/**
 * Sign in: email + password (works everywhere, incl. the APK), plus — when
 * enabled in Supabase — SMS codes, and on the web email links and Google / Apple.
 * Splash-styled glass card over a soft emerald gradient.
 */
export function LoginForm({ inAndroidApp, providers }: LoginFormProps) {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/home";

  const [step, setStep] = useState<Step>("password");
  const [mode, setMode] = useState<PasswordMode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    // /auth/callback sends ?error=auth when a link can't be exchanged here — typically an
    // email-confirmation link opened in a different browser/app. The email is still confirmed.
    params.get("error") === "auth"
      ? "That link couldn't sign you in on this device. If you were confirming your email, it's confirmed — sign in with your password."
      : null
  );

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const callbackUrl = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  function goTo(nextStep: Step) {
    setError(null);
    setCode("");
    setStep(nextStep);
  }

  function signedIn() {
    // Stay "pending" while navigating so the form can't be submitted twice.
    router.push(next);
    router.refresh();
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setPending(false);
        return setError(
          /not confirmed/i.test(error.message)
            ? "Confirm your email first: open the link we emailed you (any browser is fine), then sign in here."
            : error.message
        );
      }
      return signedIn();
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // Picked up by the handle_new_user trigger into profiles.full_name.
        data: fullName.trim() ? { full_name: fullName.trim() } : undefined,
        emailRedirectTo: callbackUrl(),
      },
    });
    if (error) {
      setPending(false);
      return setError(error.message);
    }
    // With "Confirm email" off, Supabase signs the user in straight away.
    if (data.session) return signedIn();
    setPending(false);
    setStep("confirm_sent");
  }

  async function sendEmailLink(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl() },
    });
    setPending(false);
    if (error) return setError(error.message);
    setStep("email_sent");
  }

  async function sendSms() {
    setPending(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ phone: phone.trim() });
    setPending(false);
    if (error) return setError(error.message);
    setCode("");
    setResendIn(RESEND_COOLDOWN_S);
    setStep("sms_code");
  }

  async function verifySms(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ phone: phone.trim(), token: code, type: "sms" });
    if (error) {
      setPending(false);
      return setError(error.message);
    }
    signedIn();
  }

  async function oauth(provider: "google" | "apple") {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl() } });
    if (error) setError(error.message);
  }

  // Alternatives under the divider: only methods that work here.
  const alternatives = [
    step !== "password" && step !== "confirm_sent" && (
      <Button key="password" variant="glass" size="lg" onClick={() => goTo("password")}>
        <Lock className="h-5 w-5" /> Sign in with email &amp; password
      </Button>
    ),
    // Email links open in the phone's browser, not the APK, so they're web-only.
    !inAndroidApp && step !== "email_link" && step !== "email_sent" && (
      <Button key="email" variant="glass" size="lg" onClick={() => goTo("email_link")}>
        <Mail className="h-5 w-5" /> Email me a sign-in link
      </Button>
    ),
    providers.phone && step !== "phone" && step !== "sms_code" && (
      <Button key="phone" variant="glass" size="lg" onClick={() => goTo("phone")}>
        <Phone className="h-5 w-5" /> Continue with phone
      </Button>
    ),
    !inAndroidApp && providers.google && (
      <Button key="google" variant="glass" size="lg" onClick={() => oauth("google")}>
        <GoogleIcon /> Continue with Google
      </Button>
    ),
    !inAndroidApp && providers.apple && (
      <Button key="apple" variant="glass" size="lg" onClick={() => oauth("apple")}>
        <AppleIcon /> Continue with Apple
      </Button>
    ),
  ].filter(Boolean);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-background via-background to-primary-container/10 px-container-padding py-8">
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

        {step === "password" && (
          <form onSubmit={submitPassword} className="flex flex-col gap-4">
            <div role="tablist" aria-label="Account" className="grid grid-cols-2 gap-1 rounded-full bg-surface-container p-1">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                  className={cn(
                    "rounded-full py-2 text-label-md transition-all",
                    mode === m ? "bg-white text-on-surface shadow-sm dark:bg-white/15 dark:text-white" : "text-on-surface-variant"
                  )}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            {mode === "signup" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Full name</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
                  <Input
                    id="name"
                    placeholder="Your name"
                    className="pl-12"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
              </div>
            )}

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
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={mode === "signup" ? `At least ${MIN_PASSWORD} characters` : "Your password"}
                  className="pl-12 pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={MIN_PASSWORD}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-secondary"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={pending || !email.includes("@") || password.length < MIN_PASSWORD}
            >
              {pending && <Loader2 className="animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
        )}

        {step === "confirm_sent" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <Mail className="h-10 w-10 text-primary" />
            <p className="text-body-md text-on-surface">
              We sent a confirmation link to <span className="font-semibold">{email}</span>.
            </p>
            <p className="text-label-md text-on-surface-variant">
              Open it on any device or browser, then come back here and sign in with your password.
            </p>
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                setMode("signin");
                goTo("password");
              }}
            >
              Back to sign in
            </Button>
          </div>
        )}

        {step === "email_link" && (
          <form onSubmit={sendEmailLink} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="link-email">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
                <Input
                  id="link-email"
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
              Send sign-in link
            </Button>
          </form>
        )}

        {step === "email_sent" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <Mail className="h-10 w-10 text-primary" />
            <p className="text-body-md text-on-surface">
              Check <span className="font-semibold">{email}</span> and open the sign-in link in this browser.
            </p>
            <Button variant="ghost" onClick={() => goTo("email_link")}>
              Use a different email
            </Button>
          </div>
        )}

        {step === "phone" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendSms();
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
                  autoFocus
                />
              </div>
            </div>
            <Button type="submit" size="lg" disabled={pending || phone.length < 8}>
              {pending && <Loader2 className="animate-spin" />}
              Text me a code
            </Button>
          </form>
        )}

        {step === "sms_code" && (
          <form onSubmit={verifySms} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="otp">Verification code</Label>
              <Input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                maxLength={6}
                className="text-center text-headline-md tracking-[0.5em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
              />
              <p className="text-label-sm text-on-surface-variant">Sent by SMS to {phone}</p>
            </div>
            <Button type="submit" size="lg" disabled={pending || code.length !== 6}>
              {pending && <Loader2 className="animate-spin" />}
              Verify &amp; sign in
            </Button>
            <div className="flex justify-between gap-2">
              <Button type="button" variant="ghost" onClick={() => goTo("phone")}>
                Different number
              </Button>
              <Button type="button" variant="ghost" disabled={pending || resendIn > 0} onClick={() => void sendSms()}>
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

        {alternatives.length > 0 && (
          <>
            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-black/10" />
              <span className="text-label-sm text-on-surface-variant">or</span>
              <div className="h-px flex-1 bg-black/10" />
            </div>
            <div className="flex flex-col gap-3">{alternatives}</div>
          </>
        )}

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
