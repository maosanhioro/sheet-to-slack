// Slackへの送信とメンション整形を担当する。
function SlackNotifier(webhookUrl) {
    this.username = 'onobot';
    this.webhookUrl = webhookUrl;
    this.userIdCache = null;
    this.userIdReverseCache = null;
}

SlackNotifier.SHEET_USER_ID = 'ユーザーIDマッピング';

SlackNotifier.prototype.send = function send(channel, mention, text) {
    if (!this.webhookUrl) {
        throw new Error('Webhook URL is not configured');
    }
    const payload = {
        "channel": channel,
        "text": mention + text,
        "link_names": 1,
        "icon_emoji": ':onobot:',
        "username": this.username
    };

    this.fetch(this.webhookUrl, payload);
}

SlackNotifier.prototype.formatMention = function formatMention(mention) {
    if (!mention) return "";

    if ('here' === mention || 'channel' === mention) {
        return Utilities.formatString("<!%s>\n", mention);
    }

    const userIdMap = this.getUserIdMap();
    return mention.split(/,/).map(function (name) {
        const trimmed = name.trim();
        const userId = userIdMap[trimmed];
        return userId ? `<@${userId}>` : `@${trimmed}`;
    }).join(" ") + "\n";
}

SlackNotifier.prototype.getUserIdMap = function getUserIdMap() {
    if (this.userIdCache) {
        return this.userIdCache;
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SlackNotifier.SHEET_USER_ID);
    const data = sheet.getDataRange().getValues();
    const map = {};
    const reverseMap = {};

    for (let i = 1; i < data.length; i++) {
        const name = data[i][0];
        const userId = data[i][1];
        if (name && userId) {
            map[name] = userId;
            reverseMap[userId] = name;
        }
    }

    this.userIdCache = map;
    this.userIdReverseCache = reverseMap;
    return map;
}

SlackNotifier.prototype.fetch = function (url, payload) {
    const response = UrlFetchApp.fetch(url, {
        "method": "POST",
        "payload": JSON.stringify(payload),
        "contentType": "application/json",
        "muteHttpExceptions": true
    });

    if (response.getResponseCode() >= 400) {
        Logger.log(Utilities.formatString('Send error: %s from %s', response.getContentText(), payload.channel));
    }
}
