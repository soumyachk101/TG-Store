/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The backend may live on a different origin in prod (Railway).
  // Lock the image allowlist to the Telegram CDN — anything looser lets
  // a user-controlled URL become an SSRF / exfil channel via <Image>.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.telegram.org" },
    ],
  },
  // Security response headers for the Next.js origin. The FastAPI origin
  // sets its own (see backend/app/main.py) — these cover the Vercel host.
  //
  // COOP note: Firebase Auth's `signInWithPopup` polls `popup.closed` from
  // the opener window. With `same-origin-allow-popups` Chrome emits a
  // benign but very noisy "Cross-Origin-Opener-Policy policy would
  // block the window.closed call" warning. We relax COOP to `unsafe-none`
  // on the /login route (the only place a Google popup is opened) and
  // keep `same-origin-allow-popups` everywhere else. The catch-all rule
  // MUST come after the /login rule — Next matches headers first-match
  // wins, so a more specific source overrides the broader one.
  async headers() {
    const isDev = process.env.NODE_ENV === "development";
    const cspValue = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' https://apis.google.com${
        isDev ? " 'unsafe-eval'" : ""
      }`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data: https:",
      "img-src 'self' data: blob: https://api.telegram.org",
      "media-src 'self' blob: https://api.telegram.org",
      // Build connect-src from env so the CSP stays in lockstep with
      // the actual API origin. Hard-coded Railway slugs and the
      // firebaseio.com wildcard are gone; localhost is only included
      // in development.
      [
        "connect-src 'self'",
        "https://*.googleapis.com",
        "https://*.firebaseapp.com",
        "https://api.telegram.org",
        process.env.NEXT_PUBLIC_API_URL || "",
        ...(isDev ? ["http://localhost:8000", "ws:", "wss:"] : []),
      ]
        .filter(Boolean)
        .join(" "),
      // Allow the Google sign-in popup iframe as well as the Firebase
      // auth iframe. Without `https://accounts.google.com` the Google
      // button is blocked by CSP frame-src.
      "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    const baseHeaders = (coopValue) => [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Cross-Origin-Opener-Policy", value: coopValue },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];

    return [
      // /login first (more specific). CSP still enforced; only COOP
      // is relaxed so Firebase can poll popup.closed.
      {
        source: "/login",
        headers: [
          ...baseHeaders("unsafe-none"),
          { key: "Content-Security-Policy", value: cspValue },
        ],
      },
      // Catch-all: hardened COOP for the dashboard / APIs.
      {
        source: "/:path*",
        headers: [
          ...baseHeaders("same-origin-allow-popups"),
          { key: "Content-Security-Policy", value: cspValue },
        ],
      },
    ];
  },
};

export default nextConfig;
