import { DomainError } from "./errors.js";

// 値オブジェクト。文字列のままだと取り違えるため、検査を通った値にだけ型の印を付ける。
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

// 利用者 ID。認証サービス（今は Clerk）が発行した ID をそのまま使う。
export type UserId = Brand<string, "UserId">;

export function userIdOf(value: string): UserId {
  if (value.length === 0 || value.length > 255) throw new DomainError("invalid user id");
  return value as UserId;
}

// 市区町村コード（全国地方公共団体コードから検査数字を除いた 5 桁）。
export type AreaCode = Brand<string, "AreaCode">;

export function areaCodeOf(value: string): AreaCode {
  if (!/^\d{5}$/.test(value)) throw new DomainError(`invalid area code: ${value}`);
  return value as AreaCode;
}

// 保存した絞り込み条件。中身は画面の仕様に合わせて増えるため、値の種類だけを決めておく。
export type SavedFilter = {
  readonly name: string;
  readonly conditions: Readonly<Record<string, string | number | boolean>>;
};
