import initSqlJs, { type Database } from 'sql.js';
import { migrateSchema } from './schema.ts';
import type { DbProvider } from './types.ts';

const IDB_NAME = 'dices_and_cards_db';
const IDB_STORE = 'sqlitedb';
const IDB_KEY = 'main';
const SAVE_DEBOUNCE_MS = 2000;

/**
 * Manages a sql.js SQLite database with IndexedDB persistence.
 */
export class DatabaseManager implements DbProvider {
  private _db: Database | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  get db(): Database {
    if (!this._db) throw new Error('Database not initialized');
    return this._db;
  }

  /**
   * Initialize sql.js WASM, load existing DB from IndexedDB (if any),
   * and run schema migrations.
   */
  async init(): Promise<void> {
    const SQL = await initSqlJs({
      locateFile: (file: string) => `/${file}`,
    });

    const saved = await this.loadFromIndexedDB();
    this._db = saved ? new SQL.Database(saved) : new SQL.Database();

    migrateSchema(this._db);

    // Persist after initial migration if DB was just created
    if (!saved) {
      await this.saveNow();
    }
  }

  /**
   * Schedule a debounced save to IndexedDB.
   */
  scheduleSave(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saveNow();
    }, SAVE_DEBOUNCE_MS);
  }

  /**
   * Immediately persist the database to IndexedDB.
   */
  async saveNow(): Promise<void> {
    if (!this._db) return;
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const data = this._db.export();
    await this.saveToIndexedDB(data);
  }

  // --- IndexedDB helpers ---

  private openIDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const idb = req.result;
        if (!idb.objectStoreNames.contains(IDB_STORE)) {
          idb.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async loadFromIndexedDB(): Promise<Uint8Array | null> {
    const idb = await this.openIDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => {
        idb.close();
        resolve(req.result instanceof Uint8Array ? req.result : null);
      };
      req.onerror = () => {
        idb.close();
        reject(req.error);
      };
    });
  }

  private async saveToIndexedDB(data: Uint8Array): Promise<void> {
    const idb = await this.openIDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(data, IDB_KEY);
      req.onsuccess = () => {
        idb.close();
        resolve();
      };
      req.onerror = () => {
        idb.close();
        reject(req.error);
      };
    });
  }
}
