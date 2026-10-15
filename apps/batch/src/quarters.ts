// 取引価格は四半期単位で公表される。四半期は年と 1〜4 の番号で表す。
export type Quarter = { year: number; quarter: 1 | 2 | 3 | 4 };

export function quarterOf(date: Date): Quarter {
  return {
    year: date.getUTCFullYear(),
    quarter: (Math.floor(date.getUTCMonth() / 3) + 1) as Quarter["quarter"],
  };
}

export function previousQuarter({ year, quarter }: Quarter): Quarter {
  return quarter === 1
    ? { year: year - 1, quarter: 4 }
    : { year, quarter: (quarter - 1) as Quarter["quarter"] };
}

// 公表が追いつく前の当四半期は含めず、直前の四半期から count 個さかのぼる（新しい順）。
export function recentQuarters(now: Date, count: number): Quarter[] {
  const quarters: Quarter[] = [];
  let current = previousQuarter(quarterOf(now));
  for (let i = 0; i < count; i++) {
    quarters.push(current);
    current = previousQuarter(current);
  }
  return quarters;
}

// BigQuery のパーティション列に入れる四半期の初日（YYYY-MM-DD）。
export function quarterStartDate({ year, quarter }: Quarter): string {
  return `${year}-${String((quarter - 1) * 3 + 1).padStart(2, "0")}-01`;
}

export function parseQuarter(text: string): Quarter {
  const match = /^(\d{4})Q([1-4])$/.exec(text);
  if (!match) throw new Error(`quarter must look like 2025Q2: ${text}`);
  return { year: Number(match[1]), quarter: Number(match[2]) as Quarter["quarter"] };
}
