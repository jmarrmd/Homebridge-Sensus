import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
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

// 1 CCF (hundred cubic feet) = 748.052 gallons
const CCF_TO_GALLONS = 748.052;

export class SensusAnalyticsApi {
  private readonly client: AxiosInstance;
  private readonly jar: CookieJar;
  private loggedIn = false;

  constructor(
    private readonly baseUrl: string,
    private readonly username: string,
    private readonly password: string,
    private readonly accountNumber: string,
    private readonly meterNumber: string,
    private readonly log: Logger,
  ) {
    this.jar = new CookieJar();
    this.client = wrapper(
      axios.create({
        baseURL: baseUrl.replace(/\/$/, ''),
        jar: this.jar,
        withCredentials: true,
        // Follow redirects but treat 302 as success for login
        maxRedirects: 5,
        timeout: 15000,
      }),
    );
  }

  async login(): Promise<boolean> {
    try {
      this.log.debug('Sensus Analytics: attempting login...');
      await this.client.post(
        '/j_spring_security_check',
        new URLSearchParams({
          j_username: this.username,
          j_password: this.password,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          // A 302 redirect means login was processed; axios follows it automatically
          validateStatus: (s) => s < 400,
        },
      );
      this.loggedIn = true;
      this.log.debug('Sensus Analytics: login successful');
      return true;
    } catch (err) {
      this.loggedIn = false;
      this.log.error('Sensus Analytics: login failed:', (err as Error).message);
      return false;
    }
  }

  async fetchData(): Promise<SensusData | null> {
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
    } catch (err) {
      this.loggedIn = false;
      this.log.error('Sensus Analytics: error fetching data:', (err as Error).message);
      return null;
    }
  }

  private async fetchDailyData(): Promise<DailyData | null> {
    const response = await this.client.post('/water/widget/byPage', {
      group: 'meters',
      accountNumber: this.accountNumber,
      deviceId: this.meterNumber,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const device = (response.data as any)?.widgetList?.[0]?.data?.devices?.[0];
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

  private async fetchHourlyData(): Promise<HourlyEntry[] | null> {
    // Fetch the previous day's data (Sensus updates at midnight)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfDay = new Date(
      yesterday.getFullYear(),
      yesterday.getMonth(),
      yesterday.getDate(),
    );
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000 - 1);

    const response = await this.client.get(
      `/water/usage/${this.accountNumber}/${this.meterNumber}`,
      {
        params: {
          start: startOfDay.getTime(),
          end: endOfDay.getTime(),
          zoom: 'day',
          page: 'null',
          weather: '1',
        },
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = response.data as any;
    if (!data?.operationSuccess) {
      this.log.warn('Sensus Analytics: hourly data fetch unsuccessful');
      return null;
    }

    const usageArray: unknown[][] = data?.data?.usage;
    if (!Array.isArray(usageArray) || usageArray.length < 2) {
      return [];
    }

    // First element is units row: [usageUnit, rainUnit, tempUnit, altUnit]
    const [rawUsageUnit, rainUnit, tempUnit] = usageArray[0] as string[];
    const rows = usageArray.slice(1);
    const toGallons = (rawUsageUnit ?? 'CCF').toUpperCase() === 'CCF' ? CCF_TO_GALLONS : 1;

    return rows.map((row) => ({
      timestamp: row[0] as number,
      usage: Math.round((((row[1] as number) ?? 0) * toGallons) * 100) / 100,
      rain: (row[2] as number) ?? 0,
      temp: (row[3] as number) ?? 0,
      usageUnit: 'GAL',
      rainUnit: rainUnit ?? 'INCHES',
      tempUnit: tempUnit ?? 'FAHRENHEIT',
    }));
  }
}
