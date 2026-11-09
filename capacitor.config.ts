import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Android shell for Voygo.
 *
 * The Next.js app needs its server (API routes, middleware, Supabase SSR auth),
 * so the APK is a native WebView that loads the deployed site rather than a
 * static bundle. Build with `npm run android:apk -- https://your-app.vercel.app`
 * (see scripts/build-apk.mjs). Without a URL the APK shows the bundled
 * "not configured" page from capacitor/www.
 */
const appUrl = process.env.VOYGO_APP_URL?.trim().replace(/\/+$/, "") || undefined;

const config: CapacitorConfig = {
  appId: "com.voygo.app",
  appName: "Voygo",
  webDir: "capacitor/www",
  backgroundColor: "#f8f9fa",
  // Lets the web app detect it is running inside the APK (see src/lib/native-app.ts).
  appendUserAgent: "VoygoAndroid",
  server: appUrl
    ? {
        url: appUrl,
        // Local page shown when the site can't be reached (offline, server down).
        errorPath: "offline.html",
        cleartext: appUrl.startsWith("http://"),
      }
    : undefined,
  plugins: {
    SystemBars: {
      // Pads the WebView clear of the status/navigation bars; the site serves
      // viewport-fit=auto to the app so Capacitor keeps it out from under them.
      insetsHandling: "css",
    },
  },
};

export default config;
