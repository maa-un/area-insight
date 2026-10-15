import { describe, expect, it } from "vitest";
import { pages, render } from "./entry-server";
import { pageOfPath } from "./routes";

describe("prerender", () => {
  const all = pages();
  const find = (page: string) => {
    const entry = all.find((p) => p.route.page === page);
    if (!entry) throw new Error(`no ${page} page`);
    return entry;
  };

  it("renders the home page with the sample notice and sources", () => {
    const html = render(find("home").route);
    expect(html).toContain("公的データで比べる");
    expect(html).toContain("サンプル");
    expect(html).toContain("不動産情報ライブラリ");
  });

  it("writes one page per municipality under a trailing-slash URL", () => {
    const area = all.find((p) => p.path === "/areas/20202/");
    expect(area?.file).toBe("areas/20202/index.html");
    expect(area?.head.title).toContain("長野県松本市");
    expect(render(area?.route ?? find("home").route)).toContain("取引価格の推移");
  });

  it("renders the rankings, compare, map and legal pages", () => {
    expect(render(find("rankings").route)).toContain("ランキング");
    expect(render(find("compare").route)).toContain("比較する市区町村がありません");
    expect(render(find("map").route)).toContain("地図を読み込んでいます");
    expect(render(find("privacy").route)).toContain("プライバシーポリシー");
  });

  it("gives every page a distinct title", () => {
    const titles = all.map((p) => p.head.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("renders the error pages without URLs", () => {
    expect(find("not-found").path).toBeUndefined();
    expect(render(find("unauthorized").route)).toContain("認証が必要です");
  });
});

describe("pageOfPath", () => {
  it("maps paths to pages", () => {
    expect(pageOfPath("/")).toEqual({ page: "home" });
    expect(pageOfPath("/map")).toEqual({ page: "map" });
    expect(pageOfPath("/areas/13101/")).toEqual({ page: "area", code: "13101" });
    expect(pageOfPath("/nope/")).toEqual({ page: "not-found" });
  });
});
