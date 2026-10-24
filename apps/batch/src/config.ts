import { z } from "zod";

// 環境変数は GitHub Actions から渡す。API キーとアプリケーション ID は Secret Manager から取得する。
// 使うキーはジョブごとに違うため、キーは任意にして、使うジョブで requireSecret を呼ぶ。
const Env = z.object({
  GCP_PROJECT_ID: z.string().min(1),
  BIGQUERY_DATASET: z.string().min(1),
  REINFOLIB_API_KEY: z.string().min(1).optional(),
  ESTAT_APP_ID: z.string().min(1).optional(),
  // 集計ジョブが画面向けのファイルを書き出すバケット
  DATA_BUCKET: z.string().min(1).optional(),
  // 公的 API はレート制限の数値を公開していないため、控えめな間隔で呼ぶ。
  REQUEST_INTERVAL_MS: z.coerce.number().int().min(0).default(1000),
});
export type Config = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    // 値そのものは出さず、足りない変数名だけを示す。
    const names = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`invalid environment variables: ${names}`);
  }
  return parsed.data;
}

export function requireSecret(
  config: Config,
  name: "REINFOLIB_API_KEY" | "ESTAT_APP_ID" | "DATA_BUCKET",
): string {
  const value = config[name];
  if (!value) throw new Error(`missing environment variable: ${name}`);
  return value;
}
