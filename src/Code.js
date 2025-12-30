// 通知設定シートを読み取り、Slack/メール送信を行うメイン処理。
const SHEET_NAMES = {
  NOTIFICATIONS: '通知設定'
};

// 通知設定シートの列インデックス定義。
const LOG_PREFIX = '[sheet-to-slack]';

const COLS = {
  YEAR: 0,
  MONTH: 1,
  DAY: 2,
  TIME: 3,
  WEEKS_START: 4, // 4-10
  HOLIDAY: 11,
  SLACK_CHANNEL: 12,
  MENTION: 13,
  MESSAGE: 14,
  AUTHOR: 15
};

function Main() {
  const lock = LockService.getScriptLock();
  if (lock.tryLock(1)) {
    try {
      Action();
    } finally {
      lock.releaseLock();
    }
  }
}

// 補助エントリ（小文字）も用意
function main() {
  Main();
}

function Action() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const notificationSheet = spreadsheet.getSheetByName(SHEET_NAMES.NOTIFICATIONS);
  if (!notificationSheet) {
    logError('通知シートが見つかりません');
    return;
  }

  const config = Config.create();
  const now = new Date(config.debugDate);
  const slackNotifier = new SlackNotifier(config.webhookUrl);
  const rows = notificationSheet.getDataRange().getValues();

  logInfo('通知処理開始');
  for (let i = 1; i < rows.length; i++) {
    const notificationNo = i + 1;
  const row = parseNotificationRow(rows[i], notificationNo);
  if (!row) {
    logSkip(notificationNo, '必須項目不足のためスキップ');
    continue;
  }

    if (!isValidDateCell(row.time)) {
      logSkip(notificationNo, '時間列が不正のためスキップ');
      continue;
    }

    if (!isValidDayCells(row.year, row.month, row.day)) {
      logSkip(notificationNo, '年月日列が不正のためスキップ');
      continue;
    }

    if (shouldSkipByDate(row, now)) {
      logRowSkip(notificationNo, '日付が当日ではないためスキップ');
      continue;
    }

    // 実際の判定は NotificationTime に委譲
    const notificationTime = new NotificationTime(
      now,
      row.year,
      row.month,
      row.day,
      row.time,
      row.weeks,
      row.allowOffday
    );

    logRowStart(notificationNo);
    if (!notificationTime.isNotify()) {
      logRowSkip(notificationNo, '通知条件にマッチしないためスキップ');
      continue;
    }

    try {
      const formattedMention = slackNotifier.formatMention(row.mention);
      slackNotifier.send(row.slackChannel, formattedMention, row.message);
      logRowDone(notificationNo);
    } catch (e) {
      const message = `${notificationNo}行目の通知失敗 message:${e.message}`;
      logError(message);
      if (config.isErrorMail) {
        MailApp.sendEmail(config.botMaster, 'onobotからお知らせ　通知失敗', message);
      }
    }
  }
}

function parseNotificationRow(row, notificationNo) {
  if (row[COLS.SLACK_CHANNEL] === '' || row[COLS.MESSAGE] === '') {
    return null;
  }

  return {
    year: row[COLS.YEAR],
    month: row[COLS.MONTH],
    day: row[COLS.DAY],
    time: row[COLS.TIME],
    weeks: row.slice(COLS.WEEKS_START, COLS.WEEKS_START + 7),
    allowOffday: row[COLS.HOLIDAY],
    slackChannel: row[COLS.SLACK_CHANNEL],
    mention: row[COLS.MENTION],
    message: row[COLS.MESSAGE],
    author: row[COLS.AUTHOR],
    notificationNo: notificationNo
  };
}

function isValidDateCell(time) {
  return time !== '' && !isNaN(new Date(time).getTime());
}

function isValidDayCells(year, month, day) {
  // "指定なし" のケースは現行挙動として許容する
  if (year === '指定なし' && month === '指定なし' && day === '指定なし') {
    return true;
  }
  // 部分指定も現行挙動を維持するため最小限の検査のみ
  if (year === '指定なし' || month === '指定なし' || day === '指定なし') {
    return true;
  }
  return !isNaN(parseInt(year, 10)) && !isNaN(parseInt(month, 10)) && !isNaN(parseInt(day, 10));
}

function shouldSkipByDate(row, now) {
  // 日付指定がない場合は従来通り（曜日モード）で判定
  if (row.year === '指定なし' || row.month === '指定なし' || row.day === '指定なし') {
    return false;
  }

  const targetDate = new Date(now.getTime());
  // GASシート上は「YYYY年」「MM月」「DD日」のように1桁も入り得るため parseInt
  targetDate.setFullYear(parseInt(row.year, 10));
  targetDate.setMonth(parseInt(row.month, 10) - 1);
  targetDate.setDate(parseInt(row.day, 10));

  // 時刻は別で判定するので日付の早期フィルタのみ
  const todayKey = dateKey(now);
  const targetKey = dateKey(targetDate);
  return targetKey !== todayKey;
}

function dateKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function logRowStart(no) {
  logWithRow(no, '通知開始');
}

function logRowSkip(no, reason) {
  logWithRow(no, reason ? `通知スキップ ${reason}` : '通知スキップ');
}

function logRowDone(no) {
  logWithRow(no, '通知完了');
}

function logSkip(no, reason) {
  logRowSkip(no, reason);
}

function logInfo(message) {
  Logger.log(`${LOG_PREFIX} ${message}`);
}

function logError(message) {
  Logger.log(`${LOG_PREFIX} [ERROR] ${message}`);
}

function logWithRow(no, message) {
  Logger.log(`${LOG_PREFIX} [row=${no}] ${message}`);
}
