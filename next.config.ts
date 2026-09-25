import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.20.45", "*.loca.lt"],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
