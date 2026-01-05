# sheet-to-slack

Google スプレッドシートの内容を Slack に通知する Google Apps Script プロジェクトのローカル開発リポジトリです。

## 構成
```
sheet-to-slack/
├── src/                 # clasp の rootDir
│   ├── Code.js          # エントリポイント
│   └── appsscript.json  # GAS マニフェスト
├── .clasp.json.example  # Script ID を入れる雛形
├── package.json         # clasp 用 npm スクリプト
└── .gitignore
```

## セットアップ
1. `npm install -g @google/clasp`（未導入なら）
2. `clasp login`
3. `.clasp.json.example` を `.clasp.json` にコピーし、`scriptId` を実プロジェクト ID に置き換える。
   ```bash
   cp .clasp.json.example .clasp.json
   # scriptId を編集
   ```
4. `npm run pull` で既存のスクリプトを取得、または `npm run create` で新規作成。

### Webhook 設定
- Script Properties に `SLACK_WEBHOOK_URL` を設定してください（単一ワークスペース前提）。
- 通知シート名は `NOTIFICATION_SHEETS` で指定（カンマ区切り複数可、未設定/空はエラー）。

## 日常コマンド
- `npm run deploy` : GAS へ push
- `npm run pull`   : GAS から pull
- `npm run open`   : スクリプトエディタを開く
- `npm run logs`   : 実行ログ閲覧

## ドキュメント
- 現状仕様と運用ルール: `docs/CURRENT_SPEC.md`
- UI/運用改善の提案: `docs/UI_IMPROVEMENT_PROPOSALS.md`

### バックアップからの差し戻し手順（backups/ にコピーがある場合）
- 前提: `backups/…` に以前の Apps Script ファイル群が保存されている（git 管理外）。
- 手順:
  1. 作業ツリーがクリーンか確認: `git status`
  2. `backups/<バックアップ名>` から `src/` へ上書きコピー（`appsscript.json` も必要なら同様に）  
     例) `cp backups/1W66...203402/*.js src/`  
         `cp backups/1W66...203402/appsscript.json src/`
  3. 差分確認: `git status -sb` / `git diff`
  4. GAS へ反映: `npm run deploy`（= `clasp push`）
  5. 必要ならコミット: `git add src appsscript.json && git commit -m "バックアップから復元"`

## 開発メモ
- `src` 配下のみを同期対象にしています (`rootDir`=src)。
- 認証情報 (`.clasp.json`, `.clasprc.json`) は git から除外しています。
- 実装や設計は `furi-9-monitor` の構成を参考に進めてください。
