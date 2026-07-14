import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,

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
