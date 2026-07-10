"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/infrastructure/supabase/client";

/**
 * Splash screen — emerald wordmark over glass, per voygo_splash_screen.
 * Routes signed-in users straight to their portal.
 */
export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return router.replace("/login");
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();
      router.replace(profile?.role === "admin" ? "/admin" : profile?.role === "driver" ? "/driver" : "/home");
    }, 1200);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary-container/15">
      <motion.h1
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-display-lg text-primary"
      >
        Voygo
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="mt-2 text-body-lg text-on-surface-variant"
      >
        Seamless Velocity
      </motion.p>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.6, duration: 0.8, ease: "easeInOut" }}
        className="mt-8 h-1 w-24 origin-left rounded-full bg-primary-container shadow-glow"
      />
    </main>
  );
}
