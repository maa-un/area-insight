import type { UserData } from "@area-insight/shared";

// 保存 API（同じドメインの /api/）の呼び出し。ログイン中のトークンを付ける。
export class NotSignedInError extends Error {}

type GetToken = () => Promise<string | null>;

export function createApiClient(getToken: GetToken, fetchFn: typeof fetch = fetch) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getToken();
    if (!token) throw new NotSignedInError("sign in to save");
    const response = await fetchFn(`/api${path}`, {
      ...init,
      headers: {
        ...init.headers,
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
    });
    if (!response.ok) throw new Error(`save API returned HTTP ${response.status}`);
    return (await response.json()) as T;
  }

  const put = <K extends keyof UserData>(key: K, value: UserData[K]) =>
    request<UserData>(`/me/${key}`, { method: "PUT", body: JSON.stringify({ [key]: value }) });

  return {
    getMe: () => request<UserData>("/me"),
    saveFavorites: (favorites: UserData["favorites"]) => put("favorites", favorites),
    saveCompare: (compare: UserData["compare"]) => put("compare", compare),
    saveFilters: (filters: UserData["filters"]) => put("filters", filters),
  };
}
