const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createUtilities() {
  return {
    formatString(format, ...args) {
      let index = 0;
      return format.replace(/%s/g, function () {
        const value = args[index];
        index += 1;
        return String(value);
      });
    },
    formatDate(date, _timezone, format) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');

      if (format === 'yyyy-MM-dd') {
        return `${year}-${month}-${day}`;
      }
      if (format === 'yyyy/MM/dd HH:mm') {
        return `${year}/${month}/${day} ${hours}:${minutes}`;
      }
      if (format === 'HH:mm') {
        return `${hours}:${minutes}`;
      }
      throw new Error(`Unsupported format: ${format}`);
    }
  };
}

function createContext(overrides = {}) {
  const scriptProperties = {};
  const context = {
    console,
    Date,
    Logger: {
      log() {}
    },
    Utilities: createUtilities(),
    CalendarApp: {
      getCalendarById() {
        return {
          getEventsForDay() {
            return [];
          }
        };
      }
    },
    UrlFetchApp: {
      fetch() {
        return {
          getResponseCode() {
            return 200;
          },
          getContentText() {
            return 'ok';
          }
        };
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return Object.prototype.hasOwnProperty.call(scriptProperties, key) ? scriptProperties[key] : null;
          },
          setProperty(key, value) {
            scriptProperties[key] = value;
          }
        };
      }
    },
    MailApp: {
      sendEmail() {}
    },
    LockService: {
      getScriptLock() {
        return {
          tryLock() {
            return true;
          },
          releaseLock() {}
        };
      }
    },
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        throw new Error('SpreadsheetApp.getActiveSpreadsheet should not be called in tests');
      }
    }
  };

  Object.assign(context, overrides);
  context.global = context;
  context.globalThis = context;
  context.__scriptProperties = scriptProperties;
  return vm.createContext(context);
}

function loadScripts(context, files) {
  files.forEach(function (file) {
    const code = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    vm.runInContext(code, context, { filename: file });
  });
}

function createNotificationRow(overrides = {}) {
  const row = [
    '指定なし',
    '指定なし',
    '指定なし',
    new Date(2026, 6, 17, 10, 0, 0, 0),
    false,
    false,
    false,
    false,
    false,
    true,
    false,
    true,
    'general',
    '',
    '定期通知',
    ''
  ];

  Object.keys(overrides).forEach(function (index) {
    row[Number(index)] = overrides[index];
  });

  return row;
}

function testSlackNotifierThrowsOnHttpError() {
  const context = createContext({
    UrlFetchApp: {
      fetch() {
        return {
          getResponseCode() {
            return 500;
          },
          getContentText() {
            return 'channel_not_found';
          }
        };
      }
    }
  });
  loadScripts(context, ['src/SlackNotifier.js']);

  const notifier = new context.SlackNotifier('https://example.test', 'bot', ':bell:');
  assert.throws(function () {
    notifier.send('general', '', 'hello');
  }, /Slack送信失敗/);
}

function testNotificationTimeMatchesWithinLookbackWindow() {
  const context = createContext();
  loadScripts(context, ['src/NotificationTime.js']);

  const weeks = [false, false, false, false, false, true, false];
  const notificationTime = new context.NotificationTime(
    new Date(2026, 6, 17, 10, 3, 0, 0),
    '指定なし',
    '指定なし',
    '指定なし',
    new Date(2026, 6, 17, 10, 0, 0, 0),
    weeks,
    true,
    { lookbackMinutes: 5 }
  );

  assert.strictEqual(notificationTime.isNotify(), true);
  assert.strictEqual(notificationTime.getScheduledTimeKey(), '2026-07-17 10:00');
}

function testProcessNotificationRowsSkipsAlreadySentNotification() {
  const context = createContext();
  loadScripts(context, ['src/NotificationTime.js', 'src/Code.js']);

  const sentMessages = [];
  const slackNotifier = {
    formatMention() {
      return '';
    },
    send(channel, mention, message) {
      sentMessages.push({ channel, mention, message });
    },
    sendDirect() {}
  };

  const row = createNotificationRow();
  context.__scriptProperties['LAST_NOTIFIED:通知設定:2'] = '2026-07-17 10:00';
  context.processNotificationRows(
    [['header'], row],
    new Date(2026, 6, 17, 10, 3, 0, 0),
    slackNotifier,
    { isErrorMail: false, botMaster: '' },
    '通知設定'
  );

  assert.strictEqual(sentMessages.length, 0);
}

function testProcessNotificationRowsAcceptsNumericDateCells() {
  const context = createContext();
  loadScripts(context, ['src/NotificationTime.js', 'src/Code.js']);

  const sentMessages = [];
  const slackNotifier = {
    formatMention() {
      return '';
    },
    send(channel, mention, message) {
      sentMessages.push({ channel, mention, message });
    },
    sendDirect() {}
  };

  const row = createNotificationRow({
    0: 2026,
    1: 7,
    2: 17
  });

  context.processNotificationRows(
    [['header'], row],
    new Date(2026, 6, 17, 10, 2, 0, 0),
    slackNotifier,
    { isErrorMail: false, botMaster: '' },
    '通知設定'
  );

  assert.strictEqual(sentMessages.length, 1);
  assert.strictEqual(context.__scriptProperties['LAST_NOTIFIED:通知設定:2'], '2026-07-17 10:00');
}

function run() {
  testSlackNotifierThrowsOnHttpError();
  testNotificationTimeMatchesWithinLookbackWindow();
  testProcessNotificationRowsSkipsAlreadySentNotification();
  testProcessNotificationRowsAcceptsNumericDateCells();
  console.log('All tests passed');
}

run();
