import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LandPriceFileWriter, loadLandPriceFiles } from "./land-price-files.js";
import { RAW_LAND_PRICES, RAW_STATIONS } from "./raw-rows.js";

const mocks = vi.hoisted(() => ({
  createJob: vi.fn(),
  ensureTable: vi.fn(),
  promise: vi.fn(),
}));
vi.mock("@google-cloud/bigquery", () => ({
  BigQuery: class {
    createJob = mocks.createJob;
  },
}));
vi.mock("./bigquery-writer.js", async (original) => ({
  ...(await original<typeof import("./bigquery-writer.js")>()),
  BigQueryWriter: class {
    ensureTable = mocks.ensureTable;
  },
}));
afterEach(() => vi.resetAllMocks());

describe("land price staging", () => {
  it("writes raw rows without changing their values", async () => {
    const dir = await mkdtemp(join(tmpdir(), "land-price-test-"));
    try {
      const file = join(dir, "rows.ndjson");
      const row = { properties: { price: "1,000", empty: "" }, longitude: 139.5 };
      await new LandPriceFileWriter(file).replace(RAW_LAND_PRICES, [row]);
      expect(JSON.parse(await readFile(file, "utf8"))).toEqual(row);
      await expect(new LandPriceFileWriter(file).replace(RAW_STATIONS, [])).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("fails when a source fails midway", async () => {
    const dir = await mkdtemp(join(tmpdir(), "land-price-test-"));
    try {
      async function* rows() {
        yield { properties: {} };
        throw new Error("upstream failed");
      }
      await expect(
        new LandPriceFileWriter(join(dir, "rows.ndjson")).replace(RAW_LAND_PRICES, rows()),
      ).rejects.toThrow("upstream failed");
      expect(mocks.createJob).not.toHaveBeenCalled();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("loads every explicit part in one job and replaces only the requested year", async () => {
    mocks.createJob.mockResolvedValue([{ promise: mocks.promise }]);
    await loadLandPriceFiles("project", "dataset", "gs://data-bucket/batch-staging/123", 2026, 8);
    expect(mocks.createJob).toHaveBeenCalledOnce();
    const load = mocks.createJob.mock.calls[0]?.[0].configuration.load;
    expect(load.sourceUris).toEqual(
      Array.from({ length: 8 }, (_, part) => `gs://data-bucket/batch-staging/123/${part}.ndjson`),
    );
    expect(load.destinationTable.tableId).toBe("raw_land_prices$20260101");
    expect(load.writeDisposition).toBe("WRITE_TRUNCATE");
    expect(mocks.promise).toHaveBeenCalledOnce();
  });

  it("propagates load failures so aggregation cannot continue", async () => {
    mocks.createJob.mockResolvedValue([{ promise: mocks.promise }]);
    mocks.promise.mockRejectedValue(new Error("missing source file"));
    await expect(
      loadLandPriceFiles("project", "dataset", "gs://data-bucket/staging", 2026, 8),
    ).rejects.toThrow("missing source file");
  });

  it.each([
    ["file:///tmp/data", 2026, 8],
    ["gs://bucket/path/*", 2026, 8],
    ["gs://bucket/path", Number.NaN, 8],
    ["gs://bucket/path", 2026, 0],
  ])("rejects invalid load arguments", async (prefix, year, parts) => {
    await expect(loadLandPriceFiles("project", "dataset", prefix, year, parts)).rejects.toThrow();
    expect(mocks.createJob).not.toHaveBeenCalled();
    expect(mocks.ensureTable).not.toHaveBeenCalled();
  });
});
