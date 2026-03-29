"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SensusAnalyticsApi = void 0;
const axios_1 = require("axios");
const axios_cookiejar_support_1 = require("axios-cookiejar-support");
const tough_cookie_1 = require("tough-cookie");
// 1 CCF (hundred cubic feet) = 748.052 gallons
const CCF_TO_GALLONS = 748.052;
class SensusAnalyticsApi {
    constructor(baseUrl, username, password, accountNumber, meterNumber, log) {
        this.baseUrl = baseUrl;
        this.username = username;
        this.password = password;
        this.accountNumber = accountNumber;
        this.meterNumber = meterNumber;
        this.log = log;
        this.loggedIn = false;
        this.jar = new tough_cookie_1.CookieJar();
        this.client = (0, axios_cookiejar_support_1.wrapper)(axios_1.default.create({
            baseURL: baseUrl.replace(/\/$/, ''),
            jar: this.jar,
            withCredentials: true,
            // Follow redirects but treat 302 as success for login
            maxRedirects: 5,
            timeout: 15000,
        }));
    }
    async login() {
        try {
            this.log.debug('Sensus Analytics: attempting login...');
            await this.client.post('/j_spring_security_check', new URLSearchParams({
                j_username: this.username,
                j_password: this.password,
            }).toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                // A 302 redirect means login was processed; axios follows it automatically
                validateStatus: (s) => s < 400,
            });
            this.loggedIn = true;
            this.log.debug('Sensus Analytics: login successful');
            return true;
        }
        catch (err) {
            this.loggedIn = false;
            this.log.error('Sensus Analytics: login failed:', err.message);
            return false;
        }
    }
    async fetchData() {
        if (!this.loggedIn) {
            const ok = await this.login();
            if (!ok) {
                return null;
            }
        }
        try {
            const [daily, hourly] = await Promise.all([
                this.fetchDailyData(),
                this.fetchHourlyData(),
            ]);
            if (!daily) {
                // Session may have expired — clear and retry once
                this.loggedIn = false;
                const ok = await this.login();
                if (!ok) {
                    return null;
                }
                const retried = await this.fetchDailyData();
                if (!retried) {
                    return null;
                }
                return { daily: retried, hourly: hourly ?? [] };
            }
            return { daily, hourly: hourly ?? [] };
        }
        catch (err) {
            this.loggedIn = false;
            this.log.error('Sensus Analytics: error fetching data:', err.message);
            return null;
        }
    }
    async fetchDailyData() {
        const response = await this.client.post('/water/widget/byPage', {
            group: 'meters',
            accountNumber: this.accountNumber,
            deviceId: this.meterNumber,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const device = response.data?.widgetList?.[0]?.data?.devices?.[0];
        if (!device) {
            this.log.warn('Sensus Analytics: unexpected daily data structure');
            return null;
        }
        const rawUnit = (device.usageUnit || 'CCF').toUpperCase();
        const toGallons = rawUnit === 'CCF' ? CCF_TO_GALLONS : 1;
        return {
            dailyUsage: Math.round(((parseFloat(device.dailyUsage) || 0) * toGallons) * 100) / 100,
            usageUnit: 'GAL',
            meterAddress: device.meterAddress1 || '',
            lastRead: device.lastRead || '',
            meterId: String(device.meterId || ''),
            meterLat: parseFloat(device.meterLat) || 0,
            meterLong: parseFloat(device.meterLong) || 0,
            odometer: Math.round(((parseFloat(device.latestReadUsage) || 0) * toGallons) * 100) / 100,
            billingUsage: Math.round(((parseFloat(device.billingUsage) || 0) * toGallons) * 100) / 100,
        };
    }
    async fetchHourlyData() {
        // Fetch the previous day's data (Sensus updates at midnight)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const startOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 86400000 - 1);
        const response = await this.client.get(`/water/usage/${this.accountNumber}/${this.meterNumber}`, {
            params: {
                start: startOfDay.getTime(),
                end: endOfDay.getTime(),
                zoom: 'day',
                page: 'null',
                weather: '1',
            },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = response.data;
        if (!data?.operationSuccess) {
            this.log.warn('Sensus Analytics: hourly data fetch unsuccessful');
            return null;
        }
        const usageArray = data?.data?.usage;
        if (!Array.isArray(usageArray) || usageArray.length < 2) {
            return [];
        }
        // First element is units row: [usageUnit, rainUnit, tempUnit, altUnit]
        const [rawUsageUnit, rainUnit, tempUnit] = usageArray[0];
        const rows = usageArray.slice(1);
        const toGallons = (rawUsageUnit ?? 'CCF').toUpperCase() === 'CCF' ? CCF_TO_GALLONS : 1;
        return rows.map((row) => ({
            timestamp: row[0],
            usage: Math.round(((row[1] ?? 0) * toGallons) * 100) / 100,
            rain: row[2] ?? 0,
            temp: row[3] ?? 0,
            usageUnit: 'GAL',
            rainUnit: rainUnit ?? 'INCHES',
            tempUnit: tempUnit ?? 'FAHRENHEIT',
        }));
    }
}
exports.SensusAnalyticsApi = SensusAnalyticsApi;
//# sourceMappingURL=sensusApi.js.map