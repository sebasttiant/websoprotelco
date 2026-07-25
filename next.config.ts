import type { NextConfig } from "next";

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
