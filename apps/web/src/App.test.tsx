import { describe, expect, it } from "vitest";
import { render } from "./entry-server";

describe("prerender", () => {
  it("renders the home page", () => {
    const html = render("home");
    expect(html).toContain("公的データで比べる");
    expect(html).toContain("不動産情報ライブラリ");
  });

  it("renders the not-found page", () => {
    expect(render("not-found")).toContain("ページが見つかりません");
  });
});
