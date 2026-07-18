// Script Properties から Webhook設定やエラー通知先を保持する。
function Config(webhookUrl, botMaster, isErrorMail, debugDate, slackUsername, slackIconEmoji) {
    this.webhookUrl = webhookUrl;
    this.botMaster = botMaster;
    this.isErrorMail = isErrorMail;
    this.debugDate = debugDate;
    this.slackUsername = slackUsername;
    this.slackIconEmoji = slackIconEmoji;
}

Config.create = function () {
    const props = PropertiesService.getScriptProperties();
    const webhookFromProps = props.getProperty('SLACK_WEBHOOK_URL');
    const webhookUrl = (webhookFromProps || '').toString().trim();
    if (!webhookUrl) {
        throw new Error('Script Properties SLACK_WEBHOOK_URL が設定されていません');
    }

    const slackUsername = (props.getProperty('SLACK_USERNAME') || '').toString().trim();
    if (!slackUsername) {
        throw new Error('Script Properties SLACK_USERNAME が設定されていません');
    }

    const slackIconEmoji = (props.getProperty('SLACK_ICON_EMOJI') || '').toString().trim();
    if (!slackIconEmoji) {
        throw new Error('Script Properties SLACK_ICON_EMOJI が設定されていません');
    }

    const botMaster = (props.getProperty('BOT_MASTER') || '').toString().trim();
    const isErrorMail = (props.getProperty('ERROR_MAIL_ENABLED') || 'false').toString().toLowerCase() === 'true';
    const debugDateValue = props.getProperty('DEBUG_DATE');
    const debugDateString = debugDateValue && debugDateValue !== '' ? debugDateValue : new Date().getTime();
    const debugDate = Utilities.formatDate(new Date(debugDateString), 'JST', 'yyyy/MM/dd HH:mm');

    return new Config(webhookUrl, botMaster, isErrorMail, debugDate, slackUsername, slackIconEmoji);
};
