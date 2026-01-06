# sheet-to-slack

Google スプレッドシートの内容を Slack に通知する Google Apps Script プロジェクトのローカル開発リポジトリです。

## 何ができるか
- スプレッドシートの複数シート（カンマ区切り指定）を走査し、条件に合致した行を Slack に送信。
- 日付指定／曜日指定に対応。土日祝をスキップするフラグあり（祝日は Google日本祝日カレンダーで判定）。
- 宛先は `here`/`channel`/ユーザー名/ユーザーIDをカンマ区切りで指定可能。
- 通知失敗時は管理者メール（任意）と、登録者欄があれば登録者へのDMを試行。

## 構成
```
sheet-to-slack/
├── src/                 # clasp の rootDir
│   ├── Code.js          # エントリポイント
│   └── appsscript.json  # GAS マニフェスト
├── docs/                # 仕様・改善提案
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
4. Script Properties を設定  
   - `SLACK_WEBHOOK_URL` : 必須（単一ワークスペース前提）
   - `NOTIFICATION_SHEETS` : 必須。通知シート名をカンマ区切りで列挙（例: `通知設定,営業部`）
   - `SLACK_USERNAME` : 必須。Slackに表示する送信者名
   - `SLACK_ICON_EMOJI` : 必須。Slackに表示するアイコン絵文字（例: `:bell:` のような絵文字名）
   - `BOT_MASTER` : 管理者メールアドレス（任意、エラー通知用）
   - `ERROR_MAIL_ENABLED` : エラーメール送信可否（true/false）
   - `DEBUG_DATE` : デバッグ実行日時（任意。未設定なら現在日時）
5. `npm run pull` で既存のスクリプトを取得、または `npm run create` で新規作成。

## 使い方（シート）
- 列構成や判定ルールは `docs/CURRENT_SPEC.md` を参照。列名は「宛先」「登録者」に変更済み。
- シート名は `NOTIFICATION_SHEETS` で指定したもののみ処理。未設定や存在しない場合はエラーで停止。

## 日常コマンド
- `npm run deploy` : GAS へ push
- `npm run pull`   : GAS から pull
- `npm run open`   : スクリプトエディタを開く
- `npm run logs`   : 実行ログ閲覧

## ドキュメント
- 現状仕様と運用ルール: `docs/CURRENT_SPEC.md`
- UI/運用改善の提案: `docs/UI_IMPROVEMENT_PROPOSALS.md`
- かんたん入力ガイド（非エンジニア向け）: `docs/USER_GUIDE.md`

## バックアップからの差し戻し（backups/ にコピーがある場合）
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
