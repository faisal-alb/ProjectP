// Starts the intelligence service for `npm run dev`. Without a Python venv it
// explains how to make one and exits cleanly; the shared run awaits intelligence.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const python = path.join(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");

if (!existsSync(python)) {
  console.log("No .venv at the repo root. The shared energy run needs the intelligence service and valid artifacts before it can start.");
  console.log("Set it up with `npm run intelligence:setup` (see docs/intelligence.md).");
  process.exit(0);
}

const port = process.env.INTELLIGENCE_PORT ?? "8000";
const child = spawn(
  python,
  [
    "-m", "uvicorn", "services.intelligence.app:app",
    "--host", "127.0.0.1", "--port", port,
    "--reload", "--reload-dir", "services/intelligence", "--reload-dir", "ml",
  ],
  { cwd: root, stdio: "inherit" },
);

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
