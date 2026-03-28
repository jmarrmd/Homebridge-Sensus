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
    private readonly eveTotalChar;
    private lastData;
    constructor(platform: SensusAnalyticsPlatform, accessory: PlatformAccessory, apiClient: SensusAnalyticsApi);
    /**
     * Creates and registers a custom Characteristic on the LeakSensor service.
     * If the characteristic already exists (restored from cache), it is returned as-is.
     */
    private addEveCharacteristic;
    /** Called by HomeKit to read the current leak state. */
    private handleLeakDetectedGet;
    /** Fetch latest data from Sensus Analytics and push updates to HomeKit. */
    private poll;
}
//# sourceMappingURL=accessory.d.ts.map