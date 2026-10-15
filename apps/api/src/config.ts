import { z } from "zod";

// 環境変数は Cloud Run（Terraform）から渡す。Webhook の署名鍵は Secret Manager から注入される。
const Env = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  // Clerk の Frontend API の URL（例: https://xxx.clerk.accounts.dev）。トークンの iss と一致する。
  CLERK_ISSUER: z.url(),
  // トークンの azp として受け付けるオリジン（カンマ区切り）。画面の URL を指定する。
  CLERK_AUTHORIZED_PARTIES: z
    .string()
    .min(1)
    .transform((value) => value.split(",").map((origin) => origin.trim())),
  CLERK_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
});
export type Config = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    // 値そのものは出さず、問題のある変数名だけを示す。
    const names = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`invalid environment variables: ${names}`);
  }
  return parsed.data;
}
