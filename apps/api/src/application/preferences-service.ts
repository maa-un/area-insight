import type { UserPreferences, UserPreferencesSnapshot } from "../domain/user-preferences.js";
import type { UserPreferencesRepository } from "../domain/user-preferences-repository.js";
import type { SavedFilter, UserId } from "../domain/values.js";
import type { AccountEvent } from "./ports.js";

// 保存 API のユースケース。HTTP や保存先の仕組みは知らず、リポジトリ（ポート）だけを使う。
export class PreferencesService {
  constructor(private readonly repository: UserPreferencesRepository) {}

  async get(userId: UserId): Promise<UserPreferencesSnapshot> {
    return (await this.repository.find(userId)).toSnapshot();
  }

  replaceFavorites(userId: UserId, codes: readonly string[]): Promise<UserPreferencesSnapshot> {
    return this.change(userId, (prefs) => prefs.replaceFavorites(codes));
  }

  replaceCompare(userId: UserId, codes: readonly string[]): Promise<UserPreferencesSnapshot> {
    return this.change(userId, (prefs) => prefs.replaceCompare(codes));
  }

  replaceFilters(
    userId: UserId,
    filters: readonly SavedFilter[],
  ): Promise<UserPreferencesSnapshot> {
    return this.change(userId, (prefs) => prefs.replaceFilters(filters));
  }

  // 退会した利用者の保存内容を消す。それ以外の出来事は受け取るだけ。
  async handleAccountEvent(event: AccountEvent): Promise<void> {
    if (event.type === "account-deleted") await this.repository.delete(event.userId);
  }

  private async change(
    userId: UserId,
    apply: (prefs: UserPreferences) => UserPreferences,
  ): Promise<UserPreferencesSnapshot> {
    const next = apply(await this.repository.find(userId));
    await this.repository.save(next);
    return next.toSnapshot();
  }
}
