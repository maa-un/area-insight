import { describe, expect, it } from "vitest";
import { hasSessionHint } from "./auth";

describe("hasSessionHint", () => {
  it("detects a signed-in browser", () => {
    expect(hasSessionHint("theme=dark; __client_uat=1792070000")).toBe(true);
  });

  it("treats a missing or zero cookie as signed out", () => {
    expect(hasSessionHint("theme=dark")).toBe(false);
    expect(hasSessionHint("__client_uat=0")).toBe(false);
  });
});
