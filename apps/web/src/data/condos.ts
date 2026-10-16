import { CondoFile } from "@area-insight/shared";
import { SAMPLE_CONDO_PREFECTURES, sampleCondos } from "./sample";

// マンションの成約事例（都道府県ごとのファイル）。件数が多いため画面の JavaScript には含めず、
// ハッシュ付きのファイルとして出力して、成約事例のページで選んだ都道府県の分だけを取りに行く。
// 集計ジョブの書き出しが無ければサンプル（src/data/sample.ts）を使う。
const urls = import.meta.glob<string>("./generated/condos/*.json", {
  eager: true,
  query: "?url",
  import: "default",
});

const urlOf = new Map(
  Object.entries(urls).map(([path, url]) => [/(\d{2})\.json$/.exec(path)?.[1] ?? "", url]),
);
const hasGenerated = urlOf.size > 0;

// 成約事例のある都道府県（コードの順）。サンプルのときはサンプルを置いた都道府県
export const condoPrefectures: string[] = hasGenerated
  ? [...urlOf.keys()].sort()
  : SAMPLE_CONDO_PREFECTURES;

export async function loadCondos(prefectureCode: string): Promise<CondoFile | null> {
  if (!hasGenerated) return sampleCondos(prefectureCode) ?? null;
  const url = urlOf.get(prefectureCode);
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`成約事例のファイルを取得できませんでした（HTTP ${response.status}）`);
  }
  // 外から来るデータとして検証する
  return CondoFile.parse(await response.json());
}
