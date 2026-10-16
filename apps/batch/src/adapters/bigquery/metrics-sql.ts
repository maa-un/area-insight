// 生データから画面向けの指標を作る BigQuery の SQL。仕様書「表示する指標の定義」に沿う。
// 文字列で保存した値（「2,000万円」「75,200(円/㎡)」など）は、ここで初めて数値にする。
// 各値の形は 2026-10 に API の実データで確かめた。

const HOUSE_TYPE = "宅地(土地と建物)";
// 土地だけの取引。㎡単価が付いているのはこの種類だけ（戸建は総額のみ）。
const LAND_TYPE = "宅地(土地)";
// 土地単価の分布に使う期間（8 四半期）。地区ごとに件数を確保するため、指標より長く取る。
const LAND_MONTHS = 24;
// 指標に使う期間（直近 4 四半期）と、推移に使う期間（過去 5 年）。
const RECENT_MONTHS = 12;
const HISTORY_MONTHS = 60;
// 年ごとの推移に使う年数。暦年でそろえ、最新の四半期の年から 5 年さかのぼった年の 1 月 1 日以降を使う
// （途中の年は画面で「○月まで」と示す）。
const HISTORY_YEARS = 5;
// 人口の増減率を何年前と比べるか。
const POPULATION_YEARS = 5;
// 駅ごとの取引の点に駅名を付けるとき、駅の線から何 m 以内を同じ駅とみなすか。
const STATION_MATCH_METERS = 300;
// 市区町村ページに出す直近の取引の件数。
const RECENT_TRANSACTIONS = 8;
// 地価の用途区分のうち、取引単価と比べるもの（API は「0,住宅地」の形で返す。番号を除いた名前で比べる）。
const RESIDENTIAL_USE = "住宅地";
// 駅からの距離を徒歩の分に直す基準（不動産の表示規約: 80m を 1 分とする）。
const METERS_PER_WALK_MINUTE = 80;
// 駅からの距離の区切り（徒歩 10 分以内・20 分以内・それ以上）。
const STATION_DISTANCE_BANDS = [
  { band: "within10", maxMinutes: 10 },
  { band: "within20", maxMinutes: 20 },
] as const;
const BEYOND_BAND = "over20";

// 「1億2,000万円」「2,000万円」→ 万円。形が違えば NULL。
// 実データでは「4,700万円」「9.6万円」の形で返る（2026-10 時点で「億」は使われていない）。小数も読む。
const manYen = (column: string) => `IF(
    REGEXP_CONTAINS(${column}, r'万円|億'),
    IFNULL(SAFE_CAST(REGEXP_EXTRACT(${column}, r'(\\d+)億') AS INT64), 0) * 10000
      + IFNULL(SAFE_CAST(REPLACE(REGEXP_EXTRACT(${column}, r'([\\d,]+(?:\\.\\d+)?)万円'), ',', '') AS FLOAT64), 0),
    NULL)`;

// 「75,200(円/㎡)」→ 75200
const leadingNumber = (column: string) =>
  `SAFE_CAST(REPLACE(REGEXP_EXTRACT(${column}, r'^([\\d,]+)'), ',', '') AS INT64)`;

// 「0,住宅地」「4,商業地」→「住宅地」「商業地」。番号の無い「住宅地」はそのまま。
const categoryName = (column: string) => `REGEXP_EXTRACT(${column}, r'([^,]+)$')`;

// 最寄り駅までの道路距離「150m」「1,200m」「1.2km」→ m。形が違えば NULL（実データの形は 2026-10 に確かめる）。
const distanceMeters = (column: string) => `CASE
      WHEN REGEXP_CONTAINS(${column}, r'km') THEN
        SAFE_CAST(REPLACE(REGEXP_EXTRACT(${column}, r'([\\d,]*\\.?\\d+)\\s*km'), ',', '') AS FLOAT64) * 1000
      ELSE SAFE_CAST(REPLACE(REGEXP_EXTRACT(${column}, r'([\\d,]*\\.?\\d+)\\s*m'), ',', '') AS FLOAT64)
    END`;

// v0.2.0 までは JSON 型の列に JSON.stringify した文字列を入れていたため、「JSON の文字列」として
// 保存された行がある。どちらの形でも中身を読めるよう、文字列なら JSON として読み直す。
const json = (column: string) =>
  `IF(JSON_TYPE(${column}) = 'string', SAFE.PARSE_JSON(JSON_VALUE(${column})), ${column})`;
const prop = (column: string, path: string) => `JSON_VALUE(${json(column)}, '${path}')`;

// 駅からの距離（m）→ 区分の名前（within10 / within20 / over20）。
const stationDistanceBand = (column: string) =>
  `CASE ${STATION_DISTANCE_BANDS.map(
    ({ band, maxMinutes }) =>
      `WHEN ${column} <= ${maxMinutes * METERS_PER_WALK_MINUTE} THEN '${band}'`,
  ).join(" ")} ELSE '${BEYOND_BAND}' END`;
// 区分の並び順（近い順）。
const stationDistanceBandOrder = (column: string) =>
  `CASE ${column} ${STATION_DISTANCE_BANDS.map(({ band }, i) => `WHEN '${band}' THEN ${i}`).join(" ")} ELSE ${STATION_DISTANCE_BANDS.length} END`;

export type MetricsSql = {
  // 指標のテーブルを作り直す（CREATE OR REPLACE）
  rebuild: string[];
  // 画面向けファイルの書き出し（EXPORT DATA）。exportId は今回の書き出しを見分ける印
  exports: (bucket: string, exportId: string) => string[];
};

export function metricsSql(dataset: string): MetricsSql {
  const t = (name: string) => `\`${dataset}.${name}\``;

  // 中古戸建（宅地(土地と建物)）の取引。直近の四半期を基準に期間を切る。
  const houses = `
    houses AS (
      SELECT
        -- XIT001 は先頭の 0 を落として返す（例: 函館市 01202 → "1202"）ため、5 桁にそろえる
        LPAD(municipality_code, 5, '0') AS code,
        period_start,
        district_name,
        SAFE_CAST(trade_price AS INT64) / 10000 AS price,
        SAFE_CAST(area AS FLOAT64) AS land_area,
        SAFE_CAST(total_floor_area AS FLOAT64) AS floor_area,
        SAFE_CAST(REGEXP_EXTRACT(building_year, r'^(\\d{4})年') AS INT64) AS building_year
      FROM ${t("raw_transactions")}
      WHERE type = '${HOUSE_TYPE}'
        AND REGEXP_CONTAINS(municipality_code, r'^\\d{4,5}$')
        AND SAFE_CAST(trade_price AS INT64) IS NOT NULL
    ),
    latest AS (SELECT MAX(period_start) AS quarter FROM ${t("raw_transactions")})`;

  const statistic = (name: string) =>
    `(SELECT area_code AS code, categories, time_code, SAFE_CAST(value AS FLOAT64) AS value
      FROM ${t("raw_statistics")} WHERE table_name = '${name}')`;

  const areaMetrics = `
    CREATE OR REPLACE TABLE ${t("area_metrics")} AS
    WITH ${houses},
    recent AS (
      SELECT h.* FROM houses AS h, latest
      WHERE h.period_start > DATE_SUB(latest.quarter, INTERVAL ${RECENT_MONTHS} MONTH)
    ),
    trade AS (
      SELECT
        code,
        APPROX_QUANTILES(price, 100)[SAFE_OFFSET(50)] AS trade_price,
        COUNT(*) AS trade_count,
        APPROX_QUANTILES(floor_area, 100)[SAFE_OFFSET(50)] AS floor_area
      FROM recent GROUP BY code
    ),
    vacancy AS (
      SELECT code, SAFE_DIVIDE(
        MAX(IF(${prop("categories", "$.cat01")} = '22', value, NULL)),
        MAX(IF(${prop("categories", "$.cat01")} = '0', value, NULL))) * 100 AS vacancy_rate
      FROM ${statistic("housing_vacancy")} GROUP BY code
    ),
    rent AS (SELECT code, MAX(value) AS rent_per_sqm FROM ${statistic("private_rent_per_sqm")} GROUP BY code),
    population AS (
      SELECT code, CAST(SUBSTR(time_code, 1, 4) AS INT64) AS year, CAST(value AS INT64) AS population
      FROM ${statistic("resident_population")} WHERE value IS NOT NULL
    ),
    population_latest AS (
      SELECT code, MAX(year) AS year FROM population GROUP BY code
    ),
    population_change AS (
      SELECT
        l.code,
        now.population,
        SAFE_DIVIDE(now.population - past.population, past.population) * 100 AS change_rate
      FROM population_latest AS l
      JOIN population AS now ON now.code = l.code AND now.year = l.year
      LEFT JOIN population AS past ON past.code = l.code AND past.year = l.year - ${POPULATION_YEARS}
    ),
    -- 市区町村の代表点。画面はビルド時に境界（国土数値情報 N03）の重心で置き換える（apps/web/scripts/prepare-data.mjs）。
    -- ここでは境界に無い市区町村のための控えとして、地価の地点（無ければ駅）の平均位置を出す
    land_center AS (
      SELECT ${prop("properties", "$.city_code")} AS code, AVG(longitude) AS lng, AVG(latitude) AS lat
      FROM ${t("raw_land_prices")} GROUP BY code
    ),
    station_center AS (
      SELECT ${prop("properties", "$.city_code")} AS code, AVG(longitude) AS lng, AVG(latitude) AS lat
      FROM ${t("raw_station_transactions")} GROUP BY code
    ),
    joined AS (
      SELECT
        m.code,
        m.prefecture_code,
        m.name,
        ROUND(trade.trade_price) AS trade_price,
        IFNULL(trade.trade_count, 0) AS trade_count,
        ROUND(vacancy.vacancy_rate, 1) AS vacancy_rate,
        population_change.population,
        ROUND(population_change.change_rate, 1) AS population_change_rate,
        -- 家賃相場 = 民営借家の㎡家賃 × その市区町村で取引された戸建の延床面積（中央値）
        ROUND(rent.rent_per_sqm * trade.floor_area, -3) AS monthly_rent,
        COALESCE(land_center.lng, station_center.lng) AS center_lng,
        COALESCE(land_center.lat, station_center.lat) AS center_lat
      FROM ${t("raw_municipalities")} AS m
      LEFT JOIN trade USING (code)
      LEFT JOIN vacancy USING (code)
      LEFT JOIN rent USING (code)
      LEFT JOIN population_change USING (code)
      LEFT JOIN land_center USING (code)
      LEFT JOIN station_center USING (code)
    )
    SELECT
      joined.*,
      -- 想定表面利回り = 家賃相場 × 12 ÷ 取引価格。物件ごとではなくエリアの目安
      ROUND(SAFE_DIVIDE(monthly_rent * 12, trade_price * 10000) * 100, 1) AS gross_yield
    FROM joined`;

  // 指標ごとの出典と時点（packages/shared の DataSources）。画面はすべての数字のそばに時点を出す。
  //   取引: 直近 RECENT_MONTHS か月の四半期の初日〜最新の四半期の末日
  //   住宅・土地統計調査: time_code の年の 10 月 1 日時点  住民基本台帳人口: 最新年の 1 月 1 日時点
  //   駅ごとの取引相場: 取り込んだ範囲（取得ジョブが直近 4 四半期を取り直す）
  const dataSources = `
    CREATE OR REPLACE TABLE ${t("data_sources")} AS
    WITH latest AS (SELECT MAX(period_start) AS quarter FROM ${t("raw_transactions")}),
    survey AS (
      SELECT table_name, DATE(CAST(SUBSTR(MAX(time_code), 1, 4) AS INT64), 10, 1) AS as_of
      FROM ${t("raw_statistics")} WHERE table_name IN ('housing_vacancy', 'private_rent_per_sqm')
      GROUP BY table_name
    ),
    population AS (
      SELECT DATE(MAX(CAST(SUBSTR(time_code, 1, 4) AS INT64)), 1, 1) AS as_of
      FROM ${t("raw_statistics")}
      WHERE table_name = 'resident_population' AND SAFE_CAST(value AS FLOAT64) IS NOT NULL
    ),
    stations AS (
      -- period_to は最後の四半期の初日で入っている（raw-rows.ts）ため、その四半期の末日にする
      SELECT MIN(period_from) AS period_from, LAST_DAY(DATE_ADD(MAX(period_to), INTERVAL 2 MONTH)) AS period_to
      FROM ${t("raw_station_transactions")}
    )
    SELECT 'tradePrice' AS metric, 'XIT001' AS source,
      DATE_SUB(quarter, INTERVAL ${RECENT_MONTHS - 3} MONTH) AS period_from,
      LAST_DAY(DATE_ADD(quarter, INTERVAL 2 MONTH)) AS period_to,
      CAST(NULL AS DATE) AS as_of
    FROM latest
    UNION ALL
    SELECT 'vacancyRate', 'housing_survey', NULL, NULL, as_of FROM survey WHERE table_name = 'housing_vacancy'
    UNION ALL
    SELECT 'monthlyRent', 'housing_survey', NULL, NULL, as_of FROM survey WHERE table_name = 'private_rent_per_sqm'
    UNION ALL
    SELECT 'population', 'resident_register', NULL, NULL, as_of FROM population
    UNION ALL
    SELECT 'stations', 'XPT001', period_from, period_to, NULL FROM stations`;

  const areaDetails = `
    CREATE OR REPLACE TABLE ${t("area_details")} AS
    WITH ${houses},
    history AS (
      SELECT h.* FROM houses AS h, latest
      WHERE h.period_start > DATE_SUB(latest.quarter, INTERVAL ${HISTORY_MONTHS} MONTH)
    ),
    quarters AS (
      SELECT code, ARRAY_AGG(STRUCT(
        FORMAT('%dQ%d', EXTRACT(YEAR FROM period_start), EXTRACT(QUARTER FROM period_start)) AS period,
        price, count) ORDER BY period_start) AS quarters
      FROM (
        SELECT code, period_start, ROUND(APPROX_QUANTILES(price, 100)[SAFE_OFFSET(50)]) AS price, COUNT(*) AS count
        FROM history GROUP BY code, period_start
      ) GROUP BY code
    ),
    yearly_source AS (
      SELECT h.* FROM houses AS h, latest
      WHERE h.period_start >= DATE_TRUNC(DATE_SUB(latest.quarter, INTERVAL ${HISTORY_YEARS} YEAR), YEAR)
    ),
    years AS (
      SELECT code, ARRAY_AGG(STRUCT(year, price, count) ORDER BY year) AS years
      FROM (
        SELECT code, EXTRACT(YEAR FROM period_start) AS year,
          ROUND(APPROX_QUANTILES(price, 100)[SAFE_OFFSET(50)]) AS price, COUNT(*) AS count
        FROM yearly_source GROUP BY code, year
      ) GROUP BY code
    ),
    recent AS (
      SELECT code, ARRAY_AGG(STRUCT(
        FORMAT('%dQ%d', EXTRACT(YEAR FROM period_start), EXTRACT(QUARTER FROM period_start)) AS period,
        IFNULL(district_name, '') AS district, ROUND(price) AS price, land_area, floor_area, building_year)
        ORDER BY period_start DESC, price DESC LIMIT ${RECENT_TRANSACTIONS}) AS recent_transactions
      FROM history GROUP BY code
    ),
    population AS (
      SELECT area_code AS code, ARRAY_AGG(STRUCT(
        CAST(SUBSTR(time_code, 1, 4) AS INT64) AS year, CAST(SAFE_CAST(value AS FLOAT64) AS INT64) AS population)
        ORDER BY time_code) AS population_history
      FROM ${t("raw_statistics")}
      WHERE table_name = 'resident_population' AND SAFE_CAST(value AS FLOAT64) IS NOT NULL
      GROUP BY code
    ),
    -- 住宅地の地価（公示地価・地価調査の最新年の地点）。取引単価との比較の基準にする
    residential AS (
      SELECT code, price, station_distance_m FROM ${t("land_price_points")} WHERE use = '${RESIDENTIAL_USE}'
    ),
    official AS (
      SELECT code, ROUND(APPROX_QUANTILES(price, 100)[SAFE_OFFSET(50)]) AS price, COUNT(*) AS count
      FROM residential GROUP BY code
    ),
    -- 駅からの距離別（徒歩 10 分以内・20 分以内・それ以上）の住宅地の地価。距離の無い地点は数えない
    by_distance AS (
      SELECT code, ARRAY_AGG(STRUCT(band, price, count) ORDER BY ${stationDistanceBandOrder("band")}) AS bands
      FROM (
        SELECT code, band, ROUND(APPROX_QUANTILES(price, 100)[SAFE_OFFSET(50)]) AS price, COUNT(*) AS count
        FROM (
          SELECT code, price, ${stationDistanceBand("station_distance_m")} AS band
          FROM residential WHERE station_distance_m IS NOT NULL
        ) GROUP BY code, band
      ) GROUP BY code
    )
    SELECT
      m.code,
      IFNULL(quarters.quarters, []) AS quarters,
      IFNULL(years.years, []) AS years,
      IFNULL(population.population_history, []) AS population_history,
      IFNULL(recent.recent_transactions, []) AS recent_transactions,
      IF(official.code IS NULL, NULL, STRUCT(official.price, official.count)) AS official_land_price,
      IFNULL(by_distance.bands, []) AS land_prices_by_station_distance
    FROM ${t("raw_municipalities")} AS m
    LEFT JOIN quarters USING (code)
    LEFT JOIN years USING (code)
    LEFT JOIN recent USING (code)
    LEFT JOIN population USING (code)
    LEFT JOIN official USING (code)
    LEFT JOIN by_distance USING (code)`;

  // 地価は最新の年の地点だけを出す（地価公示と地価調査の両方）。area_details がこの表を読むため、先に作る。
  const landPricePoints = `
    CREATE OR REPLACE TABLE ${t("land_price_points")} AS
    SELECT
      ${prop("properties", "$.point_id")} AS point_id,
      ${prop("properties", "$.city_code")} AS code,
      SUBSTR(${prop("properties", "$.city_code")}, 1, 2) AS prefecture_code,
      longitude, latitude,
      ${leadingNumber(prop("properties", "$.u_current_years_price_ja"))} AS price,
      SAFE_CAST(${prop("properties", "$.year_on_year_change_rate")} AS FLOAT64) AS change_rate,
      IFNULL(${categoryName(prop("properties", "$.use_category_name_ja"))}, '') AS use,
      IFNULL(${prop("properties", "$.location")}, '') AS location,
      ${prop("properties", "$.nearest_station_name_ja")} AS station_name,
      ${distanceMeters(prop("properties", "$.u_road_distance_to_nearest_station_name_ja"))} AS station_distance_m
    FROM ${t("raw_land_prices")}
    WHERE target_year_start = (SELECT MAX(target_year_start) FROM ${t("raw_land_prices")})
      AND ${leadingNumber(prop("properties", "$.u_current_years_price_ja"))} IS NOT NULL`;

  // 駅ごとの取引相場。XPT001 は「土地と建物」の㎡単価が空のため、同じ駅（同じ位置）に集まる取引の
  // 総額の中央値と件数を出す。XPT001 は駅名を返さないため、駅（XKT015）の線のうち最も近いものの駅名を付け、
  // 同じグループコード（同じ名前の駅を運営会社をまたいでまとめたもの）の路線名を並べる。
  // 2026-10 に新宿付近の 1 タイルで確かめたところ、点から最寄りの駅の線までは中央値 6m・最大 117m だった。
  const stationMetrics = `
    CREATE OR REPLACE TABLE ${t("station_metrics")} AS
    WITH points AS (
      SELECT
        ANY_VALUE(SUBSTR(${prop("properties", "$.city_code")}, 1, 2)) AS prefecture_code,
        ANY_VALUE(${prop("properties", "$.city_name_ja")}) AS city_name,
        longitude, latitude,
        APPROX_QUANTILES(${manYen(prop("properties", "$.u_transaction_price_total_ja"))}, 100)[SAFE_OFFSET(50)] AS median_price,
        COUNT(*) AS count
      FROM ${t("raw_station_transactions")}
      WHERE ${prop("properties", "$.land_type_name_ja")} = '${HOUSE_TYPE}'
      GROUP BY longitude, latitude
      HAVING median_price IS NOT NULL
    ),
    stations AS (
      SELECT
        ${prop("properties", "$.S12_001g")} AS group_code,
        ${prop("properties", "$.S12_001_ja")} AS station_name,
        ${prop("properties", "$.S12_003_ja")} AS line_name,
        SAFE.ST_GEOGFROMGEOJSON(TO_JSON_STRING(${json("geometry")})) AS geography
      FROM ${t("raw_stations")}
    ),
    nearest AS (
      SELECT
        p.longitude, p.latitude,
        ARRAY_AGG(STRUCT(s.group_code, s.station_name)
          ORDER BY ST_DISTANCE(ST_GEOGPOINT(p.longitude, p.latitude), s.geography) LIMIT 1)[OFFSET(0)] AS station
      FROM points AS p
      JOIN stations AS s
        ON ST_DWITHIN(ST_GEOGPOINT(p.longitude, p.latitude), s.geography, ${STATION_MATCH_METERS})
      GROUP BY p.longitude, p.latitude
    ),
    lines AS (
      SELECT group_code, ARRAY_AGG(DISTINCT line_name IGNORE NULLS ORDER BY line_name) AS line_names
      FROM stations GROUP BY group_code
    )
    SELECT
      points.*,
      nearest.station.station_name,
      IFNULL(lines.line_names, []) AS line_names
    FROM points
    LEFT JOIN nearest USING (longitude, latitude)
    LEFT JOIN lines ON lines.group_code = nearest.station.group_code`;

  // 土地の取引単価の分布。地区ごとと市区町村全体（district が NULL）。
  // 分位は 0〜100% を 5% 刻みの 21 値で持ち、画面で「この単価は地区の下位何%か」を出す。
  const districtLandPrices = `
    CREATE OR REPLACE TABLE ${t("district_land_prices")} AS
    WITH latest AS (SELECT MAX(period_start) AS quarter FROM ${t("raw_transactions")}),
    land AS (
      SELECT
        LPAD(municipality_code, 5, '0') AS code,
        IFNULL(district_name, '') AS district,
        SAFE_CAST(unit_price AS INT64) AS unit_price,
        SAFE_CAST(area AS FLOAT64) AS land_area
      FROM ${t("raw_transactions")}, latest
      WHERE type = '${LAND_TYPE}'
        AND REGEXP_CONTAINS(municipality_code, r'^\\d{4,5}$')
        AND SAFE_CAST(unit_price AS INT64) > 0
        AND period_start > DATE_SUB(latest.quarter, INTERVAL ${LAND_MONTHS} MONTH)
    ),
    stats AS (
      SELECT code, district, COUNT(*) AS count,
        APPROX_QUANTILES(unit_price, 20) AS quantiles,
        APPROX_QUANTILES(land_area, 2)[SAFE_OFFSET(1)] AS median_area
      FROM land GROUP BY code, district
      UNION ALL
      SELECT code, NULL AS district, COUNT(*) AS count,
        APPROX_QUANTILES(unit_price, 20) AS quantiles,
        APPROX_QUANTILES(land_area, 2)[SAFE_OFFSET(1)] AS median_area
      FROM land GROUP BY code
    ),
    period AS (
      SELECT
        DATE_ADD(DATE_SUB(quarter, INTERVAL ${LAND_MONTHS} MONTH), INTERVAL 3 MONTH) AS from_date,
        quarter AS to_date
      FROM latest
    )
    SELECT
      stats.*,
      FORMAT('%dQ%d', EXTRACT(YEAR FROM from_date), EXTRACT(QUARTER FROM from_date)) AS period_from,
      FORMAT('%dQ%d', EXTRACT(YEAR FROM to_date), EXTRACT(QUARTER FROM to_date)) AS period_to
    FROM stats, period`;

  return {
    rebuild: [
      areaMetrics,
      landPricePoints,
      areaDetails,
      districtLandPrices,
      stationMetrics,
      dataSources,
    ],
    exports: (bucket, exportId) =>
      [
        "data_sources",
        "area_metrics",
        "area_details",
        "district_land_prices",
        "land_price_points",
        "station_metrics",
      ].map(
        (name) => `
          EXPORT DATA OPTIONS (
            uri = 'gs://${bucket}/exports/${name}/*.json',
            format = 'JSON',
            overwrite = true
          ) AS
          SELECT '${exportId}' AS export_id, * FROM ${t(name)}`,
      ),
  };
}
