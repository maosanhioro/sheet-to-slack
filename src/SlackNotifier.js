// Slackへの送信と宛先（メンション）整形を担当する。
function SlackNotifier(webhookUrl) {
    this.username = 'onobot';
    this.webhookUrl = webhookUrl;
}

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

    return mention.split(/,/).map(function (name) {
        const trimmed = name.trim();
        // 既にIDフォーマットならそのまま、IDらしき場合は<@id>、それ以外は@name
        if (trimmed.startsWith('<@') && trimmed.endsWith('>')) {
            return trimmed;
        }
        if (/^[UW][A-Z0-9]+$/i.test(trimmed)) {
            return `<@${trimmed}>`;
        }
        return `@${trimmed}`;
    }).join(" ") + "\n";
}

SlackNotifier.prototype.sendDirect = function sendDirect(user, text) {
    const channel = this.normalizeUserChannel(user);
    if (!channel) {
        throw new Error('DM送信先が空です');
    }
    const payload = {
        "channel": channel,
        "text": text,
        "link_names": 1,
        "icon_emoji": ':onobot:',
        "username": this.username
    };
    this.fetch(this.webhookUrl, payload);
}

SlackNotifier.prototype.normalizeUserChannel = function normalizeUserChannel(user) {
    if (!user) {
        return null;
    }
    const trimmed = user.trim();
    if (trimmed.startsWith('<@') && trimmed.endsWith('>')) {
        return trimmed;
    }
    if (trimmed.startsWith('@')) {
        return trimmed;
    }
    if (/^[UW][A-Z0-9]+$/i.test(trimmed)) {
        return `@${trimmed}`;
    }
    return `@${trimmed}`;
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
