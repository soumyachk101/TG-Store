/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The backend may live on a different origin in prod (Railway).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
