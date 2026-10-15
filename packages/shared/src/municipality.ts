import { z } from "zod";

// 全国地方公共団体コード（市区町村）。検査数字を除いた 5 桁で扱う。
export const MunicipalityCode = z.string().regex(/^\d{5}$/);
export type MunicipalityCode = z.infer<typeof MunicipalityCode>;

// 都道府県コード（2 桁）。
export const PrefectureCode = z.string().regex(/^(0[1-9]|[1-3]\d|4[0-7])$/);
export type PrefectureCode = z.infer<typeof PrefectureCode>;

export const PREFECTURE_CODES: readonly PrefectureCode[] = Array.from({ length: 47 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);

export const Municipality = z.object({
  code: MunicipalityCode,
  prefectureCode: PrefectureCode,
  name: z.string().min(1),
});
export type Municipality = z.infer<typeof Municipality>;
