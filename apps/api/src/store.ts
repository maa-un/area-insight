import { EMPTY_USER_DATA, UserData } from "@area-insight/shared";
import type { Firestore } from "@google-cloud/firestore";

export interface UserStore {
  get(userId: string): Promise<UserData>;
  update(userId: string, patch: Partial<UserData>): Promise<UserData>;
  delete(userId: string): Promise<void>;
}

// (default) データベースは他の用途と共有しうるため、コレクション名にサービス名を付ける。
const COLLECTION = "area-insight-users";

export class FirestoreUserStore implements UserStore {
  constructor(private readonly db: Firestore) {}

  async get(userId: string): Promise<UserData> {
    const snapshot = await this.doc(userId).get();
    return UserData.parse({ ...EMPTY_USER_DATA, ...snapshot.data() });
  }

  async update(userId: string, patch: Partial<UserData>): Promise<UserData> {
    await this.doc(userId).set({ ...patch, updatedAt: new Date() }, { merge: true });
    return this.get(userId);
  }

  async delete(userId: string): Promise<void> {
    await this.doc(userId).delete();
  }

  private doc(userId: string) {
    return this.db.collection(COLLECTION).doc(userId);
  }
}

// テストとローカル確認用。
export class MemoryUserStore implements UserStore {
  readonly users = new Map<string, UserData>();

  async get(userId: string): Promise<UserData> {
    return this.users.get(userId) ?? EMPTY_USER_DATA;
  }

  async update(userId: string, patch: Partial<UserData>): Promise<UserData> {
    const next = { ...(await this.get(userId)), ...patch };
    this.users.set(userId, next);
    return next;
  }

  async delete(userId: string): Promise<void> {
    this.users.delete(userId);
  }
}
