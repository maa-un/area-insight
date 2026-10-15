import { createServer } from "node:http";
import { Firestore } from "@google-cloud/firestore";
import { clerkTokenVerifier } from "./auth.js";
import { loadConfig } from "./config.js";
import { createHandler } from "./server.js";
import { FirestoreUserStore } from "./store.js";
import { verifyClerkWebhook } from "./webhook.js";

const config = loadConfig();

const handler = createHandler({
  verifyToken: clerkTokenVerifier(config.CLERK_ISSUER, config.CLERK_AUTHORIZED_PARTIES),
  verifyWebhook: (headers, body) => verifyClerkWebhook(config.CLERK_WEBHOOK_SECRET, headers, body),
  // Cloud Run ではプロジェクトと認証情報を実行環境から自動で取得する。
  store: new FirestoreUserStore(new Firestore()),
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
