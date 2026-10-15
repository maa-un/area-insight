import { describe, expect, it, vi } from "vitest";
import { createApiClient, NotSignedInError } from "./api";

const empty = { favorites: [], compare: [], filters: [] };

describe("createApiClient", () => {
  it("sends the session token to the save API", async () => {
    const fetchFn = vi.fn(async () => Response.json(empty));
    const api = createApiClient(async () => "token-1", fetchFn as typeof fetch);

    await api.saveFavorites(["13101"]);

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/me/favorites");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(JSON.stringify({ favorites: ["13101"] }));
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer token-1");
  });

  it("refuses to call the API when signed out", async () => {
    const fetchFn = vi.fn();
    const api = createApiClient(async () => null, fetchFn as typeof fetch);
    await expect(api.getMe()).rejects.toBeInstanceOf(NotSignedInError);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
