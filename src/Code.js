// 通知設定シートを読み取り、Slack送信を行うメイン処理。
const LOG_PREFIX = '[sheet-to-slack]';
const LOCK_WAIT_MS = 30000;
const NOTIFICATION_RECOVERY_WINDOW_MINUTES = 15;
const LAST_NOTIFIED_PREFIX = 'LAST_NOTIFIED';

const COLS = {
  YEAR: 0,
  MONTH: 1,
  DAY: 2,
  TIME: 3,
  WEEKS_START: 4, // 4-10
  HOLIDAY: 11,
  SLACK_CHANNEL: 12,
  DESTINATION: 13,
  MESSAGE: 14,
  REGISTERED_BY: 15,
  EXPIRED_RECORDED_AT: 16
};

function normalizeDayCell(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return value;
}

function normalizeTextCell(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return value.toString().trim();
}

function dateKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatTime(time) {
  return Utilities.formatDate(new Date(time), 'JST', 'HH:mm');
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

function withScriptLock(actionName, action) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) {
    logError(`${actionName} のロック取得に失敗しました waitMs:${LOCK_WAIT_MS}`);
    return false;
  }

  try {
    action();
    return true;
  } finally {
    lock.releaseLock();
  }
}

function buildLastNotifiedKey(sheetName, notificationNo) {
  return `${LAST_NOTIFIED_PREFIX}:${sheetName}:${notificationNo}`;
}

function isAlreadyNotified(stateKey, scheduledTimeKey) {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty(stateKey) === scheduledTimeKey;
}

function markAsNotified(stateKey, scheduledTimeKey) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(stateKey, scheduledTimeKey);
}

function getNotificationSheetNames() {
  const props = PropertiesService.getScriptProperties();
  const raw = (props.getProperty('NOTIFICATION_SHEETS') || '').toString();
  const names = raw.split(',').map(function (name) {
    return name.trim();
  }).filter(function (name) {
    return name !== '';
  });
  if (names.length === 0) {
    throw new Error('Script Properties NOTIFICATION_SHEETS が設定されていません');
  }
  return names;
}

function processNotificationRows(rows, now, slackNotifier, config, sheetName) {
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
      row.allowOffday,
      { lookbackMinutes: NOTIFICATION_RECOVERY_WINDOW_MINUTES }
    );

    logRowStart(notificationNo);
    if (!notificationTime.isNotify()) {
      logRowSkip(notificationNo, '通知条件にマッチしないためスキップ');
      continue;
    }

    const stateKey = buildLastNotifiedKey(sheetName, notificationNo);
    const scheduledTimeKey = notificationTime.getScheduledTimeKey();
    if (isAlreadyNotified(stateKey, scheduledTimeKey)) {
      logRowSkip(notificationNo, `同一時刻の通知済みのためスキップ scheduled:${scheduledTimeKey}`);
      continue;
    }

    try {
      const formattedMention = slackNotifier.formatMention(row.destination);
      slackNotifier.send(row.slackChannel, formattedMention, row.message);
      markAsNotified(stateKey, scheduledTimeKey);
      logRowDone(notificationNo);
    } catch (e) {
      const message = `${notificationNo}行目の通知失敗 message:${e.message}`;
      logError(message);
      if (row.registeredBy) {
        try {
          slackNotifier.sendDirect(row.registeredBy, message);
        } catch (dmError) {
          logError(`登録者へのDM送信に失敗: ${dmError.message}`);
        }
      }
      if (config.isErrorMail) {
        MailApp.sendEmail(config.botMaster, 'sheet-to-slack 通知失敗', message);
      }
    }
  }
}

function parseNotificationRow(row, notificationNo) {
  if (row[COLS.SLACK_CHANNEL] === '' || row[COLS.MESSAGE] === '') {
    return null;
  }

  return {
    year: normalizeDayCell(row[COLS.YEAR]),
    month: normalizeDayCell(row[COLS.MONTH]),
    day: normalizeDayCell(row[COLS.DAY]),
    time: row[COLS.TIME],
    weeks: row.slice(COLS.WEEKS_START, COLS.WEEKS_START + 7),
    allowOffday: row[COLS.HOLIDAY],
    slackChannel: row[COLS.SLACK_CHANNEL],
    destination: row[COLS.DESTINATION],
    message: row[COLS.MESSAGE],
    registeredBy: row[COLS.REGISTERED_BY],
    expiredRecordedAt: normalizeTextCell(row[COLS.EXPIRED_RECORDED_AT]),
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

function isPastDate(row, now) {
  if (row.year === '指定なし' || row.month === '指定なし' || row.day === '指定なし') {
    return false;
  }
  const targetDate = new Date(now.getTime());
  targetDate.setFullYear(parseInt(row.year, 10));
  targetDate.setMonth(parseInt(row.month, 10) - 1);
  targetDate.setDate(parseInt(row.day, 10));

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return targetDate < startOfToday;
}

function collectExpiredRows(spreadsheet, sheetNames, now) {
  const expired = [];
  sheetNames.forEach(function (sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`通知シートが見つかりません: ${sheetName}`);
    }
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const notificationNo = i + 1;
      const row = parseNotificationRow(rows[i], notificationNo);
      if (!row) {
        continue;
      }
      if (!isValidDateCell(row.time)) {
        continue;
      }
      if (!isValidDayCells(row.year, row.month, row.day)) {
        continue;
      }
      // 日付指定があり、過去日付のものだけを期限切れとして集計
      if (isPastDate(row, now) && !isExpiredRowAlreadyRecorded(row)) {
        expired.push({
          sheetRef: sheet,
          sheet: sheetName,
          row: notificationNo
        });
      }
    }
  });
  return expired;
}

function recordExpiredRows(expiredRows, now) {
  expiredRows.forEach(function (item) {
    markExpiredRowAsRecorded(item, now);
    logInfo(`期限切れ棚卸しを記録しました sheet:${item.sheet} row:${item.row}`);
  });
}

function isExpiredRowAlreadyRecorded(row) {
  return row.expiredRecordedAt !== '';
}

function markExpiredRowAsRecorded(item, now) {
  item.sheetRef.getRange(item.row, COLS.EXPIRED_RECORDED_AT + 1, 1, 1).setValue(
    Utilities.formatDate(now, 'JST', 'yyyy/MM/dd')
  );
}

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
