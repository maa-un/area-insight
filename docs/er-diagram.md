# ER 図

データの置き場所は 3 つ。どれも**市区町村コード（5 桁）**でつながる。

| 置き場所 | 中身 | 詳細 |
|---|---|---|
| BigQuery | raw テーブルと集計テーブル | [バッチ](detailed-design/batch.md) |
| 画面向けファイル | 集計テーブルを画面の形にした JSON | [画面](detailed-design/web.md#7-データの準備) |
| Firestore | 利用者のデータ | [保存 API](detailed-design/api.md) |

## 1. BigQuery: raw テーブル

公的 API の応答を加工せずに入れる。値は文字列のまま（数値化は集計 SQL で行う）。

```mermaid
erDiagram
  raw_municipalities ||--o{ raw_transactions : "code = municipality_code"
  raw_municipalities ||--o{ raw_statistics : "code = area_code"
  raw_municipalities ||--o{ raw_population_projection : "code"

  raw_municipalities {
    STRING code PK
    STRING prefecture_code
    STRING name
  }
  raw_transactions {
    DATE period_start "パーティション"
    STRING prefecture_code
    STRING municipality_code
    STRING type
    STRING trade_price
    STRING unit_price
    STRING area
    STRING building_year
  }
  raw_land_prices {
    DATE target_year_start "パーティション"
    INT price_classification "0 公示 / 1 調査"
    FLOAT longitude
    FLOAT latitude
    JSON properties
  }
  raw_station_transactions {
    DATE period_from
    DATE period_to
    FLOAT longitude
    FLOAT latitude
    JSON properties
  }
  raw_condo_transactions {
    DATE period_from
    DATE period_to
    FLOAT longitude
    FLOAT latitude
    JSON properties
  }
  raw_stations {
    JSON geometry
    JSON properties
  }
  raw_statistics {
    STRING table_name
    STRING stats_data_id
    STRING area_code
    JSON categories
    STRING time_code
    STRING value
  }
  raw_population_projection {
    STRING edition
    STRING code
    STRING sex
    STRING age_group
    INT year
    INT population
  }
```

全テーブルに `fetched_at`（取得日時）がある。地点・駅系は座標で結び付けるため、コードの関連線は引いていない。

## 2. BigQuery: 集計テーブル

`aggregate` が `CREATE OR REPLACE` で作り直す。

```mermaid
erDiagram
  area_metrics ||--|| area_details : code
  area_metrics ||--o{ district_land_prices : code
  area_metrics ||--o{ land_price_points : code
  area_metrics }o--o{ station_land_prices : "city_codes に含む"
  area_metrics ||--o{ condo_transactions : code
  station_metrics }o--|| area_metrics : "所在"

  area_metrics {
    STRING code PK
    STRING prefecture_code
    STRING name
    FLOAT trade_price
    INT trade_count
    FLOAT gross_yield
    FLOAT vacancy_rate
    FLOAT population_change_rate
    FLOAT land_unit_price
    INT rent_gap
    BOOL weak_demand
  }
  area_details {
    STRING code PK
    ARRAY quarters
    ARRAY population_history
    STRUCT vacancy_breakdown
    ARRAY recent_transactions
  }
  district_land_prices {
    STRING code
    STRING district "NULL は市区町村全体"
    ARRAY quantiles "21 点"
    INT count
  }
  land_price_points {
    STRING point_id PK
    INT classification
    DATE as_of
    STRING code
    INT price
    FLOAT change_rate
  }
  station_metrics {
    STRING station_name
    FLOAT median_price
    INT count
  }
  station_land_prices {
    STRING station_name
    FLOAT low
    FLOAT median
    FLOAT high
    DATE adjusted_to
  }
  condo_transactions {
    STRING station_name
    STRING code
    DATE period
    FLOAT price
    FLOAT area
    STRING kind
  }
  data_sources {
    STRING metric PK
    STRING source
    DATE period_from
    DATE period_to
    DATE as_of
  }
```

列は主なものだけ。指標の意味は [ユビキタス言語](ubiquitous-language.md#指標市区町村ごと)。書き出し時は各行の先頭に `export_id` が付く。

## 3. 画面向けファイル

`apps/web/scripts/prepare-data.mjs` が書き出しを変換して `src/data/generated/` に置く。形は `packages/shared/src/area.ts` の zod スキーマ。

```mermaid
erDiagram
  AreaMetricsFile ||--|{ AreaMetrics : areas
  AreaMetricsFile ||--|| DataSources : sources
  AreaMetrics ||--|| AreaDetail : "details/{code}.json"
  AreaDetail ||--o{ StationLandPrice : stationLandPrices
  CondoFile ||--|{ CondoStation : stations
  CondoFile ||--o{ CondoTrade : "trades（駅の添字で参照）"
  CondoTrade }o--|| CondoStation : "trade[0]"

  AreaMetricsFile {
    string updatedAt
    bool sample
  }
  AreaMetrics {
    string code PK
    number tradePrice
    number grossYield
    LngLat center
  }
  AreaDetail {
    array quarters
    object landPrices
    object vacancyBreakdown
    array recentTransactions
  }
  CondoFile {
    string prefectureCode PK
  }
  CondoStation {
    string name
    array lines
    LngLat coordinates
  }
  CondoTrade {
    tuple fields "11 要素の配列"
  }
```

| ファイル | 中身 | 読み込み |
|---|---|---|
| `metrics.json` | 全国の `AreaMetrics` と出典・時点 | ビルド時に JS へ |
| `details/{code}.json` | 市区町村ごとの `AreaDetail` | プリレンダー時に HTML へ埋め込む |
| `land-prices.json` | 地価の地点 | 地図ページ |
| `stations.json` | 駅ごとの相場 | 地図ページ |
| `condos/{pref}.json` | 都道府県ごとの `CondoFile` | マンションページで選んだ分だけ fetch |

## 4. Firestore

```mermaid
erDiagram
  area_insight_users {
    string userId PK "ドキュメント ID = Clerk のユーザー ID"
    array favorites "市区町村コード、最大 200"
    array compare "市区町村コード、最大 3"
    array filters "name + conditions、最大 20"
    timestamp updatedAt
  }
```

コレクション名は `area-insight-users`。1 利用者 1 ドキュメント。保存は全体の上書き。
