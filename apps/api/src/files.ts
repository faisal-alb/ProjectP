import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Replace a snapshot atomically so an interrupted write cannot truncate it. */
export function writeFileAtomic(file: string, data: string, mode?: number) {
  mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(temp, data, { mode, flush: true });
    renameSync(temp, file);
  } finally {
    rmSync(temp, { force: true });
  }
}
