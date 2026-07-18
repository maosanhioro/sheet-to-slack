// 期限切れ（棚卸し対象）行の収集と記録を担当する。
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
