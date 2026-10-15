import { hydrateRoot } from "react-dom/client";
import { App, type Page } from "./App";
import "./styles.css";

// ビルド時に生成した HTML に React を引き継がせる。ページの種類は body の data 属性で受け取る。
const root = document.getElementById("root");
if (root) {
  const page = (document.body.dataset.page as Page | undefined) ?? "home";
  hydrateRoot(root, <App page={page} />);
}
