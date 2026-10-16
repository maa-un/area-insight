import { EMPTY_USER_DATA, UserData } from "@area-insight/shared";
import type { Firestore } from "@google-cloud/firestore";
import { UserPreferences } from "../../domain/user-preferences.js";
import type { UserPreferencesRepository } from "../../domain/user-preferences-repository.js";
import type { UserId } from "../../domain/values.js";

// (default) データベースは他の用途と共有しうるため、コレクション名にサービス名を付ける。
const COLLECTION = "area-insight-users";

// Firestore に 1 利用者 1 ドキュメントで保存する。ドキュメントの形は画面との取り決め（UserData）と同じ。
export class FirestorePreferencesRepository implements UserPreferencesRepository {
  constructor(private readonly db: Firestore) {}

  async find(userId: UserId): Promise<UserPreferences> {
    const snapshot = await this.doc(userId).get();
    // 保存されている値も外から来るものとして検証する。
    const data = UserData.parse({ ...EMPTY_USER_DATA, ...snapshot.data() });
    return UserPreferences.restore(userId, data);
  }

  async save(preferences: UserPreferences): Promise<void> {
    await this.doc(preferences.userId).set({ ...preferences.toSnapshot(), updatedAt: new Date() });
  }

  async delete(userId: UserId): Promise<void> {
    await this.doc(userId).delete();
  }

  private doc(userId: UserId) {
    return this.db.collection(COLLECTION).doc(userId);
  }
}
