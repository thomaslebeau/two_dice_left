import initSqlJs, { type Database } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { migrateSchema } from './schema.ts';
import type { DbProvider } from './types.ts';

/**
 * Node.js-compatible DatabaseManager that persists to a file on disk.
 * Same DbProvider interface as the browser DatabaseManager, so
 * CombatLogRepository works identically with both.
 */
export class HeadlessDatabaseManager implements DbProvider {
  private _db: Database | null = null;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  get db(): Database {
    if (!this._db) throw new Error('Database not initialized');
    return this._db;
  }

  async init(): Promise<void> {
    const SQL = await initSqlJs();

    let saved: Uint8Array | null = null;
    if (existsSync(this.filePath)) {
      saved = readFileSync(this.filePath);
    }

    this._db = saved ? new SQL.Database(saved) : new SQL.Database();
    migrateSchema(this._db);
  }

  scheduleSave(): void {
    // In headless batch mode, no-op — we save explicitly at the end
  }

  saveNow(): void {
    if (!this._db) return;
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const data = this._db.export();
    writeFileSync(this.filePath, Buffer.from(data));
  }
}
