import type { CombatLogData, DbProvider } from './types.ts';

/**
 * Repository for inserting combat log data into SQLite.
 */
export class CombatLogRepository {
  private dbManager: DbProvider;

  constructor(dbManager: DbProvider) {
    this.dbManager = dbManager;
  }

  /**
   * Create a new run row, returning its ID.
   */
  createRun(collectionSnapshot: string, source = 'manual', strategy = ''): number {
    const db = this.dbManager.db;
    db.run(
      'INSERT INTO runs (collection_snapshot, source, strategy) VALUES (?, ?, ?)',
      [collectionSnapshot, source, strategy],
    );
    const result = db.exec('SELECT last_insert_rowid()');
    return Number(result[0].values[0][0]);
  }

  /**
   * Insert a combat and all its rounds in a single transaction.
   */
  insertCombat(data: CombatLogData): void {
    const db = this.dbManager.db;

    db.run('BEGIN TRANSACTION');
    try {
      db.run(
        `INSERT INTO combats (
          run_id, combat_number,
          player_card_id, player_card_name, player_start_hp, player_attack_mod, player_defense_mod,
          enemy_card_name, enemy_start_hp, enemy_attack_mod, enemy_defense_mod,
          total_rounds, victory
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.runId, data.combatNumber,
          data.playerCardId, data.playerCardName, data.playerStartHp, data.playerAttackMod, data.playerDefenseMod,
          data.enemyCardName, data.enemyStartHp, data.enemyAttackMod, data.enemyDefenseMod,
          data.totalRounds, data.victory ? 1 : 0,
        ],
      );

      const combatIdResult = db.exec('SELECT last_insert_rowid()');
      const combatId = Number(combatIdResult[0].values[0][0]);

      for (const round of data.rounds) {
        db.run(
          `INSERT INTO rounds (
            combat_id, round_number,
            player_attack_roll, player_defense_roll, enemy_attack_roll, enemy_defense_roll,
            player_attack_total, player_defense_total, enemy_attack_total, enemy_defense_total,
            damage_to_player, damage_to_enemy,
            player_hp_after, enemy_hp_after
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            combatId, round.roundNumber,
            round.playerAttackRoll, round.playerDefenseRoll, round.enemyAttackRoll, round.enemyDefenseRoll,
            round.playerAttackTotal, round.playerDefenseTotal, round.enemyAttackTotal, round.enemyDefenseTotal,
            round.damageToPlayer, round.damageToEnemy,
            round.playerHpAfter, round.enemyHpAfter,
          ],
        );
      }

      // Update run's total_combats
      db.run(
        'UPDATE runs SET total_combats = total_combats + 1 WHERE id = ?',
        [data.runId],
      );

      db.run('COMMIT');
    } catch (err) {
      db.run('ROLLBACK');
      throw err;
    }
  }

  /**
   * Finalize a run: set ended_at, victory status, and final collection.
   */
  finalizeRun(runId: number, victory: boolean, collectionSnapshot: string): void {
    this.dbManager.db.run(
      "UPDATE runs SET ended_at = datetime('now'), victory = ?, collection_snapshot = ? WHERE id = ?",
      [victory ? 1 : 0, collectionSnapshot, runId],
    );
  }
}
