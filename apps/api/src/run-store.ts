import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { RunState } from "@gridflex/shared";

/** WAL transactions commit snapshots and their evidence together. */
export class RunStore {
  readonly db: Database.Database;
  constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    this.db = new Database(path.join(dir, "runs.sqlite"));
    this.db.pragma("journal_mode = WAL");
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, state TEXT NOT NULL, updated INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS legacy_markets(id TEXT PRIMARY KEY, record TEXT NOT NULL);`);
  }
  current(): RunState | null {
    const row = this.db
      .prepare(
        "SELECT state FROM runs WHERE id=(SELECT value FROM metadata WHERE key='active')",
      )
      .get() as { state: string } | undefined;
    return row ? JSON.parse(row.state) : null;
  }
  save(run: RunState) {
    this.db.transaction(() => {
      this.db
        .prepare("INSERT OR REPLACE INTO runs VALUES(?,?,?)")
        .run(run.id, JSON.stringify(run), Date.now());
      this.db
        .prepare("INSERT OR REPLACE INTO metadata VALUES('active',?)")
        .run(run.id);
    })();
  }
  importLegacy(records: { id: string }[]) {
    const insert = this.db.prepare(
      "INSERT OR IGNORE INTO legacy_markets VALUES(?,?)",
    );
    this.db.transaction(() => {
      for (const r of records)
        insert.run(
          r.id,
          JSON.stringify(r, (_, v) =>
            typeof v === "bigint" ? v.toString() : v,
          ),
        );
    })();
  }
  close() {
    this.db.close();
  }
}
