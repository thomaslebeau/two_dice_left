import type { Database } from 'sql.js';

const CURRENT_VERSION = 2;

const V1_DDL = `
CREATE TABLE IF NOT EXISTS _meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  ended_at          TEXT,
  victory           INTEGER,
  total_combats     INTEGER NOT NULL DEFAULT 0,
  collection_snapshot TEXT
);

CREATE TABLE IF NOT EXISTS combats (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id            INTEGER NOT NULL REFERENCES runs(id),
  combat_number     INTEGER NOT NULL,
  player_card_id    INTEGER NOT NULL,
  player_card_name  TEXT    NOT NULL,
  player_start_hp   INTEGER NOT NULL,
  player_attack_mod INTEGER NOT NULL,
  player_defense_mod INTEGER NOT NULL,
  enemy_card_name   TEXT    NOT NULL,
  enemy_start_hp    INTEGER NOT NULL,
  enemy_attack_mod  INTEGER NOT NULL,
  enemy_defense_mod INTEGER NOT NULL,
  total_rounds      INTEGER NOT NULL,
  victory           INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rounds (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  combat_id            INTEGER NOT NULL REFERENCES combats(id),
  round_number         INTEGER NOT NULL,
  player_attack_roll   INTEGER NOT NULL,
  player_defense_roll  INTEGER NOT NULL,
  enemy_attack_roll    INTEGER NOT NULL,
  enemy_defense_roll   INTEGER NOT NULL,
  player_attack_total  INTEGER NOT NULL,
  player_defense_total INTEGER NOT NULL,
  enemy_attack_total   INTEGER NOT NULL,
  enemy_defense_total  INTEGER NOT NULL,
  damage_to_player     INTEGER NOT NULL,
  damage_to_enemy      INTEGER NOT NULL,
  player_hp_after      INTEGER NOT NULL,
  enemy_hp_after       INTEGER NOT NULL
);
`;

/**
 * Run migrations to bring the database up to the current schema version.
 */
export function migrateSchema(db: Database): void {
  // Check current version
  let currentVersion = 0;
  try {
    const result = db.exec("SELECT value FROM _meta WHERE key = 'schema_version'");
    if (result.length > 0 && result[0].values.length > 0) {
      currentVersion = Number(result[0].values[0][0]);
    }
  } catch {
    // _meta table doesn't exist yet — version 0
  }

  if (currentVersion >= CURRENT_VERSION) return;

  if (currentVersion < 1) {
    db.run(V1_DDL);
  }

  if (currentVersion < 2) {
    db.run("ALTER TABLE runs ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'");
    db.run("ALTER TABLE runs ADD COLUMN strategy TEXT NOT NULL DEFAULT ''");
  }

  db.run(
    "INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', ?)",
    [String(CURRENT_VERSION)],
  );
}
