import path from "node:path";
import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";

// One shared .env at the repo root (also read by the API and scripts).
loadEnvConfig(path.resolve(import.meta.dirname, "../.."));

const nextConfig: NextConfig = {
  // Lets a second copy of the app (e.g. for end-to-end tests) build somewhere
  // other than the dev server's own `.next` folder.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["@gridflex/shared"],
};

export default nextConfig;
