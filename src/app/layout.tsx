import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { isAndroidAppUserAgent } from "@/lib/native-app";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Voygo — Seamless Velocity", template: "%s | Voygo" },
  description: "Premium ride-hailing. High-end transportation that feels weightless and instantaneous.",
  applicationName: "Voygo",
  manifest: "/manifest.json",
};

export async function generateViewport(): Promise<Viewport> {
  // Android 15+ forces edge-to-edge. Inside the APK, viewport-fit=auto lets
  // Capacitor pad the WebView clear of the system bars, so fixed headers
  // don't slide under the status bar. Browsers keep the edge-to-edge layout.
  const inAndroidApp = isAndroidAppUserAgent((await headers()).get("user-agent"));
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: inAndroidApp ? "auto" : "cover",
    themeColor: "#00c853",
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      {/* Extensions (e.g. Grammarly) inject attributes on <body> before hydration. */}
      <body className="min-h-dvh font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
