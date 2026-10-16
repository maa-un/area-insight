import type { Quarter } from "./quarters.js";

// ジョブが外の仕組みに求めること（ポート）。取得元と保存先を差し替えられるよう、ジョブはここにだけ依存する。
// 実装は adapters/（不動産情報ライブラリ、e-Stat、BigQuery、タイル一覧）に置き、main.ts で組み立てる。

// 市区町村一覧の 1 件。
export type MunicipalityRecord = { readonly code: string; readonly name: string };

// 取引 1 件。仕様どおり加工せずに保存するため、取得元が返した項目と文字列の値をそのまま持つ。
export type TransactionRecord = Readonly<Record<string, string | undefined>>;

// 地図タイルの番号（XYZ 方式）。
export type Tile = { readonly z: number; readonly x: number; readonly y: number };

// 位置付きの 1 件（地価の地点、駅ごとの取引）。属性は取得元の形のまま持ち、解釈は集計で行う。
export type PointRecord = {
  readonly coordinates: readonly [number, number]; // 経度・緯度
  readonly properties: Readonly<Record<string, unknown>>;
};

// 駅 1 件（XKT015、元は国土数値情報 S12）。駅はホームの区間を表す線で返る。
// 形と属性は取得元のまま持ち、XPT001 の点との突き合わせは集計で行う。
export type StationRecord = {
  readonly geometry: Readonly<Record<string, unknown>>; // GeoJSON の geometry（LineString など）
  readonly properties: Readonly<Record<string, unknown>>;
};

// 統計値 1 件（e-Stat）。値は「-」や「***」などの記号も含めて文字列のまま持つ。
export type StatisticRecord = {
  readonly areaCode: string;
  readonly categories: Readonly<Record<string, string>>; // cat01 などの分類と、そのコード
  readonly time: string;
  readonly value: string;
  readonly unit: string | null;
};

// 取得する統計表と絞り込み条件。
export type StatisticsTable = {
  readonly id: string; // statsDataId
  readonly name: string; // 集計で参照する名前
  readonly filters: Readonly<Record<string, string>>; // cdCat01 など
};

// 不動産情報ライブラリ。データが無い範囲は空の配列を返し、それ以外の失敗は例外にする。
export interface PublicDataSource {
  municipalities(prefectureCode: string): Promise<MunicipalityRecord[]>;
  transactions(prefectureCode: string, quarter: Quarter): Promise<TransactionRecord[]>;
  // XPT002: 地価公示（priceClassification 0）または地価調査（1）の、指定年の地点
  landPrices(tile: Tile, year: number, classification: "0" | "1"): Promise<PointRecord[]>;
  // XPT001: 最寄り駅の位置に置かれた「土地」と「土地と建物」の取引
  stationTransactions(tile: Tile, from: Quarter, to: Quarter): Promise<PointRecord[]>;
  // XKT015: 駅の位置・駅名・路線名（駅別乗降客数）
  stations(tile: Tile): Promise<StationRecord[]>;
}

// 政府統計（e-Stat）。
export interface StatisticsSource {
  values(table: StatisticsTable): Promise<StatisticRecord[]>;
}

// 取得するタイルの一覧。陸地を含むタイルだけに絞り、リクエスト数を抑える。
export interface TileCatalog {
  tiles(zoom: number): Promise<Tile[]>;
}

// 取得したデータの保存先。同じ範囲を丸ごと置き換え、何度実行しても結果が同じになるようにする。
export interface RawDataStore {
  replaceMunicipalities(
    rows: readonly { prefectureCode: string; record: MunicipalityRecord }[],
    fetchedAt: Date,
  ): Promise<void>;
  replaceTransactions(
    quarter: Quarter,
    rows: readonly { prefectureCode: string; record: TransactionRecord }[],
    fetchedAt: Date,
  ): Promise<void>;
  // 指定した年の地価（地価公示と地価調査）を置き換える。
  replaceLandPrices(
    year: number,
    rows: readonly { classification: "0" | "1"; record: PointRecord }[],
    fetchedAt: Date,
  ): Promise<void>;
  // 駅ごとの取引は直近の期間だけを使うため、全体を置き換える。
  replaceStationTransactions(
    period: { from: Quarter; to: Quarter },
    rows: readonly PointRecord[],
    fetchedAt: Date,
  ): Promise<void>;
  // 駅は年に 1 度更新される全国のデータのため、全体を置き換える。
  replaceStations(rows: readonly StationRecord[], fetchedAt: Date): Promise<void>;
  // 統計は対象の表をまとめて取り直し、全体を置き換える。
  replaceStatistics(
    rows: readonly { table: StatisticsTable; record: StatisticRecord }[],
    fetchedAt: Date,
  ): Promise<void>;
}

// 集計の置き場（BigQuery）。生データから指標を作り直し、画面向けのファイルを書き出す。
export interface MetricsWarehouse {
  rebuildMetrics(): Promise<void>;
  // 今回の書き出しを見分ける印（exportId）を付けて書き出す。画面のビルドは最新の印の行だけを使う。
  exportForWeb(exportId: string): Promise<void>;
}
