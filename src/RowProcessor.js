// 通知設定シートの行のパース・検証・通常通知処理を担当する。
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
