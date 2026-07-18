// GASトリガーから直接呼ばれるエントリポイントを担当する。
function Main() {
  withScriptLock('Main', Action);
}

// 補助エントリ（小文字）も用意
function main() {
  Main();
}

function Action() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const config = Config.create();
  const notificationSheetNames = getNotificationSheetNames();
  const now = new Date(config.debugDate);
  const slackNotifier = new SlackNotifier(config.webhookUrl, config.slackUsername, config.slackIconEmoji);
  logInfo('通知処理開始');

  notificationSheetNames.forEach(function (sheetName) {
    const notificationSheet = spreadsheet.getSheetByName(sheetName);
    if (!notificationSheet) {
      throw new Error(`通知シートが見つかりません: ${sheetName}`);
    }
    const rows = notificationSheet.getDataRange().getValues();
    processNotificationRows(rows, now, slackNotifier, config, sheetName);
  });
}

// 期限切れレポート専用のエントリ（時間トリガーで10:00などに実行する想定）
function ReportExpired() {
  withScriptLock('ReportExpired', function () {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const config = Config.create();
    const notificationSheetNames = getNotificationSheetNames();
    const now = new Date(config.debugDate);
    const expiredRows = collectExpiredRows(spreadsheet, notificationSheetNames, now);
    recordExpiredRows(expiredRows, now);
  });
}
