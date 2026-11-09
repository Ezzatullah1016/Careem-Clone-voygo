/**
 * The Android APK (Capacitor, see capacitor.config.ts) appends this token to
 * the WebView user agent so server and client code can tell they're in the app.
 */
export const ANDROID_APP_UA_TOKEN = "VoygoAndroid";

export function isAndroidAppUserAgent(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent?.includes(ANDROID_APP_UA_TOKEN));
}
