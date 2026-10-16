// 一覧のページ送り。長い一覧を一度に描かず、決まった件数ずつ見せる。

export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}

// 範囲外のページ番号（URL の手入力、絞り込みで件数が減ったときなど）は端に寄せる。
export function clampPage(page: number, total: number, perPage: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.trunc(page)), pageCount(total, perPage));
}

export function pageSlice<T>(items: readonly T[], page: number, perPage: number): T[] {
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}

// ページ番号の並び。先頭・末尾・今のページの前後だけを出し、間は省略（"gap"）にする。
export function pageItems(current: number, count: number): (number | "gap")[] {
  const pages = new Set([1, count, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  for (const page of sorted) {
    const last = items.at(-1);
    if (typeof last === "number" && page - last === 2) items.push(last + 1);
    else if (typeof last === "number" && page - last > 2) items.push("gap");
    items.push(page);
  }
  return items;
}
