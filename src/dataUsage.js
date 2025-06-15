const fs = require('fs').promises;
const path = require('path');

const DATA_USAGE_PATH = path.join(__dirname, '../config/data-usage.json');

class DataUsage {
    constructor() {
        this.usage = {
            daily: {},
            weekly: {},
            monthly: {},
            lastUpdated: new Date().toISOString()
        };
    }

    async load() {
        try {
            const data = await fs.readFile(DATA_USAGE_PATH, 'utf8');
            this.usage = JSON.parse(data);
        } catch (e) {
            await this.save();
        }
    }

    async save() {
        await fs.mkdir(path.dirname(DATA_USAGE_PATH), { recursive: true });
        await fs.writeFile(DATA_USAGE_PATH, JSON.stringify(this.usage, null, 2));
    }

    _getDateKeys() {
        const now = new Date();
        const day = now.toISOString().slice(0, 10); // YYYY-MM-DD
        const week = `${now.getFullYear()}-W${getWeekNumber(now)}`;
        const month = now.toISOString().slice(0, 7); // YYYY-MM
        return { day, week, month };
    }

    async addUsage(bytes) {
        await this.load();
        const { day, week, month } = this._getDateKeys();
        this.usage.daily[day] = (this.usage.daily[day] || 0) + bytes;
        this.usage.weekly[week] = (this.usage.weekly[week] || 0) + bytes;
        this.usage.monthly[month] = (this.usage.monthly[month] || 0) + bytes;
        this.usage.lastUpdated = new Date().toISOString();
        await this.save();
    }

    async getStats() {
        await this.load();
        const { day, week, month } = this._getDateKeys();
        return {
            today: this.usage.daily[day] || 0,
            thisWeek: this.usage.weekly[week] || 0,
            thisMonth: this.usage.monthly[month] || 0
        };
    }

    async clear() {
        this.usage = {
            daily: {},
            weekly: {},
            monthly: {},
            lastUpdated: new Date().toISOString()
        };
        await this.save();
    }
}

function getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

module.exports = { DataUsage, formatBytes }; 