import { describe, expect, it } from "vitest";
import type {
  MunicipalityRecord,
  PublicDataSource,
  RawDataStore,
  TransactionRecord,
} from "../ports.js";
import type { Quarter } from "../quarters.js";
import { fetchMunicipalities } from "./municipalities.js";
import { fetchTransactions } from "./transactions.js";

// ポートの偽物。ジョブは取得元と保存先の実装を知らないため、ネットワークや BigQuery なしで確かめられる。
class FakeSource implements PublicDataSource {
  readonly calls: string[] = [];

  async municipalities(prefectureCode: string): Promise<MunicipalityRecord[]> {
    return prefectureCode === "13" ? [{ code: "13101", name: "千代田区" }] : [];
  }

  async transactions(prefectureCode: string, quarter: Quarter): Promise<TransactionRecord[]> {
    this.calls.push(`${prefectureCode}:${quarter.year}Q${quarter.quarter}`);
    return prefectureCode === "13" ? [{ TradePrice: "12000000" }] : [];
  }
}

class FakeStore implements RawDataStore {
  municipalities: unknown[] = [];
  readonly transactions = new Map<string, unknown[]>();

  async replaceMunicipalities(rows: readonly unknown[]): Promise<void> {
    this.municipalities = [...rows];
  }

  async replaceTransactions(quarter: Quarter, rows: readonly unknown[]): Promise<void> {
    this.transactions.set(`${quarter.year}Q${quarter.quarter}`, [...rows]);
  }
}

const now = new Date("2026-10-15T00:00:00Z");

describe("fetchMunicipalities", () => {
  it("collects every prefecture and replaces the whole list once", async () => {
    const store = new FakeStore();
    expect(await fetchMunicipalities(new FakeSource(), store, now)).toBe(1);
    expect(store.municipalities).toEqual([
      { prefectureCode: "13", record: { code: "13101", name: "千代田区" } },
    ]);
  });
});

describe("fetchTransactions", () => {
  it("asks all 47 prefectures per quarter and replaces each quarter", async () => {
    const source = new FakeSource();
    const store = new FakeStore();
    const quarters: Quarter[] = [
      { year: 2026, quarter: 2 },
      { year: 2026, quarter: 1 },
    ];

    const counts = await fetchTransactions(source, store, quarters, now);

    expect(source.calls).toHaveLength(47 * 2);
    expect(Object.fromEntries(counts)).toEqual({ "2026Q2": 1, "2026Q1": 1 });
    expect(store.transactions.get("2026Q2")).toEqual([
      { prefectureCode: "13", record: { TradePrice: "12000000" } },
    ]);
  });
});
