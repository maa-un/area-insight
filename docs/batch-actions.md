# GitHub Actions のバッチ

`batch.yml` が標準の `ubuntu-latest` ランナーで取得・集計を実行する。保存 API とデータ基盤は Google Cloud に残す。公開リポジトリの標準ランナーは実行時間が無料。BigQuery・GCS 等の利用料は別途発生する。

## 実行

| 種類 | 日本時間 | 取得 |
|---|---|---|
| monthly | 毎月3日04:00 | municipalities、transactions、station-transactions、condo-transactions |
| land-prices | 4月10日04:00 | land-prices |
| annual | 10月10日04:00 | statistics、projections、stations、land-prices |

手動では各ジョブ、上記の組み合わせ、全取得 `all` を選べる。地価の対象年は省略すると今年。取得に成功すると `aggregate`、再利用ワークフローの `web.yml` の順で実行し、サイトを更新する。`aggregate` だけの手動実行も可能。

バッチは main でのみ実行する。全更新で共通の concurrency を使い、別の更新と重ならないようにする。取得ジョブは matrix の `max-parallel: 1` で順に動かし、公的 API の間隔（既定1秒）を守る。ジョブ間の順序には依存しない。全取得が成功した後にだけ集計する。

GitHub の schedule は遅延することがあり、時刻は保証されない。公開リポジトリで60日間活動がない場合は定期実行が無効になるため、Actions の有効状態を確認する。

## 6時間制限と地価

GitHub 標準ランナーは1ジョブ最大6時間。取得・集計はそれぞれ別のジョブとし、上限を350分に設定する。

地価は取得開始時に既知の地点があるタイル一覧を GCS に保存し、その同じスナップショットを8分割する。各ジョブは両分類の raw を NDJSON に書き、取得がすべて終わった場合だけ `gs://<DATA_BUCKET>/batch-staging/<run-id>/<part>.ndjson` にアップロードする。API の取得失敗時はアップロードしない。

8ジョブがすべて成功すると、8ファイルを明示した1回の BigQuery ロードジョブで対象年のパーティションを `WRITE_TRUNCATE` する。ワイルドカードは使わず、ファイル欠落をエラーにする。途中失敗時には本番テーブルを変更しない。他の年のデータも残す。ファイルの値は従来と同じ raw のままで、集計は BigQuery で行う。

従来と同じく既定では既知地点のあるタイルだけ取得する。初回で既知地点が無い場合や手動で `all-tiles=true` を選んだ場合は全国を取得する。新しい地点を拾うため、数年に1回は全国を取り直す。分割は並列化せず、公的 API への負荷を増やさない。失敗ジョブの再実行は同じ run-id のファイルを上書きする。別 run-id のファイルは混ぜない。

中間ファイルはデータ用バケットのライフサイクルで7日後に削除する。7日以上経過した実行は失敗ジョブだけでなくワークフロー全体を新規実行する。

## Actions variables

既存の deploy 用 variables に加えて以下を設定する。API キーの値は登録せず、既存の Secret Manager から取得する。

| Variable | 内容 |
|---|---|
| `BATCH_ACTIONS_ENABLED` | `true` で実行有効。移行中は未設定にする |
| `GCP_BATCH_SERVICE_ACCOUNT` | 既存 batch SA のメールアドレス |
| `BIGQUERY_DATASET` | raw・集計のデータセット ID |
| `REINFOLIB_SECRET_ID` | 不動産情報ライブラリの Secret ID |
| `ESTAT_SECRET_ID` | e-Stat の Secret ID |

認証は Workload Identity Federation。batch SA の BigQuery dataEditor・jobUser、データ用バケット objectAdmin、既存2 Secret の secretAccessor を使う。deploy SA にはデータの書き込み権限を付けない。PR と fork からは本番バッチを実行しない。認証ファイル・秘密値・raw を Actions artifacts に残さない。

## 移行順序

1. maaun-terraform の platform に batch SA の WIF 権限と `batch-staging/` だけを対象にした7日保持を追加し、plan を確認して適用する。
2. app 側で旧 Cloud Scheduler を一時停止する。Cloud Run Jobs と Workflows はこの時点では残す。実行中の旧バッチがあれば完了を待つ。
3. このリポジトリの変更を main にマージし、上記 variables と `BATCH_ACTIONS_ENABLED=true` を設定する。
4. Actions を手動実行し、取得・ロード・集計・画面更新の成功と出力の件数・対象年・表示を確認する。確認が済むまでは旧リソースを destroy しない。
5. maaun-terraform の app ルートから旧 Cloud Run Jobs、Workflows、Scheduler とそれだけに必要な IAM、変数・出力・テンプレートを外す。plan が旧バッチだけの削除であることを確認して適用し、実リソースを destroy する。`modules/` は残す。
6. platform 側の旧 Workflows SA・通知専用 Secret・バッチの Artifact Registry も不要なら、参照を外した後に別 plan で撤去する。batch SA・APIキー・BigQuery・データ用バケットは Actions で引き続き使う。保存 API・配信・Firestore は残す。

削除のためにルート全体へ `terraform destroy` は実行しない。ルート構成から対象リソースを外し、通常の apply で該当リソースだけ destroy する。
