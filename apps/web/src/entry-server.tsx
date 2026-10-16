import { AreaDetail } from "@area-insight/shared";
import { renderToString } from "react-dom/server";
import { App } from "./App";
import { sampleDetail } from "./data/sample";
import { allRoutes, headOf, outputFile, pathOf, type Route } from "./routes";

// ビルド時の静的生成（scripts/prerender.mjs）から呼ぶ。
export function render(route: Route): string {
  return renderToString(<App route={route} />);
}

// 市区町村の詳細。集計ジョブの書き出し（generated/details/）があればそれを、無ければサンプルを使う。
// 静的生成のときだけ読むので、画面の JavaScript には含まれない。
const details = import.meta.glob<unknown>("./data/generated/details/*.json", {
  eager: true,
  import: "default",
});
const hasGenerated = Object.keys(details).length > 0;

function detailOf(code: string): AreaDetail | undefined {
  if (!hasGenerated) return sampleDetail(code);
  const raw = details[`./data/generated/details/${code}.json`];
  return raw === undefined ? undefined : AreaDetail.parse(raw);
}

// 書き出すページ。
export function pages() {
  return allRoutes(detailOf).map((route) => ({
    route,
    file: outputFile(route),
    path: pathOf(route),
    head: headOf(route),
  }));
}
