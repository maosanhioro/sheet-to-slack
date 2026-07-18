// スクリプトロックと通知済み状態（Script Properties）の管理を担当する。
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
