import { Logger } from 'homebridge';
export interface DailyData {
    dailyUsage: number;
    usageUnit: string;
    meterAddress: string;
    lastRead: string;
    meterId: string;
    meterLat: number;
    meterLong: number;
    odometer: number;
    billingUsage: number;
}
export interface HourlyEntry {
    timestamp: number;
    usage: number;
    rain: number;
    temp: number;
    usageUnit: string;
    rainUnit: string;
    tempUnit: string;
}
export interface SensusData {
    daily: DailyData;
    hourly: HourlyEntry[];
}
export declare class SensusAnalyticsApi {
    private readonly baseUrl;
    private readonly username;
    private readonly password;
    private readonly accountNumber;
    private readonly meterNumber;
    private readonly log;
    private readonly client;
    private readonly jar;
    private loggedIn;
    constructor(baseUrl: string, username: string, password: string, accountNumber: string, meterNumber: string, log: Logger);
    login(): Promise<boolean>;
    fetchData(): Promise<SensusData | null>;
    private fetchDailyData;
    private fetchHourlyData;
}
//# sourceMappingURL=sensusApi.d.ts.map