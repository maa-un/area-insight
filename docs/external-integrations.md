# 外部連携

鍵・トークンの値は Secret Manager にだけ置く（[インフラ構成図](infrastructure.md#secret-manager)）。

## 一覧

| 連携先 | 方向 | 使う部品 | 認証 |
|---|---|---|---|
| 不動産情報ライブラリ（国交省） | 取得 | バッチ | `Ocp-Apim-Subscription-Key` ヘッダー |
| e-Stat | 取得 | バッチ | `appId`（URL に入る仕様） |
| 社人研（IPSS） | 取得 | バッチ | なし |
| Clerk | 認証 / Webhook | 画面・保存 API | 公開キー、JWKS、svix 署名 |
| PropFolio | 送客 | 画面 | なし（URL クエリ） |
| 地理院タイル / OpenFreeMap | 地図の背景 | 画面 | なし（出典の表示が条件） |
| GitHub | 画面の作り直しの通知 | Workflows | トークン（Secret Manager） |

## 公的データ（バッチ）

共通ルール（`apps/batch/src/adapters/rate-limited-fetcher.ts`）:

| 項目 | 値 |
|---|---|
| リクエスト間隔 | 1 秒（`REQUEST_INTERVAL_MS`） |
| 再試行 | 5xx・通信エラーを指数バックオフ（1s→2s→4s、上限 30s）で最大 4 回 |
| 404 | 「データなし」として扱う |
| その他の 4xx | 再試行せず失敗 |
| ログ | URL・鍵を出さない（API 名とステータスだけ） |

### 不動産情報ライブラリ

ベース URL: `https://www.reinfolib.mlit.go.jp/ex-api/external/<API>`

| API | 内容 | 主な条件 | 単位 | ジョブ |
|---|---|---|---|---|
| XIT002 | 市区町村一覧 | 都道府県 | 都道府県 | municipalities |
| XIT001 | 不動産取引価格 | 取引価格のみ（`priceClassification=01`） | 都道府県 × 四半期 | transactions |
| XPT002 | 地価公示・地価調査の地点 | 年、種類 0 / 1 | z13 タイル | land-prices |
| XPT001 | 取引（最寄り駅位置） | 土地・土地と建物 | z11 タイル × 期間 | station-transactions |
| XPT001 | 中古マンション等 | 取引価格と成約価格の両方 | z11 タイル × 期間 | condo-transactions |
| XKT015 | 駅（国土数値情報） | — | z11 タイル | stations |

画面には API 規約の定型文と出典を表示する。

### e-Stat

`getStatsData`（API 3.0、JSON）。`NEXT_KEY` でページングする。

| 表 | 中身 |
|---|---|
| `housing_vacancy` | 令和 5 年 住宅・土地統計調査の空き家（総数・空き家・内訳） |
| `housing_vacancy_previous` | 平成 30 年の同じ表（総数と空き家だけ） |
| `private_rent_per_sqm` | 令和 5 年 民営借家の 1㎡家賃 |
| `resident_population` | 住民基本台帳人口（社会・人口統計体系） |

調査が更新されたら `statsDataId` を差し替える。

### 社人研

「日本の地域別将来推計人口（令和 5 年推計）」の都道府県ごとの Excel。2020 年（実績）と 2025〜2050 年（5 年ごと）を取る。利用条件は PDL1.0（出典と加工の明示）。

## Clerk

PropFolio と同じ本番アプリ。Frontend API は `https://clerk.maa-un.com`。

| 項目 | 画面 | 保存 API |
|---|---|---|
| 使うもの | `@clerk/clerk-js`（必要時だけ読み込む） | JWKS（`{issuer}/.well-known/jwks.json`） |
| 設定 | `VITE_CLERK_PUBLISHABLE_KEY`（未設定ならログイン機能を出さない） | `CLERK_ISSUER`、`CLERK_AUTHORIZED_PARTIES` |
| 検証 | — | 署名、`iss`、`azp`、`sub` |

Webhook:

| 項目 | 値 |
|---|---|
| URL | `https://machinome.maa-un.com/api/webhooks/clerk` |
| 購読イベント | `user.deleted` |
| 署名 | svix（HMAC-SHA256、時刻の許容 ±5 分） |
| 鍵 | `CLERK_WEBHOOK_SECRET`（`whsec_...`） |

## PropFolio

`https://propfolio.maa-un.com/` を新しいタブで開く。詳細ページと比較ページの「収支を計算」から。

| クエリ | 中身 |
|---|---|
| `utm_source` | `area-insight` |
| `area` | 市区町村コード |
| `price` | 取引価格（円） |
| `rent` | 家賃相場（円/月） |
| `land_unit_price` | 土地の取引単価（円/㎡） |
| `vacancy_rate` | 空き家率（%） |
| `population_change_rate` | 人口増減率（%） |
| `price_as_of` / `rent_as_of` | それぞれの時点 |

値が無いものは付けない。**名前と単位は PropFolio 側と調整中**（[要件定義の未決事項](requirements.md#7-未決事項)）。

## 地図

| 提供元 | 用途 |
|---|---|
| 地理院タイル | 地図の背景「淡色」（既定）・「標準」・「写真」 |
| OpenFreeMap | 地図の背景「建物」（スタイル・タイル・フォント） |
| 国土数値情報 N03 | 市区町村の境界（ビルド前に `build-boundaries.mjs` で作る、CC BY 4.0） |

## GitHub

Workflows がデータ更新の最後に `repository_dispatch`（`data-updated`）を送り、`deploy.yml` が画面だけを作り直す。
