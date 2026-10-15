import { AreaDetail } from "@area-insight/shared";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";
import { initAuth } from "./lib/auth";
import { initUserData } from "./lib/user-data";
import { pageOfPath, type Route } from "./routes";
import "./styles.css";

// ビルド時に生成した HTML に React を引き継がせる。ページの種類と市区町村の詳細は、
// 静的生成で埋め込んだ JSON（#route）から受け取る。
async function currentRoute(): Promise<Route> {
  const embedded = document.getElementById("route")?.textContent;
  if (embedded) {
    const route = JSON.parse(embedded) as Route;
    // 埋め込みデータも外から来るものとして検証する
    return route.page === "area" ? { page: "area", detail: AreaDetail.parse(route.detail) } : route;
  }
  // 開発サーバーでは静的生成をしないので、URL からページを決める。
  const { page, code } = pageOfPath(window.location.pathname);
  if (page === "area" && code) {
    const { sampleDetail } = await import("./data/sample");
    const detail = sampleDetail(code);
    return detail ? { page: "area", detail } : { page: "not-found" };
  }
  return { page } as Route;
}

const root = document.getElementById("root");
if (root) {
  const route = await currentRoute();
  if (document.getElementById("route")) hydrateRoot(root, <App route={route} />);
  else createRoot(root).render(<App route={route} />);
  initAuth();
  initUserData();
}
