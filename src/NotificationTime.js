// 通知条件（日時/曜日/祝日）を判定するクラス。
function NotificationTime(now, year, month, date, time, weeks, allowOffday, options) {
    const NO_SPEC = "指定なし";

    // timeはシート上で日付データとして扱われてかつ1899年起点になるので現在の時間のオブジェクトを作ってそれに対して時、分を割り当てる
    const tmpDate = new Date(time);
    this.sheetDate = new Date(now.getTime());
    this.sheetDate.setHours(tmpDate.getHours(), tmpDate.getMinutes(), 0, 0);
    this.nowDate = now;
    this.lookbackMinutes = options && options.lookbackMinutes ? options.lookbackMinutes : 0;

    const sheetYear = NO_SPEC === year ? this.nowDate.getFullYear() : this.parseNumberCell(year);
    const sheetMonth = NO_SPEC === month ? this.nowDate.getMonth() : this.parseNumberCell(month) - 1;
    const sheetDate = NO_SPEC === date ? this.nowDate.getDate() : this.parseNumberCell(date);

    // 各項目の値がNO_SPECの場合は通知日時の時間として扱って、指定がある場合はそのまま扱う
    this.sheetDate.setFullYear(parseInt(sheetYear, 10));
    this.sheetDate.setMonth(parseInt(sheetMonth, 10));
    this.sheetDate.setDate(parseInt(sheetDate, 10));

    this.weeks = weeks;
    this.allowOffday = allowOffday;
    this.isDayMode = NO_SPEC !== date;
}

NotificationTime.prototype.isNotify = function isNotify() {
    if (!this.isWeekMatched()) {
        Logger.log(Utilities.formatString('日付指定または曜日指定にマッチしない dayMode:%s weekDay:%s', this.isDayMode, this.nowDate.getDay()));
        return false;
    }

    const nowTime = this.dateFormat(this.nowDate);
    const sheetTime = this.dateFormat(this.sheetDate);
    if (!this.isTimeMatched(nowTime, sheetTime)) {
        Logger.log(Utilities.formatString('時間がマッチしない nowTime:%s sheetTime:%s', nowTime, sheetTime));
        return false;
    }

    if (!this.isOffdayAllowed()) {
        Logger.log(Utilities.formatString("休日（土日祝）がマッチしない date:%s", Utilities.formatDate(this.sheetDate, 'JST', 'yyyy/MM/dd HH:mm')));
        return false;
    }

    return true;
}

NotificationTime.prototype.isWeekMatched = function isWeekMatched() {
    if (this.isDayMode) {
        return true;
    }
    return this.weeks[this.nowDate.getDay()];
}

NotificationTime.prototype.isTimeMatched = function isTimeMatched(nowTime, sheetTime) {
    if (this.lookbackMinutes <= 0) {
        return nowTime === sheetTime;
    }

    const diff = this.nowDate.getTime() - this.sheetDate.getTime();
    return diff >= 0 && diff <= this.lookbackMinutes * 60 * 1000;
}

NotificationTime.prototype.isOffdayAllowed = function isOffdayAllowed() {
    if (this.allowOffday) {
        return true;
    }
    if (this.isWeekend(this.nowDate)) {
        return false;
    }
    return !this.isHoliday(this.nowDate);
}

NotificationTime.prototype.dateFormat = function dateFormat(date) {
    return Utilities.formatString(
        "%s/%s/%s %s:%s",
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
        date.getHours(),
        date.getMinutes()
    );
}

NotificationTime.prototype.getScheduledTimeKey = function getScheduledTimeKey() {
    return Utilities.formatString(
        "%s-%s-%s %s:%s",
        this.sheetDate.getFullYear(),
        this.pad2(this.sheetDate.getMonth() + 1),
        this.pad2(this.sheetDate.getDate()),
        this.pad2(this.sheetDate.getHours()),
        this.pad2(this.sheetDate.getMinutes())
    );
}

NotificationTime.prototype.parseNumberCell = function parseNumberCell(value) {
    if (typeof value === 'number') {
        return value;
    }

    const normalized = value.toString().trim().replace(/[^\d-]/g, '');
    return parseInt(normalized, 10);
}

NotificationTime.prototype.pad2 = function pad2(value) {
    return value < 10 ? `0${value}` : `${value}`;
}

NotificationTime.prototype.isWeekend = function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
}

NotificationTime.prototype.isHoliday = function isHoliday(date) {
    const cacheKey = Utilities.formatDate(date, 'JST', 'yyyy-MM-dd');
    if (NotificationTime.holidayCache.hasOwnProperty(cacheKey)) {
        return NotificationTime.holidayCache[cacheKey];
    }

    const calendar = CalendarApp.getCalendarById("ja.japanese#holiday@group.v.calendar.google.com");
    const todayEvents = calendar.getEventsForDay(date);
    const isHoliday = todayEvents.length > 0;

    NotificationTime.holidayCache[cacheKey] = isHoliday;
    return isHoliday;
}

NotificationTime.holidayCache = {};
