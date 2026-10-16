import type { UserPreferences } from "./user-preferences.js";
import type { UserId } from "./values.js";

// 保存内容の置き場（ポート）。実装は adapters 層（Firestore、テスト用のメモリ）に置く。
export interface UserPreferencesRepository {
  // まだ保存していない利用者には空の保存内容を返す。
  find(userId: UserId): Promise<UserPreferences>;
  save(preferences: UserPreferences): Promise<void>;
  delete(userId: UserId): Promise<void>;
}
