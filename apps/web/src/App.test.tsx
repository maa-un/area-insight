import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SignInGateView } from "./components/sign-in-gate";
import { dataset } from "./data";
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
    expect(html).toContain("市区町村を公的データで");
    // 実データを置いた手元のビルドではサンプルの注意書きは出ない
    if (dataset.sample) expect(html).toContain("サンプル");
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
    expect(render(find("condos").route)).toContain("マンションの成約事例");
    expect(render(find("privacy").route)).toContain("プライバシーポリシー");
    expect(find("guide").path).toBe("/guide/");
    expect(render(find("guide").route)).toContain("マチノメでできること");
  });

  it("renders the deployed version without listing it for search", () => {
    const version = find("version");
    expect(version.path).toBe("/version/");
    expect(version.head.noindex).toBe(true);
    expect(render(version.route)).toContain(`v${__APP_VERSION__}`);
  });

  // 同じ都道府県に同名の市区町村がある場合（北海道の泊村）だけは、title が重なってよい。
  it("gives every page a distinct title", () => {
    const titles = all.map((p) => p.head.title);
    const duplicates = titles.filter((t, i) => titles.indexOf(t) !== i);
    expect(duplicates.every((t) => t.startsWith("北海道泊村"))).toBe(true);
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
    expect(pageOfPath("/condos/")).toEqual({ page: "condos" });
    expect(pageOfPath("/version")).toEqual({ page: "version" });
    expect(pageOfPath("/areas/13101/")).toEqual({ page: "area", code: "13101" });
    expect(pageOfPath("/nope/")).toEqual({ page: "not-found" });
  });
});

describe("sign-in gate", () => {
  const gated = (status: Parameters<typeof SignInGateView>[0]["status"]) =>
    renderToString(<SignInGateView status={status}>中身</SignInGateView>);

  it("shows the page only to signed-in users", () => {
    expect(gated("signed-in")).toContain("中身");
    expect(gated("disabled")).toContain("中身");
    expect(gated("loading")).not.toContain("中身");
    const signedOut = gated("signed-out");
    expect(signedOut).not.toContain("中身");
    expect(signedOut).toContain("ログインしてご利用ください");
    expect(signedOut).toContain('href="/guide/"');
  });

  it("keeps pages behind the sign-in out of search, but not the legal pages", () => {
    for (const { route, head } of pages()) {
      const open = ["guide", "privacy", "terms", "not-found", "unauthorized"].includes(route.page);
      expect(head.noindex === true, route.page).toBe(!open);
    }
  });
});
