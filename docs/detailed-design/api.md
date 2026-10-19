# 詳細設計: 保存 API（apps/api）

流れは [シーケンス図 §3・§4](../sequence-diagrams.md#3-ログインと保存)、データは [ER 図 §4](../er-diagram.md#4-firestore)。

## 1. 層

| 層 | 場所 | 中身 |
|---|---|---|
| domain | `src/domain` | 集約 `UserPreferences`、値オブジェクト、リポジトリのポート、`DomainError` |
| application | `src/application` | `PreferencesService`、`TokenVerifier`・`AccountEvent` のポート |
| adapters | `src/adapters` | HTTP（`node:http`）、Firestore、Clerk、メモリ実装（テスト用） |
| 組み立て | `src/main.ts` | 実装を選ぶ唯一の場所。SIGTERM で処理中を終えてから止まる |

## 2. エンドポイント

同じドメインの `/api/` で受ける（LB 経由のみ）。CORS は無い。

| メソッド | パス | 認証 | 本文 | 成功 |
|---|---|---|---|---|
| 任意 | `/healthz` | — | — | 200 `{status:"ok"}` |
| GET | `/api/me` | Bearer | — | 200 `UserData` |
| PUT | `/api/me/favorites` | Bearer | `{favorites: string[]}` | 200 `UserData` |
| PUT | `/api/me/compare` | Bearer | `{compare: string[]}` | 200 `UserData` |
| PUT | `/api/me/filters` | Bearer | `{filters: SavedFilter[]}` | 200 `UserData` |
| POST | `/api/webhooks/clerk` | svix 署名 | Clerk のイベント | 204 |

- `UserData` = `{favorites, compare, filters}`。PUT はそのリストを**丸ごと置き換え**、3 つ全部を返す
- 応答に `cache-control: no-store`

## 3. エラー

本文は `{error: "<メッセージ>"}`。

| ステータス | いつ |
|---|---|
| 400 | JSON が壊れている / zod 検証に失敗 / 業務ルール違反（`DomainError` のメッセージ） / Webhook のイベントの形が不正 |
| 401 | Bearer が無い / トークンが不正 / Webhook の署名が不正 |
| 404 | パスが無い |
| 405 | メソッドが違う |
| 413 | 本文が 64KiB 超 |
| 429 | Cloud Armor のレート制限（120 回/分/IP、API の外で返す） |
| 500 | それ以外（このときだけエラーログを出す） |

## 4. 業務ルール（UserPreferences）

| 操作 | ルール | 違反時 |
|---|---|---|
| お気に入りの置き換え | 重複を除く（最初の順を保つ）。各要素は 5 桁のコード。**200 件まで** | `favorites are limited to 200` |
| 比較リストの置き換え | 重複を除く。**3 件まで** | `compare is limited to 3` |
| 条件の置き換え | **20 件まで**。名前の重複は不可 | `filters are limited to 20` / `filter names must be unique` |
| 保存済みの復元 | 名前が重複した条件は先のものを残して除く | — |

- 集約は不変。置き換えると新しいインスタンスを返す
- 違反したら保存しない
- 上限の検査は二段: zod は重複込みの件数、ドメインは重複を除いた件数
- 上限の数は `packages/shared/src/user-data.ts` の定数（画面と共通）

`SavedFilter`: `name` 1〜50 文字、`conditions` はキー 50 文字以下・値は 200 文字以下の文字列 / 数値 / 真偽値。

## 5. 認証

| 手順 | 内容 |
|---|---|
| 1 | `Authorization: Bearer <Clerk のセッション JWT>` を取り出す |
| 2 | `{CLERK_ISSUER}/.well-known/jwks.json` で署名を検証（JWKS はキャッシュ） |
| 3 | `iss` = `CLERK_ISSUER`、`azp` ∈ `CLERK_AUTHORIZED_PARTIES` |
| 4 | `sub` を利用者 ID にする。本人のドキュメントだけ読み書きする |

## 6. Webhook

| 手順 | 内容 |
|---|---|
| 署名 | `svix-id`・`svix-timestamp`・`svix-signature` が必要。時刻は ±5 分以内 |
| 計算 | HMAC-SHA256(`id.timestamp.本文`)、鍵は `whsec_` を除いて base64 デコード。複数の署名のどれかが一致すれば可 |
| `user.deleted` | その利用者のドキュメントを削除 |
| それ以外 | 何もしない（204） |

## 7. 保存先（Firestore）

| 項目 | 値 |
|---|---|
| DB | `(default)` |
| パス | `area-insight-users/{Clerk のユーザー ID}` |
| 読み | 無ければ空。読んだ値も zod で検証（不正なら 500） |
| 書き | `set` で全体を上書き、`updatedAt` を付ける |
| 競合 | 制御しない（後に書いた方が残る） |

## 8. 設定

| 環境変数 | 内容 |
|---|---|
| `PORT` | 既定 8080 |
| `CLERK_ISSUER` | Clerk の Frontend API の URL |
| `CLERK_AUTHORIZED_PARTIES` | 受け付ける画面のオリジン（カンマ区切り） |
| `CLERK_WEBHOOK_SECRET` | `whsec_` で始まる。Secret Manager から |

検証エラーは変数名だけを出して起動を止める。

## 9. ログ

1 リクエスト 1 行の JSON `{method, path, status, ms}`。ユーザー ID・本文は出さない。
