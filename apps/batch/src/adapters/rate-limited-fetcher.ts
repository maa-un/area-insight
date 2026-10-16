// 公的 API を呼ぶための共通部品。リクエストの間隔を空け、5xx と通信エラーは待って再試行する。
// e-Stat はアプリケーション ID を URL に含める仕様のため、URL をエラーやログに出さない
// （失敗時は API の名前と HTTP ステータス、エラーの種類だけを返す）。

export type FetcherOptions = {
  requestIntervalMs: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
};

export class RateLimitedFetcher {
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxAttempts: number;
  private lastRequestAt = 0;

  constructor(private readonly options: FetcherOptions) {
    this.fetchFn = options.fetch ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.maxAttempts = options.maxAttempts ?? 4;
  }

  // JSON を返す。404（データが無い）は null。label はエラーに出す API の名前。
  async getJson(
    label: string,
    url: string,
    headers: Record<string, string> = {},
  ): Promise<unknown> {
    for (let attempt = 1; ; attempt++) {
      await this.throttle();
      let response: Response;
      try {
        response = await this.fetchFn(url, { headers });
      } catch (error) {
        if (attempt >= this.maxAttempts) {
          throw new Error(
            `${label} request failed: ${error instanceof Error ? error.name : "error"}`,
          );
        }
        await this.sleep(backoffMs(attempt));
        continue;
      }
      if (response.status === 404) return null;
      if (response.ok) return response.json();
      if (response.status >= 500 && attempt < this.maxAttempts) {
        await this.sleep(backoffMs(attempt));
        continue;
      }
      throw new Error(`${label} returned HTTP ${response.status}`);
    }
  }

  private async throttle(): Promise<void> {
    const wait = this.lastRequestAt + this.options.requestIntervalMs - Date.now();
    if (wait > 0) await this.sleep(wait);
    this.lastRequestAt = Date.now();
  }
}

function backoffMs(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** (attempt - 1));
}
