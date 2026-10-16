import { describe, expect, it } from "vitest";
import { RAW_STATIONS, RAW_TRANSACTIONS, stationRow, transactionRow } from "./raw-rows.js";

describe("transactionRow", () => {
  it("maps API fields to snake_case columns and keeps values as strings", () => {
    const row = transactionRow(
      { Type: "宅地(土地と建物)", MunicipalityCode: "13101", TradePrice: "12000000", Remarks: "" },
      { year: 2025, quarter: 2 },
      "13",
      new Date("2026-10-15T00:00:00Z"),
    );

    expect(row).toMatchObject({
      period_start: "2025-04-01",
      prefecture_code: "13",
      fetched_at: "2026-10-15T00:00:00.000Z",
      type: "宅地(土地と建物)",
      municipality_code: "13101",
      trade_price: "12000000",
      remarks: null,
      area: null,
    });
  });

  it("produces exactly the columns declared in the table schema", () => {
    const row = transactionRow({}, { year: 2025, quarter: 1 }, "01", new Date());
    expect(Object.keys(row).sort()).toEqual(
      RAW_TRANSACTIONS.schema.map((field) => field.name).sort(),
    );
  });
});

describe("stationRow", () => {
  it("keeps the geometry and properties as JSON in the declared columns", () => {
    const row = stationRow(
      { geometry: { type: "LineString", coordinates: [] }, properties: { S12_001_ja: "新宿" } },
      new Date("2026-10-15T00:00:00Z"),
    );
    expect(row).toEqual({
      geometry: '{"type":"LineString","coordinates":[]}',
      properties: '{"S12_001_ja":"新宿"}',
      fetched_at: "2026-10-15T00:00:00.000Z",
    });
    expect(Object.keys(row).sort()).toEqual(RAW_STATIONS.schema.map((field) => field.name).sort());
  });
});
