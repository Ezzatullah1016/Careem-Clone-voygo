import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const PUBLIC_PATHS = ["/", "/login", "/auth/callback", "/auth/verify"];

/**
 * Session refresh + route protection.
 * - Refreshes the Supabase session cookie on every request.
 * - Redirects unauthenticated users to /login for app routes.
 * - Enforces role gates for /driver and /admin (role read from JWT-backed profile).
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          cookiesToSet.forEach(({ name, value }: CookieToSet) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/_next");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Role gating for portal roots. Deep authorization stays in RLS.
  if (user && (pathname.startsWith("/driver") || pathname.startsWith("/admin"))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;
    if (pathname.startsWith("/admin") && role !== "admin") {
      return NextResponse.redirect(new URL("/home", request.url));
    }
    if (pathname.startsWith("/driver") && role !== "driver" && role !== "admin") {
      return NextResponse.redirect(new URL("/home", request.url));
    }
  }

  return response;
}

export const config = {
  // Static files skip auth; .apk so the Android download (public/downloads) works signed-out.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|webp|apk)).*)"],
};
