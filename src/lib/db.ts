import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "data", "app.db");

let db: Database.Database | null = null;
let tried = false;

/**
 * Returns the SQLite handle, or null when no writable location exists
 * (e.g. read-only serverless filesystems). Callers treat null as
 * "no cache" and fall back to live sources.
 */
export function getDb(): Database.Database | null {
  if (db || tried) return db;
  tried = true;
  for (const p of [DB_PATH, path.join(os.tmpdir(), "numtrace-app.db")]) {
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      db = new Database(p);
      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");
      init(db);
      return db;
    } catch {
      db = null;
    }
  }
  return null;
}

function init(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS real_people (
      id INTEGER PRIMARY KEY,
      source TEXT NOT NULL,
      name TEXT NOT NULL,
      first_name TEXT, last_name TEXT,
      address TEXT, city TEXT, state TEXT, zip TEXT,
      role TEXT,
      external_id TEXT,
      detail TEXT,
      fetched_at TEXT DEFAULT (datetime('now')),
      UNIQUE (source, name, external_id)
    );
    CREATE TABLE IF NOT EXISTS real_properties (
      id INTEGER PRIMARY KEY,
      source TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT, state TEXT, zip TEXT,
      detail TEXT,
      fetched_at TEXT DEFAULT (datetime('now')),
      UNIQUE (source, address)
    );
    CREATE TABLE IF NOT EXISTS real_phones (
      digits TEXT PRIMARY KEY,
      valid INTEGER,
      line_type TEXT,
      carrier TEXT,
      cnam TEXT,
      city TEXT,
      state TEXT,
      spam_score INTEGER,
      risk_level TEXT,
      detail TEXT,
      fetched_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_real_people_name ON real_people(name);
    CREATE INDEX IF NOT EXISTS idx_real_people_loc ON real_people(state, city);
  `);

  // migrate real_phones if it predates city/state columns
  const cols = (d.prepare(`PRAGMA table_info(real_phones)`).all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes("city")) d.exec(`ALTER TABLE real_phones ADD COLUMN city TEXT`);
  if (!cols.includes("state")) d.exec(`ALTER TABLE real_phones ADD COLUMN state TEXT`);
}
