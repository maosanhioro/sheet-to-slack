// 定数定義と共通ユーティリティ（ログ・値の正規化など）を担当する。
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
