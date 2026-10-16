import { RELIABLE_TRADE_COUNT } from "@area-insight/shared";

// 生データから画面向けの指標を作る BigQuery の SQL。仕様書「表示する指標の定義」「独自指標と市場の歪み」に沿う。
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
// 地価の種類（API の priceClassification）。地価公示は 1 月 1 日、都道府県地価調査（基準地価）は 7 月 1 日の時点。
const OFFICIAL = "0";
const PREFECTURE_SURVEY = "1";
// 駅ごとの土地の坪単価の幅（25%〜75% 点）。仕様書「駅ごとの妥当な土地の坪単価」
const FAIR_LOW = 25;
const FAIR_HIGH = 75;
// 「利回りは高いが需要が弱い」とみなす都道府県内の位置（上位 2 割）。
const WEAK_DEMAND_RANK = 0.8;
// 歪みの順位の差を出すには、比べる市区町村がこれ以上要る（少ないと順位が 0 か 100 に偏る）。
const MIN_PEERS = 5;

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

// XPT001 の取引時期「2025年第2四半期」→ その四半期の初日。形が違えば NULL。
const quarterStart = (column: string) => `SAFE.DATE(
    SAFE_CAST(REGEXP_EXTRACT(${column}, r'^(\\d{4})年') AS INT64),
    SAFE_CAST(REGEXP_EXTRACT(${column}, r'第(\\d)四半期') AS INT64) * 3 - 2,
    1)`;

// 金額「75,000円」「18万円」→ 円。形が違えば NULL（XPT001 の㎡単価の形は実データで確かめる）。
const yen = (column: string) => `IF(
    REGEXP_CONTAINS(${column}, r'万円|億'), (${manYen(column)}) * 10000,
    SAFE_CAST(REPLACE(REGEXP_EXTRACT(${column}, r'^([\\d,]+(?:\\.\\d+)?)'), ',', '') AS FLOAT64))`;

// 同じ都道府県の市区町村の中での位置（0〜1）。値の無い市区町村は数えず、比べる相手が少なければ NULL。
const rankInPrefecture = (column: string) => `IF(
    ${column} IS NULL OR COUNT(${column}) OVER (PARTITION BY prefecture_code) < ${MIN_PEERS}, NULL,
    PERCENT_RANK() OVER (PARTITION BY prefecture_code, ${column} IS NULL ORDER BY ${column}))`;

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

  // 土地（宅地(土地)）の取引の㎡単価。土地の指標と分布に使う。
  const lands = `
    lands AS (
      SELECT
        LPAD(municipality_code, 5, '0') AS code,
        period_start,
        IFNULL(district_name, '') AS district,
        SAFE_CAST(unit_price AS INT64) AS unit_price,
        SAFE_CAST(area AS FLOAT64) AS land_area
      FROM ${t("raw_transactions")}
      WHERE type = '${LAND_TYPE}'
        AND REGEXP_CONTAINS(municipality_code, r'^\\d{4,5}$')
        AND SAFE_CAST(unit_price AS INT64) > 0
    )`;

  const areaMetrics = `
    CREATE OR REPLACE TABLE ${t("area_metrics")} AS
    WITH ${houses}, ${lands},
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
    -- 土地の取引単価（直近 8 四半期）と、直近 4 四半期・その前の 4 四半期の中央値
    land AS (
      SELECT
        code,
        APPROX_QUANTILES(unit_price, 100)[SAFE_OFFSET(50)] AS land_unit_price,
        COUNT(*) AS land_trade_count,
        APPROX_QUANTILES(IF(recent_year, unit_price, NULL), 100)[SAFE_OFFSET(50)] AS land_current,
        COUNTIF(recent_year) AS land_current_count,
        APPROX_QUANTILES(IF(recent_year, NULL, unit_price), 100)[SAFE_OFFSET(50)] AS land_previous,
        COUNTIF(NOT recent_year) AS land_previous_count
      FROM (
        SELECT l.*, l.period_start > DATE_SUB(latest.quarter, INTERVAL ${RECENT_MONTHS} MONTH) AS recent_year
        FROM lands AS l, latest
        WHERE l.period_start > DATE_SUB(latest.quarter, INTERVAL ${LAND_MONTHS} MONTH)
      )
      GROUP BY code
    ),
    -- 住宅地の地価（公示地価・基準地価の最新年の地点）の中央値と、地点の前年比の中央値
    official AS (
      SELECT
        code,
        APPROX_QUANTILES(price, 100)[SAFE_OFFSET(50)] AS official_land_price,
        APPROX_QUANTILES(change_rate, 100)[SAFE_OFFSET(50)] AS official_change_rate
      FROM ${t("land_price_points")} WHERE use = '${RESIDENTIAL_USE}' GROUP BY code
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
        ROUND(rent.rent_per_sqm) AS rent_per_sqm,
        ROUND(land.land_unit_price) AS land_unit_price,
        IFNULL(land.land_trade_count, 0) AS land_trade_count,
        -- 前年比は、直近 4 四半期とその前の 4 四半期の両方に十分な件数があるときだけ出す
        IF(land.land_current_count >= ${RELIABLE_TRADE_COUNT} AND land.land_previous_count >= ${RELIABLE_TRADE_COUNT},
          ROUND(SAFE_DIVIDE(land.land_current - land.land_previous, land.land_previous) * 100, 1), NULL)
          AS land_price_change_rate,
        ROUND(official.official_land_price) AS official_land_price,
        ROUND(official.official_change_rate, 1) AS official_land_price_change_rate,
        IF(land.land_trade_count >= ${RELIABLE_TRADE_COUNT},
          ROUND(SAFE_DIVIDE(land.land_unit_price, official.official_land_price), 2), NULL) AS land_to_official_ratio,
        COALESCE(land_center.lng, station_center.lng) AS center_lng,
        COALESCE(land_center.lat, station_center.lat) AS center_lat
      FROM ${t("raw_municipalities")} AS m
      LEFT JOIN trade USING (code)
      LEFT JOIN land USING (code)
      LEFT JOIN official USING (code)
      LEFT JOIN vacancy USING (code)
      LEFT JOIN rent USING (code)
      LEFT JOIN population_change USING (code)
      LEFT JOIN land_center USING (code)
      LEFT JOIN station_center USING (code)
    ),
    with_yield AS (
      SELECT
        joined.*,
        -- 想定表面利回り = 家賃相場 × 12 ÷ 取引価格。物件ごとではなくエリアの目安
        ROUND(SAFE_DIVIDE(monthly_rent * 12, trade_price * 10000) * 100, 1) AS gross_yield,
        -- 件数の少ない取引の値は、順位の比較に使わない（参考値）
        IF(land_trade_count >= ${RELIABLE_TRADE_COUNT}, land_unit_price, NULL) AS reliable_land_unit_price,
        IF(trade_count >= ${RELIABLE_TRADE_COUNT},
          ROUND(SAFE_DIVIDE(monthly_rent * 12, trade_price * 10000) * 100, 1), NULL) AS reliable_gross_yield
      FROM joined
    ),
    -- 市場の歪み（仕様書「市場の歪み指標」）。同じ都道府県の市区町村の中での位置（0〜1）を出し、
    -- 「需要の指標の位置 − 価格の指標の位置」を -100〜100 で表す
    ranked AS (
      SELECT
        with_yield.*,
        ${rankInPrefecture("population_change_rate")} AS population_rank,
        ${rankInPrefecture("rent_per_sqm")} AS rent_rank,
        ${rankInPrefecture("reliable_land_unit_price")} AS land_rank,
        ${rankInPrefecture("official_land_price_change_rate")} AS official_change_rank,
        ${rankInPrefecture("land_price_change_rate")} AS land_change_rank,
        ${rankInPrefecture("reliable_gross_yield")} AS yield_rank,
        ${rankInPrefecture("vacancy_rate")} AS vacancy_rank
      FROM with_yield
    )
    SELECT
      * EXCEPT (reliable_land_unit_price, reliable_gross_yield, population_rank, rent_rank, land_rank,
        official_change_rank, land_change_rank, yield_rank, vacancy_rank),
      CAST(ROUND((population_rank - rent_rank) * 100) AS INT64) AS rent_gap,
      CAST(ROUND((population_rank - land_rank) * 100) AS INT64) AS land_gap,
      CAST(ROUND((official_change_rank - land_change_rank) * 100) AS INT64) AS momentum_gap,
      IFNULL(yield_rank >= ${WEAK_DEMAND_RANK} AND population_change_rate < 0
        AND vacancy_rank >= ${WEAK_DEMAND_RANK}, FALSE) AS weak_demand
    FROM ranked`;

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

  // 地価は種類（地価公示・地価調査）ごとに最新の年の地点を出す。地価調査は 9 月公表のため、
  // 今年の地価公示を取り込んだ後も、地価調査は前年のものを使う。area_metrics と area_details がこの表を読むため、先に作る。
  const landPricePoints = `
    CREATE OR REPLACE TABLE ${t("land_price_points")} AS
    WITH latest AS (
      SELECT price_classification, MAX(target_year_start) AS target_year_start
      FROM ${t("raw_land_prices")} GROUP BY price_classification
    )
    SELECT
      ${prop("properties", "$.point_id")} AS point_id,
      price_classification AS classification,
      -- 価格の時点: 地価公示は 1 月 1 日、地価調査は 7 月 1 日
      IF(price_classification = '${PREFECTURE_SURVEY}', DATE_ADD(target_year_start, INTERVAL 6 MONTH),
        target_year_start) AS as_of,
      ${prop("properties", "$.city_code")} AS code,
      SUBSTR(${prop("properties", "$.city_code")}, 1, 2) AS prefecture_code,
      longitude, latitude,
      ${leadingNumber(prop("properties", "$.u_current_years_price_ja"))} AS price,
      SAFE_CAST(${prop("properties", "$.year_on_year_change_rate")} AS FLOAT64) AS change_rate,
      IFNULL(${categoryName(prop("properties", "$.use_category_name_ja"))}, '') AS use,
      IFNULL(${prop("properties", "$.location")}, '') AS location,
      ${prop("properties", "$.nearest_station_name_ja")} AS station_name,
      ${distanceMeters(prop("properties", "$.u_road_distance_to_nearest_station_name_ja"))} AS station_distance_m
    FROM ${t("raw_land_prices")} JOIN latest USING (price_classification, target_year_start)
    WHERE ${leadingNumber(prop("properties", "$.u_current_years_price_ja"))} IS NOT NULL`;

  // XPT001 の取引。位置は物件の最寄り駅で、取引時期は「2025年第2四半期」の形で返る。
  const stationTrades = `
    station_trades AS (
      SELECT
        longitude, latitude, properties,
        ${quarterStart(prop("properties", "$.point_in_time_name_ja"))} AS period_start,
        ${prop("properties", "$.land_type_name_ja")} AS land_type
      FROM ${t("raw_station_transactions")}
    ),
    station_latest AS (SELECT MAX(period_start) AS quarter FROM station_trades)`;

  // points（longitude, latitude を持つ CTE）の各点に、最も近い駅（XKT015）の線の駅名を付ける。
  // XPT001 は駅名を返さないため、駅の線のうち最も近いものの駅名を付け、
  // 同じグループコード（同じ名前の駅を運営会社をまたいでまとめたもの）の路線名を並べる。
  // 2026-10 に新宿付近の 1 タイルで確かめたところ、点から最寄りの駅の線までは中央値 6m・最大 117m だった。
  const stationNames = `
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
    )`;

  // 駅ごとの取引相場（直近 4 四半期）。XPT001 は「土地と建物」の㎡単価が空のため、同じ駅（同じ位置）に集まる取引の
  // 総額の中央値と件数を出す。取引時期が読めない取引は期間で絞らずに数える。
  const stationMetrics = `
    CREATE OR REPLACE TABLE ${t("station_metrics")} AS
    WITH ${stationTrades},
    points AS (
      SELECT
        ANY_VALUE(SUBSTR(${prop("properties", "$.city_code")}, 1, 2)) AS prefecture_code,
        ANY_VALUE(${prop("properties", "$.city_name_ja")}) AS city_name,
        longitude, latitude,
        APPROX_QUANTILES(${manYen(prop("properties", "$.u_transaction_price_total_ja"))}, 100)[SAFE_OFFSET(50)] AS median_price,
        COUNT(*) AS count
      FROM station_trades, station_latest
      WHERE land_type = '${HOUSE_TYPE}'
        AND (period_start IS NULL OR period_start > DATE_SUB(station_latest.quarter, INTERVAL ${RECENT_MONTHS} MONTH))
      GROUP BY longitude, latitude
      HAVING median_price IS NOT NULL
    ),
    ${stationNames}
    SELECT
      points.*,
      nearest.station.station_name,
      IFNULL(lines.line_names, []) AS line_names
    FROM points
    LEFT JOIN nearest USING (longitude, latitude)
    LEFT JOIN lines ON lines.group_code = nearest.station.group_code`;

  // 駅ごとの土地の坪単価の目安（仕様書「駅ごとの妥当な土地の坪単価」）。
  // 1. XPT001 の土地（宅地(土地)）の取引の㎡単価を取る（直近 8 四半期）
  // 2. 取引のあった市区町村の住宅地の地価の前年比 r で、最新の地価公示の時点へ補正する: 単価 × (1 + r)^(年数)
  //    年数は四半期の中ほど（初日 + 45 日）から補正先までの日数 ÷ 365.25。前年比が無い市区町村は補正しない
  // 3. 駅ごとに補正後の 25%・50%・75% 点を出す
  // 4. 距離別には、同じ駅名（同じ都道府県）が最寄りの住宅地の地価の中央値を並べる（XPT001 は駅からの距離を返さない）
  const stationLandPrices = `
    CREATE OR REPLACE TABLE ${t("station_land_prices")} AS
    WITH ${stationTrades},
    target AS (
      SELECT IFNULL(MAX(IF(classification = '${OFFICIAL}', as_of, NULL)), MAX(as_of)) AS adjusted_to
      FROM ${t("land_price_points")}
    ),
    city_change AS (
      SELECT code, APPROX_QUANTILES(change_rate, 100)[SAFE_OFFSET(50)] AS rate
      FROM ${t("land_price_points")}
      WHERE use = '${RESIDENTIAL_USE}' AND change_rate IS NOT NULL
      GROUP BY code
    ),
    land_trades AS (
      SELECT
        longitude, latitude, period_start,
        LPAD(${prop("properties", "$.city_code")}, 5, '0') AS code,
        COALESCE(
          ${yen(prop("properties", "$.u_transaction_price_unit_price_square_meter_ja"))},
          SAFE_DIVIDE(
            (${manYen(prop("properties", "$.u_transaction_price_total_ja"))}) * 10000,
            ${leadingNumber(prop("properties", "$.u_area_ja"))})) AS unit_price
      FROM station_trades, station_latest
      WHERE land_type = '${LAND_TYPE}'
        AND period_start > DATE_SUB(station_latest.quarter, INTERVAL ${LAND_MONTHS} MONTH)
    ),
    adjusted AS (
      SELECT
        l.longitude, l.latitude, l.code, l.period_start,
        IF(target.adjusted_to IS NULL OR c.rate IS NULL, l.unit_price,
          l.unit_price * POW(1 + c.rate / 100,
            DATE_DIFF(target.adjusted_to, DATE_ADD(l.period_start, INTERVAL 45 DAY), DAY) / 365.25)) AS unit_price
      FROM land_trades AS l
      LEFT JOIN city_change AS c USING (code)
      CROSS JOIN target
      WHERE l.unit_price > 0
    ),
    points AS (
      SELECT
        longitude, latitude,
        ANY_VALUE(SUBSTR(code, 1, 2)) AS prefecture_code,
        ARRAY_AGG(DISTINCT code ORDER BY code) AS city_codes,
        COUNT(*) AS count,
        APPROX_QUANTILES(unit_price, 100) AS quantiles,
        MIN(period_start) AS from_date,
        MAX(period_start) AS to_date
      FROM adjusted GROUP BY longitude, latitude
    ),
    ${stationNames},
    -- 同じ駅が最寄りの住宅地の地価（距離別）。駅名は地価の地点の「最寄り駅」と駅（XKT015）の駅名で突き合わせる
    official_bands AS (
      SELECT prefecture_code, station_name,
        ARRAY_AGG(STRUCT(band, price, count) ORDER BY ${stationDistanceBandOrder("band")}) AS bands
      FROM (
        SELECT prefecture_code, station_name, band,
          ROUND(APPROX_QUANTILES(price, 100)[SAFE_OFFSET(50)]) AS price, COUNT(*) AS count
        FROM (
          SELECT prefecture_code, station_name, price, ${stationDistanceBand("station_distance_m")} AS band
          FROM ${t("land_price_points")}
          WHERE use = '${RESIDENTIAL_USE}' AND station_name IS NOT NULL AND station_distance_m IS NOT NULL
        ) GROUP BY prefecture_code, station_name, band
      ) GROUP BY prefecture_code, station_name
    )
    SELECT
      nearest.station.station_name,
      IFNULL(lines.line_names, []) AS line_names,
      points.longitude, points.latitude, points.prefecture_code, points.city_codes, points.count,
      ROUND(points.quantiles[SAFE_OFFSET(${FAIR_LOW})]) AS low,
      ROUND(points.quantiles[SAFE_OFFSET(50)]) AS median,
      ROUND(points.quantiles[SAFE_OFFSET(${FAIR_HIGH})]) AS high,
      FORMAT('%dQ%d', EXTRACT(YEAR FROM points.from_date), EXTRACT(QUARTER FROM points.from_date)) AS period_from,
      FORMAT('%dQ%d', EXTRACT(YEAR FROM points.to_date), EXTRACT(QUARTER FROM points.to_date)) AS period_to,
      target.adjusted_to,
      IFNULL(official_bands.bands, []) AS official_by_station_distance
    FROM points
    JOIN nearest USING (longitude, latitude)
    LEFT JOIN lines ON lines.group_code = nearest.station.group_code
    LEFT JOIN official_bands
      ON official_bands.prefecture_code = points.prefecture_code
      AND official_bands.station_name = nearest.station.station_name
    CROSS JOIN target`;

  // 指標ごとの元データの時点（仕様書「指標と基準時点」）。画面は数字の近くにこの時点を出す。
  // 取引は四半期の範囲（初日〜最後の四半期の末日）、地価は価格の時点、統計は年。
  const quarterRange = (key: string, source: string, months: number, latest: string) => `
      SELECT '${key}' AS key, '${source}' AS source,
        DATE_ADD(DATE_SUB(${latest}, INTERVAL ${months} MONTH), INTERVAL 3 MONTH) AS from_date,
        LAST_DAY(DATE_ADD(${latest}, INTERVAL 2 MONTH)) AS to_date, 'quarter' AS precision`;
  const statisticYear = (key: string, source: string, table: string) => `
      SELECT '${key}', '${source}', CAST(NULL AS DATE),
        SAFE.DATE(SAFE_CAST(SUBSTR(MAX(time_code), 1, 4) AS INT64), 1, 1), 'year'
      FROM ${t("raw_statistics")} WHERE table_name = '${table}'`;
  const dataPeriods = `
    CREATE OR REPLACE TABLE ${t("data_periods")} AS
    WITH latest AS (SELECT MAX(period_start) AS quarter FROM ${t("raw_transactions")}),
    ${stationTrades},
    station_land AS (
      SELECT MIN(period_start) AS from_date, MAX(period_start) AS to_date FROM station_trades, station_latest
      WHERE land_type = '${LAND_TYPE}' AND period_start > DATE_SUB(station_latest.quarter, INTERVAL ${LAND_MONTHS} MONTH)
    )
    SELECT * FROM (
      ${quarterRange("trade", "不動産情報ライブラリ（取引価格）", RECENT_MONTHS, "(SELECT quarter FROM latest)")}
      UNION ALL
      ${quarterRange("landTrade", "不動産情報ライブラリ（取引価格）", LAND_MONTHS, "(SELECT quarter FROM latest)")}
      UNION ALL
      ${quarterRange("stationTrade", "不動産情報ライブラリ（取引価格）", RECENT_MONTHS, "(SELECT quarter FROM station_latest)")}
      UNION ALL
      SELECT 'stationLandTrade', '不動産情報ライブラリ（取引価格）', from_date,
        LAST_DAY(DATE_ADD(to_date, INTERVAL 2 MONTH)), 'quarter'
      FROM station_land
      UNION ALL
      SELECT 'officialLandPrice', '地価公示', CAST(NULL AS DATE), MAX(as_of), 'day'
      FROM ${t("land_price_points")} WHERE classification = '${OFFICIAL}'
      UNION ALL
      SELECT 'prefectureLandPrice', '都道府県地価調査', CAST(NULL AS DATE), MAX(as_of), 'day'
      FROM ${t("land_price_points")} WHERE classification = '${PREFECTURE_SURVEY}'
      UNION ALL
      ${statisticYear("vacancy", "住宅・土地統計調査", "housing_vacancy")}
      UNION ALL
      ${statisticYear("rent", "住宅・土地統計調査", "private_rent_per_sqm")}
      UNION ALL
      ${statisticYear("population", "住民基本台帳人口", "resident_population")}
    )
    WHERE to_date IS NOT NULL`;

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
      landPricePoints,
      areaMetrics,
      areaDetails,
      districtLandPrices,
      stationMetrics,
      stationLandPrices,
      dataPeriods,
    ],
    exports: (bucket, exportId) =>
      [
        "area_metrics",
        "area_details",
        "district_land_prices",
        "land_price_points",
        "station_metrics",
        "station_land_prices",
        "data_periods",
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
