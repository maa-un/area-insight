import { useSyncExternalStore } from "react";

// URL のクエリ（?codes=... など）。静的生成した HTML とハイドレーション直後は空として扱い、
// その後でブラウザの値に切り替えて表示のずれを防ぐ。
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

export function useSearchParams(): URLSearchParams {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  return new URLSearchParams(search);
}

// 履歴を増やさずにクエリを書き換える（絞り込みの状態を URL で共有できるようにする）。
export function replaceSearchParams(params: Record<string, string | undefined>): void {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  window.history.replaceState(null, "", url);
  for (const listener of listeners) listener();
}
