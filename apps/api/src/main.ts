import { createServer } from "node:http";
import { Firestore } from "@google-cloud/firestore";
import { ClerkTokenVerifier } from "./adapters/clerk/token-verifier.js";
import { ClerkWebhook } from "./adapters/clerk/webhook.js";
import { FirestorePreferencesRepository } from "./adapters/firestore/firestore-preferences-repository.js";
import { createHandler } from "./adapters/http/server.js";
import { PreferencesService } from "./application/preferences-service.js";
import { loadConfig } from "./config.js";

// 組み立て（コンポジションルート）。どの実装を使うかを決めるのはここだけにする。
const config = loadConfig();

const handler = createHandler({
  tokens: new ClerkTokenVerifier(config.CLERK_ISSUER, config.CLERK_AUTHORIZED_PARTIES),
  webhook: new ClerkWebhook(config.CLERK_WEBHOOK_SECRET),
  // Cloud Run ではプロジェクトと認証情報を実行環境から自動で取得する。
  preferences: new PreferencesService(new FirestorePreferencesRepository(new Firestore())),
});

const server = createServer((req, res) => {
  void handler(req, res);
});

server.listen(config.PORT, () => {
  console.log(JSON.stringify({ message: "listening", port: config.PORT }));
});

// Cloud Run はインスタンスを止める前に SIGTERM を送る。処理中のリクエストを終えてから終了する。
process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
