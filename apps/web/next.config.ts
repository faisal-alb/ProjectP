import { existsSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// One shared .env at the repo root (also read by the API and scripts). Next only
// reads apps/web/.env*, and @next/env's loader is a no-op after its first call,
// so load the root file directly. Variables already set (e.g. by compose) win.
const rootEnv = path.resolve(import.meta.dirname, "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  // Lets a second copy of the app (e.g. for end-to-end tests) build somewhere
  // other than the dev server's own `.next` folder.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["@gridflex/shared"],
};

export default nextConfig;
