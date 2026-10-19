import type { NextConfig } from "next";

/** Baseline browser hardening for every response. HSTS belongs on the TLS terminator (nginx/Cloudflare), not here — this app still serves plain HTTP on :8686 in preview. */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
] as const;

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,

  // sharp ships platform-specific native binaries. Marking it external keeps the bundler from
  // trying to bundle those, and makes Next's standalone dependency tracing copy the real
  // node_modules/sharp (binaries included) into the runner image. Without this the upload path
  // throws "cannot find module sharp" at runtime inside the container, which a build-time check
  // would never catch — hence the container smoke test in CI-adjacent verification.
  serverExternalPackages: ["sharp"],

  // `/documents` and `/uploads` serve user-supplied files (PDFs, images) as static assets.
  // `nosniff` stops a browser from MIME-sniffing a spoofed-but-validated file into an
  // executable content type; forcing `Content-Disposition: attachment` on documents means a
  // maliciously crafted PDF is never rendered inline in the browser context.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...SECURITY_HEADERS],
      },
      {
        source: "/documents/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Content-Disposition", value: "attachment" },
        ],
      },
      { source: "/uploads/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }] },
    ];
  },
};

export default nextConfig;
