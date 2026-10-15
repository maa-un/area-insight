// バッチ（apps/batch）・保存 API（apps/api）・画面（apps/web）で共有する型とスキーマ。
// 外部から来るデータは実行時に形が変わりうるため、型だけでなく zod で検証する。
export * from "./municipality.js";
export * from "./user-data.js";
