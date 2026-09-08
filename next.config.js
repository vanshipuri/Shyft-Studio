/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  // Next.js 16 builds with Turbopack by default. This app needs no bundler
  // customisation: `better-sqlite3` / `fs` / `path` are only ever imported by
  // server components and API routes, never by a client island — so the old
  // webpack `resolve.fallback` shim is gone rather than ported.
  turbopack: {},
};

module.exports = nextConfig;
