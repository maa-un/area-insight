import type { AreaDetail } from "@area-insight/shared";
import { prefectureName } from "@area-insight/shared";
import { dataset, findArea } from "@/data";

// ページの種類。ルーティングのライブラリは使わず、ビルド時に 1 ページ 1 HTML を書き出す。
// 市区町村ページは詳細データを HTML に埋め込み、ハイドレーション時にそれを使う。
export type Route =
  | { page: "home" }
  | { page: "map" }
  | { page: "condos" }
  | { page: "rankings" }
  | { page: "compare" }
  | { page: "area"; detail: AreaDetail }
  | { page: "privacy" }
  | { page: "terms" }
  | { page: "version" }
  | { page: "not-found" }
  | { page: "unauthorized" };

export type PageName = Route["page"];

export const areaPath = (code: string) => `/areas/${code}/`;

export const comparePath = (codes: readonly string[]) =>
  codes.length ? `/compare/?codes=${codes.join(",")}` : "/compare/";

// 静的生成で書き出すファイル名。ディレクトリの index.html にし、URL は末尾スラッシュで揃える。
export function outputFile(route: Route): string {
  switch (route.page) {
    case "home":
      return "index.html";
    case "area":
      return `areas/${route.detail.code}/index.html`;
    case "not-found":
      return "404.html";
    case "unauthorized":
      return "401.html";
    default:
      return `${route.page}/index.html`;
  }
}

export function pathOf(route: Route): string | undefined {
  const file = outputFile(route);
  if (!file.endsWith("index.html")) return undefined; // エラーページは URL を持たない
  return `/${file.slice(0, -"index.html".length)}`;
}

const SITE = "area-insight";

// ページごとの title と description（SEO）。noindex のページは検索に載せず、sitemap にも入れない。
export function headOf(route: Route): { title: string; description: string; noindex?: true } {
  switch (route.page) {
    case "home":
      return {
        title: `${SITE} | 市区町村を公的データで比べる`,
        description: "取引価格・地価・空き家率・人口を、全国の市区町村で比べられます。",
      };
    case "map":
      return {
        title: `地図で探す | ${SITE}`,
        description: "市区町村の取引価格・地価公示の地点・駅ごとの取引相場を地図で見比べられます。",
      };
    case "condos":
      return {
        title: `マンションの成約事例を地図で見る | ${SITE}`,
        description:
          "中古マンションの成約価格・取引価格を最寄り駅ごとに地図で見られます。間取り・専有面積・築年数で絞り込み、坪単価の相場を確かめられます。",
      };
    case "rankings":
      return {
        title: `ランキング | ${SITE}`,
        description: "取引価格・想定利回り・空き家率・人口増減率で市区町村を並べ替えられます。",
      };
    case "compare":
      return {
        title: `比較 | ${SITE}`,
        description: "気になる市区町村を 3 つまで横に並べて比べられます。",
      };
    case "area": {
      const area = findArea(route.detail.code);
      const name = area ? `${prefectureName(area.prefectureCode)}${area.name}` : route.detail.code;
      return {
        title: `${name}の中古戸建・空き家の相場 | ${SITE}`,
        description: `${name}の中古戸建の取引価格、推移、空き家率、人口の推移を公的データで確認できます。`,
      };
    }
    case "privacy":
      return {
        title: `プライバシーポリシー | ${SITE}`,
        description: `${SITE} のプライバシーポリシー`,
      };
    case "terms":
      return { title: `利用規約 | ${SITE}`, description: `${SITE} の利用規約` };
    case "version":
      return { title: `バージョン | ${SITE}`, description: "", noindex: true };
    case "not-found":
      return { title: `ページが見つかりません | ${SITE}`, description: "" };
    case "unauthorized":
      return { title: `認証が必要です | ${SITE}`, description: "" };
  }
}

// 書き出すページの一覧。市区町村ページは指標のある市区町村すべて。
export function allRoutes(detailOf: (code: string) => AreaDetail | undefined): Route[] {
  const areas = dataset.areas.flatMap((area) => {
    const detail = detailOf(area.code);
    return detail ? [{ page: "area" as const, detail }] : [];
  });
  return [
    { page: "home" },
    { page: "map" },
    { page: "condos" },
    { page: "rankings" },
    { page: "compare" },
    ...areas,
    { page: "privacy" },
    { page: "terms" },
    { page: "version" },
    { page: "not-found" },
    { page: "unauthorized" },
  ];
}

// 開発サーバー（静的生成していない状態）で URL からページを決める。
export function pageOfPath(pathname: string): { page: PageName; code?: string } {
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const area = /^\/areas\/(\d{5})\/$/.exec(path);
  if (area) return { page: "area", code: area[1] };
  const name = path.slice(1, -1);
  if (name === "") return { page: "home" };
  if (["map", "condos", "rankings", "compare", "privacy", "terms", "version"].includes(name)) {
    return { page: name as PageName };
  }
  return { page: "not-found" };
}
