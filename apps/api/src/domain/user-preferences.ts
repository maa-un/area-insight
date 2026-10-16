import { MAX_COMPARE, MAX_FAVORITES, MAX_FILTERS } from "@area-insight/shared";
import { DomainError } from "./errors.js";
import { type AreaCode, areaCodeOf, type SavedFilter, type UserId } from "./values.js";

// 利用者ごとの保存内容（集約）。お気に入り・比較リスト・絞り込み条件をまとめて 1 単位で読み書きする。
// 上限の数は画面と同じ値を使うため、画面との取り決め（@area-insight/shared）から読む。

export type UserPreferencesSnapshot = {
  readonly favorites: readonly string[];
  readonly compare: readonly string[];
  readonly filters: readonly SavedFilter[];
};

export class UserPreferences {
  private constructor(
    readonly userId: UserId,
    readonly favorites: readonly AreaCode[],
    readonly compare: readonly AreaCode[],
    readonly filters: readonly SavedFilter[],
  ) {}

  static empty(userId: UserId): UserPreferences {
    return new UserPreferences(userId, [], [], []);
  }

  // 保存先から読んだ内容を復元する。決まりができる前に保存された名前の重複は、
  // 読めなくならないよう先に保存したものを残して取り除く。
  static restore(userId: UserId, snapshot: UserPreferencesSnapshot): UserPreferences {
    const seen = new Set<string>();
    const filters = snapshot.filters.filter((filter) => {
      if (seen.has(filter.name)) return false;
      seen.add(filter.name);
      return true;
    });
    return UserPreferences.empty(userId)
      .replaceFavorites(snapshot.favorites)
      .replaceCompare(snapshot.compare)
      .replaceFilters(filters);
  }

  // お気に入りは重複を除き、追加した順に保つ。
  replaceFavorites(codes: readonly string[]): UserPreferences {
    const favorites = uniqueAreaCodes(codes);
    if (favorites.length > MAX_FAVORITES) {
      throw new DomainError(`favorites are limited to ${MAX_FAVORITES}`);
    }
    return new UserPreferences(this.userId, favorites, this.compare, this.filters);
  }

  // 比較は横に並べて見るためのもので、同じ市区町村を 2 回並べる意味はない。
  replaceCompare(codes: readonly string[]): UserPreferences {
    const compare = uniqueAreaCodes(codes);
    if (compare.length > MAX_COMPARE) {
      throw new DomainError(`compare is limited to ${MAX_COMPARE}`);
    }
    return new UserPreferences(this.userId, this.favorites, compare, this.filters);
  }

  // 絞り込み条件は名前で選ぶため、名前が重複しないようにする。
  replaceFilters(filters: readonly SavedFilter[]): UserPreferences {
    if (filters.length > MAX_FILTERS) {
      throw new DomainError(`filters are limited to ${MAX_FILTERS}`);
    }
    const names = new Set(filters.map((filter) => filter.name));
    if (names.size !== filters.length) throw new DomainError("filter names must be unique");
    return new UserPreferences(this.userId, this.favorites, this.compare, [...filters]);
  }

  toSnapshot(): UserPreferencesSnapshot {
    return { favorites: this.favorites, compare: this.compare, filters: this.filters };
  }
}

function uniqueAreaCodes(codes: readonly string[]): AreaCode[] {
  return [...new Set(codes)].map(areaCodeOf);
}
