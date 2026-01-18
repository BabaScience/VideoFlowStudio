// src/main/services/preferences-service.ts
import { DatabaseConnection } from '../database/connection';

export class PreferencesService {
  private get db() {
    return DatabaseConnection.getDatabase();
  }

  async getPreference(key: string): Promise<string | null> {
    const stmt = this.db.prepare('SELECT value FROM preferences WHERE key = ?');
    const row = stmt.get(key) as any;
    return row?.value || null;
  }

  async setPreference(key: string, value: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO preferences (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
    `);
    const now = new Date().toISOString();
    stmt.run(key, value, now, value, now);
  }

  async getAllPreferences(): Promise<Record<string, string>> {
    const stmt = this.db.prepare('SELECT key, value FROM preferences');
    const rows = stmt.all() as Array<{ key: string; value: string }>;
    
    const preferences: Record<string, string> = {};
    for (const row of rows) {
      preferences[row.key] = row.value;
    }
    return preferences;
  }

  async deletePreference(key: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM preferences WHERE key = ?');
    stmt.run(key);
  }
}
