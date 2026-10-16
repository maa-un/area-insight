import type { Quarter } from "./quarters.js";

// ジョブが外の仕組みに求めること（ポート）。取得元と保存先を差し替えられるよう、ジョブはここにだけ依存する。
// 実装は adapters/（不動産情報ライブラリ、BigQuery）に置き、main.ts で組み立てる。

// 市区町村一覧の 1 件。
export type MunicipalityRecord = { readonly code: string; readonly name: string };

// 取引 1 件。仕様どおり加工せずに保存するため、取得元が返した項目と文字列の値をそのまま持つ。
export type TransactionRecord = Readonly<Record<string, string | undefined>>;

// 公的データの取得元。データが無い範囲は空の配列を返し、それ以外の失敗は例外にする。
export interface PublicDataSource {
  municipalities(prefectureCode: string): Promise<MunicipalityRecord[]>;
  transactions(prefectureCode: string, quarter: Quarter): Promise<TransactionRecord[]>;
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
}
