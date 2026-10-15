import { z } from "zod";
import { MunicipalityCode } from "./municipality.js";

// ログインユーザーが保存する内容。保存 API が Firestore に 1 ユーザー 1 ドキュメントで持つ。
export const MAX_FAVORITES = 200;
export const MAX_COMPARE = 3;
export const MAX_FILTERS = 20;

export const Favorites = z.array(MunicipalityCode).max(MAX_FAVORITES);
export const CompareList = z.array(MunicipalityCode).max(MAX_COMPARE);

export const SavedFilter = z.object({
  name: z.string().min(1).max(50),
  // 絞り込みの中身は画面側の仕様に合わせて増えるため、値は文字列・数値・真偽値に限って自由にする。
  conditions: z.record(z.string().max(50), z.union([z.string().max(200), z.number(), z.boolean()])),
});
export const SavedFilters = z.array(SavedFilter).max(MAX_FILTERS);

export const UserData = z.object({
  favorites: Favorites,
  compare: CompareList,
  filters: SavedFilters,
});
export type UserData = z.infer<typeof UserData>;

export const EMPTY_USER_DATA: UserData = { favorites: [], compare: [], filters: [] };
