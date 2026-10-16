import type { UserId } from "../domain/values.js";

// アプリケーション層が外の仕組みに求めること（ポート）。実装は adapters 層に置く。

// ログイン中の利用者のトークンを検証し、利用者 ID を返す。失敗したら例外を投げる。
export interface TokenVerifier {
  verify(token: string): Promise<UserId>;
}

// 認証サービスから届く出来事。認証サービス固有の形（Clerk の user.deleted など）は adapters 層で変換する。
export type AccountEvent = { type: "account-deleted"; userId: UserId } | { type: "ignored" };
