import { PlatformAccessory } from 'homebridge';
import { SensusAnalyticsPlatform } from './platform';
import { SensusAnalyticsApi } from './sensusApi';
export declare class SensusWaterMeterAccessory {
    private readonly platform;
    private readonly accessory;
    private readonly apiClient;
    private readonly leakService;
    private readonly leakThreshold;
    private readonly pollIntervalMs;
    private readonly eveConsumptionChar;
    private readonly historyService;
    private lastData;
    private lastLoggedTimestamps;
    constructor(platform: SensusAnalyticsPlatform, accessory: PlatformAccessory, apiClient: SensusAnalyticsApi);
    private addEveCharacteristic;
    private handleLeakDetectedGet;
    /** Log hourly entries to fakegato, skipping already-logged timestamps. */
    private logHourlyHistory;
    private poll;
}
//# sourceMappingURL=accessory.d.ts.map