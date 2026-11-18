# みまもり安否連携 — 高齢者見守り・災害時安否確認連携システム（デモ）

外部見守り端末 ⇔ Webシステム ⇔ LINE ⇔ 安否データ ⇔ 外部プラットフォーム の連携全体を、
**モックAPIとシミュレーション**で操作的に再現する提案用デモです。外部サービスへの実通信は一切行いません。
対象者・住所・電話番号などのデータはすべて架空です。

## 起動

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 型チェック + 本番ビルド
```

## デモの見どころ

| 操作 | 内容 |
|---|---|
| 上部「災害発生シミュレーション」 | 緊急モード開始 → 端末/LINE送信 → 一部成功・一部失敗 → LINE回答 → 端末回答 → 重複検知 → 先着採用 → 未回答抽出 → 外部PF送信 を自動実行（1x/2x/4x） |
| 「緊急モード送信」 | 対象者 → 地域 → 人数確認 → 送信確認 → 送信状況（送信済み/送信中/送信失敗をリアルタイム表示、再送信可） |
| 安否確認 > 重複回答 | 「採用回答（先着）」と「追加回答（追記）」を並べて表示。内容不一致は要確認に分類 |
| LINE連携 | LINE画面を模したクイックリプライから回答を受信（Webhookのモック） |
| 見守り端末 > 詳細 | 端末ボタン押下・不正データ送信・疎通確認をシミュレーション |
| 設定 | タイムアウト率・外部PF失敗率・遅延倍率を変更してエラー処理を確認 |
| ヘッダー TEST / PRODUCTION | 本番切替は確認チェック必須。本番中は赤枠と警告バナーを表示 |

## 構成

```
src/
  types/        データモデル（User, Device, SafetyResponse, LineResponse, DeviceResponse,
                Notification, ApiLog, PlatformSync, EmergencyEvent ほか）
  domain/       UIに依存しない業務ロジック
                  safety.ts      先着採用ルール（mergeResponse）・状態判定
                  validation.ts  端末/LINE Webhook の検証（不正データ検知）
                  stats.ts       集計（回答率・時間別・地域別）
  services/     API層（ここだけを差し替えれば実APIへ移行可能）
                  apiClient.ts   共通窓口（環境切替・計測・エラー正規化）
                  transport.ts   Transport インターフェース
                  mock/          ブラウザ内モックAPI・Webhook生成
                  gasTransport.ts Google Apps Script 経由の実装（VITE_DATA_SOURCE=gas）
                  deviceApi.ts / lineApi.ts / safetyApi.ts / platformApi.ts
  workflows/    業務フローのオーケストレーション（緊急送信・回答受信・外部PF送信・シミュレーション）
  store/        zustand ストア（状態と純粋な更新のみ）
  hooks/ components/ pages/ layouts/ data/ utils/
```

### 重複回答の処理ルール（`src/domain/safety.ts`）

1. 先に届いた回答を正式な安否回答として採用（`isPrimary: true`）
2. 後から届いた回答は `additionalResponses` に追記
3. 元データは削除しない／回答経路と時刻を保持
4. 内容が異なる場合は `conflicts: true` とし「回答不一致（要確認）」に分類
5. 同一IDの再送は冪等に無視

### 実API・GASへの移行

- `.env.example` を `.env.local` にコピーし、`VITE_DATA_SOURCE=gas` と各URLを設定
- GAS 側は `doPost(e)` で `{ service, method, path, body }` を受け取り、スプレッドシートへの保存・外部APIの呼び出しを行う
- **APIキーはフロントエンドに置かず**、GAS のスクリプトプロパティ等で保持（画面・ログでは常にマスク表示）

## セキュリティ上の配慮

- 秘密情報は環境変数・サーバー側で管理し、画面・ログ・CSV出力では `************` でマスク
- 住所・電話番号は既定でマスクし、「表示」操作を監査ログに記録
- 外部プラットフォームへは氏名・住所を送信しない（ID・地区・状態・経路・時刻のみ）
- 本番環境への切替・本番送信は確認チェックを必須化
