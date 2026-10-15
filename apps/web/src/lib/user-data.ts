import { EMPTY_USER_DATA, MAX_COMPARE, type UserData } from "@area-insight/shared";
import { useSyncExternalStore } from "react";
import { createApiClient } from "./api";
import { getAuthState, getToken, openSignIn, subscribeAuth } from "./auth";

// お気に入り・比較リスト・保存した絞り込み条件。
// 比較リストはログインなしでも使えるようブラウザに置き、ログイン中は保存 API にも書く。
// お気に入りと絞り込み条件はログインが必要（押したときに未ログインならログインを促す）。

export type UserDataState = UserData & {
  // 保存 API から読み終えたか
  synced: boolean;
  // 直近の保存の失敗。画面に出す短い文言
  error?: string;
};

const COMPARE_KEY = "area-insight:compare";
const initialState: UserDataState = { ...EMPTY_USER_DATA, synced: false };
let state: UserDataState = initialState;
const listeners = new Set<() => void>();
const api = createApiClient(getToken);

function setState(next: Partial<UserDataState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUserData(): UserDataState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => initialState,
  );
}

function readLocalCompare(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(COMPARE_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((v) => typeof v === "string").slice(0, MAX_COMPARE)
      : [];
  } catch {
    return [];
  }
}

function writeLocalCompare(codes: string[]): void {
  try {
    localStorage.setItem(COMPARE_KEY, JSON.stringify(codes));
  } catch {
    // プライベートモードなどで保存できなくても、このページの中では使える
  }
}

async function save(task: () => Promise<unknown>): Promise<void> {
  try {
    await task();
    if (state.error) setState({ error: undefined });
  } catch {
    setState({ error: "保存できませんでした。時間をおいてもう一度お試しください。" });
  }
}

async function syncWithServer(): Promise<void> {
  try {
    const server = await api.getMe();
    // サーバーに比較リストが無ければ、ログイン前にブラウザで選んでいたものを引き継ぐ。
    const compare = server.compare.length > 0 ? server.compare : state.compare;
    setState({ favorites: server.favorites, filters: server.filters, compare, synced: true });
    writeLocalCompare(compare);
    if (server.compare.length === 0 && compare.length > 0)
      await save(() => api.saveCompare(compare));
  } catch {
    setState({ error: "保存した内容を読み込めませんでした。" });
  }
}

// ハイドレーション後に 1 回呼ぶ。
export function initUserData(): void {
  setState({ compare: readLocalCompare() });
  let signedIn = false;
  const onAuth = () => {
    const now = getAuthState().status === "signed-in";
    if (now && !signedIn) void syncWithServer();
    if (!now && signedIn) setState({ favorites: [], filters: [], synced: false });
    signedIn = now;
  };
  subscribeAuth(onAuth);
  onAuth();
}

const isSignedIn = () => getAuthState().status === "signed-in";

// 比較リストへの追加・削除。満杯なら false を返す。
export function toggleCompare(code: string): boolean {
  const has = state.compare.includes(code);
  if (!has && state.compare.length >= MAX_COMPARE) return false;
  const compare = has ? state.compare.filter((c) => c !== code) : [...state.compare, code];
  setCompare(compare);
  return true;
}

export function setCompare(compare: string[]): void {
  setState({ compare });
  writeLocalCompare(compare);
  if (isSignedIn()) void save(() => api.saveCompare(compare));
}

export function toggleFavorite(code: string): void {
  if (!isSignedIn()) {
    void openSignIn();
    return;
  }
  const favorites = state.favorites.includes(code)
    ? state.favorites.filter((c) => c !== code)
    : [...state.favorites, code];
  setState({ favorites });
  void save(() => api.saveFavorites(favorites));
}

export function saveFilters(filters: UserData["filters"]): void {
  if (!isSignedIn()) {
    void openSignIn();
    return;
  }
  setState({ filters });
  void save(() => api.saveFilters(filters));
}
