// Creates the repo-root .venv and installs what serving and training need.
// Needs Python 3.10 or newer on PATH as python3 (or set PYTHON).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const venv = path.join(root, ".venv");
const bin = path.join(venv, process.platform === "win32" ? "Scripts" : "bin");

function run(cmd, args) {
  console.log(`$ ${[cmd, ...args].join(" ")}`);
  const { status } = spawnSync(cmd, args, { cwd: root, stdio: "inherit" });
  if (status !== 0) process.exit(status ?? 1);
}

if (!existsSync(venv)) run(process.env.PYTHON ?? "python3", ["-m", "venv", ".venv"]);
run(path.join(bin, "pip"), ["install", "--upgrade", "pip"]);
run(path.join(bin, "pip"), ["install", "-r", "services/intelligence/requirements.txt", "-r", "requirements.txt"]);
console.log("\nDone. Train the models with `npm run ml:train`, or start the service now on placeholders.");
