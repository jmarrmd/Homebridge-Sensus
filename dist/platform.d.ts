import { API, Characteristic, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
export declare class SensusAnalyticsPlatform implements DynamicPlatformPlugin {
    readonly log: Logger;
    readonly config: PlatformConfig;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    readonly cachedAccessories: PlatformAccessory[];
    constructor(log: Logger, config: PlatformConfig, api: API);
    /** Called by Homebridge to restore cached accessories on startup. */
    configureAccessory(accessory: PlatformAccessory): void;
    private discoverDevices;
}
//# sourceMappingURL=platform.d.ts.map