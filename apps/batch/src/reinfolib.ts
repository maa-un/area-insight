import { z } from "zod";

// 国土交通省 不動産情報ライブラリ API のクライアント。
// https://www.reinfolib.mlit.go.jp/help/apiManual/
const BASE_URL = "https://www.reinfolib.mlit.go.jp/ex-api/external";

const MunicipalityRow = z.looseObject({ id: z.string(), name: z.string() });

// 取引価格（XIT001）の 1 件。値はすべて文字列で返るため、加工せずそのまま保存する。
const TransactionRow = z.looseObject({
  Type: z.string().optional(),
  Region: z.string().optional(),
  MunicipalityCode: z.string().optional(),
  Prefecture: z.string().optional(),
  Municipality: z.string().optional(),
  DistrictName: z.string().optional(),
  TradePrice: z.string().optional(),
  PricePerUnit: z.string().optional(),
  FloorPlan: z.string().optional(),
  Area: z.string().optional(),
  UnitPrice: z.string().optional(),
  LandShape: z.string().optional(),
  Frontage: z.string().optional(),
  TotalFloorArea: z.string().optional(),
  BuildingYear: z.string().optional(),
  Structure: z.string().optional(),
  Use: z.string().optional(),
  Purpose: z.string().optional(),
  Direction: z.string().optional(),
  Classification: z.string().optional(),
  Breadth: z.string().optional(),
  CityPlanning: z.string().optional(),
  CoverageRatio: z.string().optional(),
  FloorAreaRatio: z.string().optional(),
  Period: z.string().optional(),
  Renovation: z.string().optional(),
  Remarks: z.string().optional(),
  PriceCategory: z.string().optional(),
  DistrictCode: z.string().optional(),
});
export type TransactionRow = z.infer<typeof TransactionRow>;

const Envelope = <T extends z.ZodType>(row: T) => z.looseObject({ data: z.array(row) });

export type ReinfolibClientOptions = {
  apiKey: string;
  requestIntervalMs: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
};

export class ReinfolibClient {
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxAttempts: number;
  private lastRequestAt = 0;

  constructor(private readonly options: ReinfolibClientOptions) {
    this.fetchFn = options.fetch ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.maxAttempts = options.maxAttempts ?? 4;
  }

  // XIT002: 都道府県内の市区町村一覧。
  async municipalities(prefectureCode: string): Promise<{ id: string; name: string }[]> {
    const body = await this.get("XIT002", { area: prefectureCode });
    return body === null ? [] : Envelope(MunicipalityRow).parse(body).data;
  }

  // XIT001: 都道府県・四半期を指定した取引価格（成約価格は含めない）。
  async transactions(
    prefectureCode: string,
    year: number,
    quarter: number,
  ): Promise<TransactionRow[]> {
    const body = await this.get("XIT001", {
      year: String(year),
      quarter: String(quarter),
      area: prefectureCode,
      priceClassification: "01",
    });
    return body === null ? [] : Envelope(TransactionRow).parse(body).data;
  }

  // データが無い期間・地域は 404 が返るため null にする。5xx と通信エラーは待って再試行する。
  private async get(api: string, params: Record<string, string>): Promise<unknown | null> {
    const url = `${BASE_URL}/${api}?${new URLSearchParams(params)}`;
    for (let attempt = 1; ; attempt++) {
      await this.throttle();
      let response: Response;
      try {
        response = await this.fetchFn(url, {
          headers: { "Ocp-Apim-Subscription-Key": this.options.apiKey },
        });
      } catch (error) {
        if (attempt >= this.maxAttempts) throw error;
        await this.sleep(backoffMs(attempt));
        continue;
      }
      if (response.status === 404) return null;
      if (response.ok) return response.json();
      if (response.status >= 500 && attempt < this.maxAttempts) {
        await this.sleep(backoffMs(attempt));
        continue;
      }
      throw new Error(`${api} returned HTTP ${response.status}`);
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
