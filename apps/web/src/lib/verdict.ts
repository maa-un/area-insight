import type { AreaMetrics } from "@area-insight/shared";

// 市区町村ページの冒頭に出す一言の判定。数字を読む前に全体像が分かるようにする。
// 判定は都道府県内の順位（取引価格）と、人口の増減率・空き家率の水準で決める。

export type Tone = "good" | "neutral" | "bad";
export type VerdictTag = { label: string; tone: Tone };

export type Verdict = {
  sentence: string;
  tags: VerdictTag[];
};

type Rank = { rank: number; total: number } | undefined;

// 取引価格の都道府県内の位置（安い順）。下位 1/3 を「安い部類」、上位 1/3 を「高い部類」とする。
function priceTag(rank: Rank): { text: string; tag: VerdictTag } | null {
  if (!rank || rank.total < 3) return null;
  const position = rank.rank / rank.total;
  if (position <= 1 / 3) {
    return { text: "取引価格は安い部類", tag: { label: "価格 安い部類", tone: "good" } };
  }
  if (position > 2 / 3) {
    return { text: "取引価格は高い部類", tag: { label: "価格 高い部類", tone: "bad" } };
  }
  return { text: "取引価格は中ほど", tag: { label: "価格 中ほど", tone: "neutral" } };
}

function populationTag(rate: number | null): { text: string; tag: VerdictTag } | null {
  if (rate === null) return null;
  if (rate >= 0) return { text: "人口は増えている", tag: { label: "人口 増加", tone: "good" } };
  if (rate > -3) return { text: "人口は微減", tag: { label: "人口 微減", tone: "neutral" } };
  return { text: "人口は減っている", tag: { label: "人口 減少", tone: "bad" } };
}

function vacancyTag(rate: number | null): { text: string; tag: VerdictTag } | null {
  if (rate === null) return null;
  // 全国の空き家率は 13.8%（2023 年住宅・土地統計調査）。20% を超えると空き家が目立つ水準
  if (rate >= 20) return { text: "空き家が多い", tag: { label: "空き家 多い", tone: "bad" } };
  if (rate < 12) return { text: "空き家は少なめ", tag: { label: "空き家 少なめ", tone: "good" } };
  return { text: "空き家率は全国並み", tag: { label: "空き家 全国並み", tone: "neutral" } };
}

export function areaVerdict(
  area: AreaMetrics,
  prefecture: string,
  priceRank: Rank,
): Verdict | null {
  const parts = [
    priceTag(priceRank),
    populationTag(area.populationChangeRate),
    vacancyTag(area.vacancyRate),
  ].filter((p): p is NonNullable<typeof p> => p !== null);
  if (parts.length === 0) return null;

  const [first, ...rest] = parts;
  const head = first ? `${prefecture}内で${first.text}` : "";
  const tail = rest.map((p) => p.text).join("、");
  const sentence = `${head}${tail ? `。${tail}` : ""}。`;
  return { sentence, tags: parts.map((p) => p.tag) };
}
