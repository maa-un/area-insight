import { renderToString } from "react-dom/server";
import { App, type Page } from "./App";

// ビルド時の静的生成（scripts/prerender.mjs）から呼ぶ。
export function render(page: Page): string {
  return renderToString(<App page={page} />);
}
