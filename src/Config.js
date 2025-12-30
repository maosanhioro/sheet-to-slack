// Script Properties から Webhook設定やエラー通知先を保持する。
function Config(webhookUrl, botMaster, isErrorMail, debugDate) {
    this.webhookUrl = webhookUrl;
    this.botMaster = botMaster;
    this.isErrorMail = isErrorMail;
    this.debugDate = debugDate;
}

Config.create = function () {
    const props = PropertiesService.getScriptProperties();
    const webhookFromProps = props.getProperty('SLACK_WEBHOOK_URL');
    const webhookUrl = (webhookFromProps || '').toString().trim();

    const botMaster = (props.getProperty('BOT_MASTER') || '').toString().trim();
    const isErrorMail = (props.getProperty('ERROR_MAIL_ENABLED') || 'false').toString().toLowerCase() === 'true';
    const debugDateValue = props.getProperty('DEBUG_DATE');
    const debugDateString = debugDateValue && debugDateValue !== '' ? debugDateValue : new Date().getTime();
    const debugDate = Utilities.formatDate(new Date(debugDateString), 'JST', 'yyyy/MM/dd HH:mm');

    return new Config(webhookUrl, botMaster, isErrorMail, debugDate);
};
