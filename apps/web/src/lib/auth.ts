import type { Clerk } from "@clerk/clerk-js";
import { useSyncExternalStore } from "react";

// Clerk（Google SSO）のログイン状態。閲覧だけの人の表示を遅くしないよう、Clerk 本体は
// 「ログインボタンが押されたとき」か「ログイン済みの目印の Cookie があるとき」だけ読み込む。

export type AuthState =
  | { status: "disabled" } // 公開キーが未設定。ログイン機能を出さない
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in" };

const publishableKey: string | undefined = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || undefined;

const initialState: AuthState = publishableKey ? { status: "loading" } : { status: "disabled" };
let state: AuthState = initialState;
const listeners = new Set<() => void>();
let clerkPromise: Promise<Clerk> | undefined;

function setState(next: AuthState): void {
  if (next.status === state.status) return;
  state = next;
  for (const listener of listeners) listener();
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAuth(): AuthState {
  // 静的生成した HTML とハイドレーション直後は同じ値を返し、表示のずれを起こさない。
  return useSyncExternalStore(
    subscribeAuth,
    () => state,
    () => initialState,
  );
}

export function getAuthState(): AuthState {
  return state;
}

// Clerk はログイン済みのブラウザに __client_uat（最終ログイン時刻、未ログインなら 0）を置く。
export function hasSessionHint(cookie: string): boolean {
  const value = /(?:^|;\s*)__client_uat=(\d+)/.exec(cookie)?.[1];
  return value !== undefined && value !== "0";
}

function loadClerk(key: string): Promise<Clerk> {
  clerkPromise ??= (async () => {
    const [{ Clerk }, { jaJP }] = await Promise.all([
      import("@clerk/clerk-js"),
      import("@clerk/localizations/ja-JP"),
    ]);
    const clerk = new Clerk(key);
    await clerk.load({ localization: jaJP });
    clerk.addListener(({ user }) => setState({ status: user ? "signed-in" : "signed-out" }));
    setState({ status: clerk.user ? "signed-in" : "signed-out" });
    return clerk;
  })();
  return clerkPromise;
}

// ハイドレーション後に 1 回呼ぶ。ログイン済みの目印があるときだけ Clerk を読み込む。
export function initAuth(): void {
  if (!publishableKey) return;
  if (hasSessionHint(document.cookie)) {
    void loadClerk(publishableKey).catch(() => setState({ status: "signed-out" }));
  } else {
    setState({ status: "signed-out" });
  }
}

export async function openSignIn(): Promise<void> {
  if (!publishableKey) return;
  const clerk = await loadClerk(publishableKey);
  clerk.openSignIn();
}

export async function mountUserButton(node: HTMLDivElement): Promise<() => void> {
  if (!publishableKey) return () => {};
  const clerk = await loadClerk(publishableKey);
  clerk.mountUserButton(node);
  return () => clerk.unmountUserButton(node);
}

// 保存 API に付けるセッショントークン。未ログインなら null。
export async function getToken(): Promise<string | null> {
  if (!publishableKey || state.status !== "signed-in") return null;
  const clerk = await loadClerk(publishableKey);
  return (await clerk.session?.getToken()) ?? null;
}
