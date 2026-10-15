import { renderToString } from "react-dom/server";
import { App } from "./App";
import { sampleDetail } from "./data/sample";
import { allRoutes, headOf, outputFile, pathOf, type Route } from "./routes";

// ビルド時の静的生成（scripts/prerender.mjs）から呼ぶ。
export function render(route: Route): string {
  return renderToString(<App route={route} />);
}

// 書き出すページ。市区町村の詳細は、集計ジョブの書き出しができたらそのファイルに差し替える。
export function pages() {
  return allRoutes(sampleDetail).map((route) => ({
    route,
    file: outputFile(route),
    path: pathOf(route),
    head: headOf(route),
  }));
}
