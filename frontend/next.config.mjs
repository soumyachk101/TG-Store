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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // React 18 / Next.js dev tools need unsafe-eval in development
              ...(process.env.NODE_ENV === "development"
                ? ["'unsafe-eval'", "'unsafe-inline'"]
                : []),
              "img-src 'self' data: blob: https://api.telegram.org",
              "media-src 'self' blob: https://api.telegram.org",
              "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://api.telegram.org",
              "frame-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
