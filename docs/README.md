# area-insight 仕様書

一般ユーザー向けの不動産エリア分析サービス「**マチノメ**」（https://machinome.maa-un.com）の仕様をまとめる。

## 資料一覧

| 区分 | 資料 | 何がわかるか |
|---|---|---|
| 要件 | [要件定義](requirements.md) | 誰の何を解決するか、機能・非機能の要件 |
| 共通 | [ユビキタス言語](ubiquitous-language.md) | 用語と指標の定義。**他の資料はここの言葉を使う** |
| 設計 | [基本設計](basic-design.md) | 方式、責務分担、技術選定、非機能の実現方法 |
| 設計 | [システム構成図](system-architecture.md) | アプリの構成要素とデータの流れ |
| 設計 | [インフラ構成図](infrastructure.md) | Google Cloud のリソース構成 |
| 設計 | [画面遷移図](screen-flow.md) | ページと遷移 |
| 設計 | [シーケンス図](sequence-diagrams.md) | 主要な処理の流れ（更新・閲覧・保存・削除・リリース） |
| 設計 | [ER 図](er-diagram.md) | BigQuery・Firestore・画面向けファイルのデータ構造 |
| 設計 | [外部連携](external-integrations.md) | 公的 API、Clerk、PropFolio、地図タイル、GitHub |
| 詳細設計 | [画面（apps/web）](detailed-design/web.md) | ページごとの表示・操作・ロジック |
| 詳細設計 | [バッチ（apps/batch）](detailed-design/batch.md) | ジョブ、テーブル、集計 SQL |
| 詳細設計 | [保存 API（apps/api）](detailed-design/api.md) | エンドポイント、業務ルール、認証 |

## 読む順番

1. 初めての人: 要件定義 → ユビキタス言語 → システム構成図
2. 画面を触る人: 画面遷移図 → 詳細設計（画面）
3. データを触る人: ER 図 → 詳細設計（バッチ） → 外部連携

## 更新のきまり

- コードと食い違ったら**コードが正**。気づいたら同じ PR で資料も直す
- 数値（上限件数や閾値）は `packages/shared` の定数が正。資料では値と定数名を併記する
- インフラの正は [maa-un/maaun-terraform](https://github.com/maa-un/maaun-terraform) の `envs/dev/gcp`
