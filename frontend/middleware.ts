/** Next.js middleware: redirect unauthenticated users to /login. */
import { auth } from "@/auth";
import { NextResponse } from "next/server";

/**
 * Only accept same-origin paths as the post-login redirect target. Without
 * this, a crafted `?next=https://evil.com` would let an attacker use the
 * login redirect as an open-redirect primitive.
 */
function safeNext(raw: string): string {
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  return raw;
}

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isAuthPage = nextUrl.pathname.startsWith("/login");
  const isApiAuth = nextUrl.pathname.startsWith("/api/auth");
  const isPublicPage = ["/terms", "/privacy", "/disclaimer"].includes(nextUrl.pathname);

  if (isApiAuth) return NextResponse.next();
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }
  if (!isLoggedIn && !isAuthPage && !isPublicPage) {
    const url = new URL("/login", nextUrl);
    if (nextUrl.pathname !== "/") {
      url.searchParams.set("next", safeNext(nextUrl.pathname));
    }
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
