import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeNdjson } from "./bigquery-writer.js";

describe("writeNdjson", () => {
  it("writes one JSON object per line", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ndjson-test-"));
    try {
      const file = join(dir, "rows.ndjson");
      await writeNdjson(file, [{ a: "宅地(土地と建物)" }, { a: null, b: 1 }]);
      expect(await readFile(file, "utf8")).toBe('{"a":"宅地(土地と建物)"}\n{"a":null,"b":1}\n');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("handles many rows without building one big string", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ndjson-test-"));
    try {
      const file = join(dir, "rows.ndjson");
      const rows = Array.from({ length: 50_000 }, (_, i) => ({ i, text: "取引".repeat(50) }));
      await writeNdjson(file, rows);
      const lines = (await readFile(file, "utf8")).trimEnd().split("\n");
      expect(lines).toHaveLength(50_000);
      expect(JSON.parse(lines.at(-1) ?? "{}").i).toBe(49_999);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
