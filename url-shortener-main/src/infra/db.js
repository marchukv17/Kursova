import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DEFAULT_LOCATION = process.env.DB_PATH || resolve(process.cwd(), 'data', 'app.db');

export function createDatabase(location = DEFAULT_LOCATION) {
  if (location !== ':memory:') {
    mkdirSync(dirname(resolve(location)), { recursive: true });
  }
  const db = new DatabaseSync(location);
  if (location !== ':memory:') {
    try {
      db.exec('PRAGMA journal_mode = WAL;');
    } catch {
      // WAL is not supported for every filesystem; ignore.
    }
  }
  db.exec('PRAGMA foreign_keys = ON;');
  migrate(db);
  seed(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS links (
      id           TEXT PRIMARY KEY,
      slug         TEXT NOT NULL UNIQUE,
      original_url TEXT NOT NULL,
      title        TEXT,
      clicks       INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_links_slug ON links(slug);
  `);
}

function seed(db) {
  const items = db.prepare('SELECT COUNT(*) AS c FROM items').get().c;
  if (items === 0) {
    const insert = db.prepare('INSERT INTO items (name) VALUES (?)');
    for (const name of [
      'Welcome to the URL shortener (lab 1 demo item)',
      'API contract lives in docs/api/openapi.yaml',
      'This row is served from SQLite',
    ]) {
      insert.run(name);
    }
  }

  const links = db.prepare('SELECT COUNT(*) AS c FROM links').get().c;
  if (links === 0) {
    const now = new Date().toISOString();
    const insert = db.prepare(
      'INSERT INTO links (id, slug, original_url, title, clicks, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    insert.run('seed-openai', 'openai', 'https://openai.com', 'OpenAI', 0, now, now);
    insert.run('seed-nodejs', 'nodejs', 'https://nodejs.org', 'Node.js', 0, now, now);
  }
}

let singleton = null;

export function getDatabase() {
  if (!singleton) singleton = createDatabase();
  return singleton;
}
