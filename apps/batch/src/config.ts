import { z } from "zod";

// 環境変数は Cloud Run Jobs（Terraform）から渡す。API キーは Secret Manager から注入される。
const Env = z.object({
  GCP_PROJECT_ID: z.string().min(1),
  BIGQUERY_DATASET: z.string().min(1),
  REINFOLIB_API_KEY: z.string().min(1),
  // 不動産情報ライブラリはレート制限の数値を公開していないため、控えめな間隔で呼ぶ。
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
