import { describe, expect, it } from "vitest";
import type {
  MunicipalityRecord,
  PointRecord,
  PublicDataSource,
  RawDataStore,
  StatisticRecord,
  StatisticsSource,
  StatisticsTable,
  Tile,
  TileCatalog,
  TransactionRecord,
} from "../ports.js";
import type { Quarter } from "../quarters.js";
import { fetchMunicipalities } from "./municipalities.js";
import { fetchLandPrices, fetchStationTransactions } from "./points.js";
import { fetchStatistics } from "./statistics.js";
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

  async landPrices(tile: Tile, year: number, classification: "0" | "1"): Promise<PointRecord[]> {
    this.calls.push(`land:${tile.z}/${tile.x}/${tile.y}:${year}:${classification}`);
    return tile.x === 1 ? [{ coordinates: [139.7, 35.6], properties: { point_id: "p1" } }] : [];
  }

  async stationTransactions(tile: Tile, from: Quarter, to: Quarter): Promise<PointRecord[]> {
    this.calls.push(
      `station:${tile.z}/${tile.x}/${tile.y}:${from.year}Q${from.quarter}-${to.year}Q${to.quarter}`,
    );
    return [{ coordinates: [139.7, 35.6], properties: { tile: tile.x } }];
  }
}

class FakeTiles implements TileCatalog {
  async tiles(zoom: number): Promise<Tile[]> {
    return [
      { z: zoom, x: 1, y: 1 },
      { z: zoom, x: 2, y: 1 },
    ];
  }
}

class FakeStatistics implements StatisticsSource {
  async values(table: StatisticsTable): Promise<StatisticRecord[]> {
    return [
      {
        areaCode: "20202",
        categories: { cat01: "0" },
        time: "2023000000",
        value: table.id,
        unit: "戸",
      },
    ];
  }
}

class FakeStore implements RawDataStore {
  municipalities: unknown[] = [];
  readonly transactions = new Map<string, unknown[]>();
  readonly landPrices = new Map<number, unknown[]>();
  stations: unknown[] = [];
  statistics: unknown[] = [];

  async replaceLandPrices(year: number, rows: readonly unknown[]): Promise<void> {
    this.landPrices.set(year, [...rows]);
  }

  async replaceStationTransactions(_period: unknown, rows: readonly unknown[]): Promise<void> {
    this.stations = [...rows];
  }

  async replaceStatistics(rows: readonly unknown[]): Promise<void> {
    this.statistics = [...rows];
  }

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

describe("fetchLandPrices", () => {
  it("asks both classifications for every tile and replaces that year", async () => {
    const source = new FakeSource();
    const store = new FakeStore();
    const counts = await fetchLandPrices(source, new FakeTiles(), store, 2026, now);

    expect(source.calls).toEqual([
      "land:13/1/1:2026:0",
      "land:13/1/1:2026:1",
      "land:13/2/1:2026:0",
      "land:13/2/1:2026:1",
    ]);
    expect(counts).toEqual({ landPrice: 1, prefectureSurvey: 1 });
    expect(store.landPrices.get(2026)).toHaveLength(2);
  });
});

describe("fetchStationTransactions", () => {
  it("collects every tile for the period", async () => {
    const source = new FakeSource();
    const store = new FakeStore();
    const period = { from: { year: 2025, quarter: 3 }, to: { year: 2026, quarter: 2 } } as const;

    expect(await fetchStationTransactions(source, new FakeTiles(), store, period, now)).toBe(2);
    expect(source.calls[0]).toBe("station:11/1/1:2025Q3-2026Q2");
    expect(store.stations).toHaveLength(2);
  });
});

describe("fetchStatistics", () => {
  it("fetches every table and replaces them together", async () => {
    const store = new FakeStore();
    const tables = [
      { id: "0001", name: "a", filters: {} },
      { id: "0002", name: "b", filters: { cdCat01: "1" } },
    ];
    expect(await fetchStatistics(new FakeStatistics(), store, now, tables)).toEqual({ a: 1, b: 1 });
    expect(store.statistics).toHaveLength(2);
  });
});
