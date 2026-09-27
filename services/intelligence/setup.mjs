// Default: runtime and historical bundle preparation. --training adds ingestion.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const venv = path.join(root, ".venv");
const bin = path.join(venv, process.platform === "win32" ? "Scripts" : "bin");
const python = path.join(bin, process.platform === "win32" ? "python.exe" : "python");
const training = process.argv.includes("--training");
if (process.argv.slice(2).some(arg => arg !== "--training")) {
  console.error("Usage: npm run intelligence:setup [-- --training]");
  process.exit(1);
}

function run(cmd, args) {
  console.log(`$ ${[cmd, ...args].join(" ")}`);
  const { status } = spawnSync(cmd, args, { cwd: root, stdio: "inherit" });
  if (status !== 0) process.exit(status ?? 1);
}

// Inspect the actual existing interpreter; PYTHON does not replace an existing venv.
const interpreter = existsSync(python) ? python : process.env.PYTHON ?? "python3";
const probe = spawnSync(interpreter, ["-c", "import sys; print('%s.%s' % sys.version_info[:2])"], { encoding: "utf8" });
if (probe.status !== 0) {
  console.error(`Cannot run ${interpreter}. Install Python 3.12 and set PYTHON to its executable.`);
  process.exit(1);
}
const [major, minor] = probe.stdout.trim().split(".").map(Number);
const minimum = training ? 10 : 9;
if (major !== 3 || minor < minimum) {
  console.error(`Python ${major}.${minor} cannot run ${training ? "training setup" : "this service"}; Python 3.${minimum}+ is required (3.12 recommended).`);
  if (existsSync(python)) console.error("The existing .venv selects this interpreter. Preserve it under another name, then create a new .venv with Python 3.12; setting PYTHON alone does not replace it.");
  process.exit(1);
}
if (!existsSync(python)) run(interpreter, ["-m", "venv", ".venv"]);
run(python, ["-m", "pip", "install", "--upgrade", "pip"]);
run(python, ["-m", "pip", "install", "-r", training ? "requirements.txt" : "ml/requirements-prepare.txt"]);
run(python, ["-m", "pip", "check"]);
console.log(training
  ? "\nTraining dependencies installed. Run `npm run ml:train` only when rebuilding artifacts."
  : "\nRuntime ready. Use existing ml/artifacts with `npm run dev`. Training is optional: `npm run intelligence:setup -- --training` (Python 3.10+). Docker installs its own runtime dependencies.");
