import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serviceGroups = ["apps", "services"];
const services = [];

for (const group of serviceGroups) {
  const groupPath = path.join(root, group);
  let entries;

  try {
    entries = await readdir(groupPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const servicePath = path.join(groupPath, entry.name);

    try {
      const manifest = JSON.parse(
        await readFile(path.join(servicePath, "package.json"), "utf8"),
      );
      if (typeof manifest.scripts?.dev === "string") {
        services.push({ name: manifest.name ?? `${group}/${entry.name}`, path: servicePath });
      }
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw new Error(`Could not read ${group}/${entry.name}/package.json: ${error.message}`);
    }
  }
}

if (services.length === 0) {
  console.error("No services with a package.json dev script were found.");
  process.exit(1);
}

const npmCli = process.env.npm_execpath;
// Bun (and some other package managers) point npm_execpath at their own
// compiled binary rather than a Node-runnable JS CLI, so it must be
// executed directly instead of wrapped with `node <npmCli>`.
const npmCliIsBinary = Boolean(process.versions.bun) || (npmCli ?? "").includes("/bun");
const detached = process.platform !== "win32";
const children = services.map(({ name, path: cwd }) => {
  const child = npmCli
    ? npmCliIsBinary
      ? spawn(npmCli, ["run", "dev"], { cwd, detached })
      : spawn(process.execPath, [npmCli, "run", "dev"], { cwd, detached })
    : spawn("npm", ["run", "dev"], { cwd, detached });

  for (const stream of [child.stdout, child.stderr]) {
    if (!stream) continue;
    let pending = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";
      for (const line of lines) process.stdout.write(`[${name}] ${line}\n`);
    });
    stream.on("end", () => {
      if (pending) process.stdout.write(`[${name}] ${pending}\n`);
    });
  }

  return { name, child, exited: false };
});

console.log(`Starting ${services.map(({ name }) => name).join(", ")}`);

let stopping = false;
let exitCode = 0;

function stopAll(signal, code) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  for (const { child, exited } of children) {
    if (exited || !child.pid) continue;

    try {
      if (detached) process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
}

process.on("SIGINT", () => stopAll("SIGINT", 130));
process.on("SIGTERM", () => stopAll("SIGTERM", 143));

for (const { name, child } of children) {
  child.on("error", (error) => {
    console.error(`[${name}] ${error.message}`);
    stopAll("SIGTERM", 1);
  });

  child.on("exit", (code) => {
    const service = children.find((entry) => entry.child === child);
    if (!service || service.exited) return;
    service.exited = true;

    if (!stopping) {
      console.error(`[${name}] exited with code ${code ?? "unknown"}`);
      stopAll("SIGTERM", code ?? 1);
    }

    if (children.every((entry) => entry.exited)) process.exit(exitCode);
  });
}
