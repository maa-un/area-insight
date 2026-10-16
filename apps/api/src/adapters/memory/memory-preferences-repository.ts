import { UserPreferences, type UserPreferencesSnapshot } from "../../domain/user-preferences.js";
import type { UserPreferencesRepository } from "../../domain/user-preferences-repository.js";
import type { UserId } from "../../domain/values.js";

// テストとローカル確認用のリポジトリ。
export class MemoryPreferencesRepository implements UserPreferencesRepository {
  readonly snapshots = new Map<string, UserPreferencesSnapshot>();

  async find(userId: UserId): Promise<UserPreferences> {
    const snapshot = this.snapshots.get(userId);
    return snapshot ? UserPreferences.restore(userId, snapshot) : UserPreferences.empty(userId);
  }

  async save(preferences: UserPreferences): Promise<void> {
    this.snapshots.set(preferences.userId, preferences.toSnapshot());
  }

  async delete(userId: UserId): Promise<void> {
    this.snapshots.delete(userId);
  }
}
