"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SensusAnalyticsPlatform = void 0;
const settings_1 = require("./settings");
const accessory_1 = require("./accessory");
const sensusApi_1 = require("./sensusApi");
class SensusAnalyticsPlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        // Restored cached accessories from disk
        this.cachedAccessories = [];
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.log.debug('Sensus Analytics platform initialising');
        this.api.on('didFinishLaunching', () => {
            this.discoverDevices();
        });
    }
    /** Called by Homebridge to restore cached accessories on startup. */
    configureAccessory(accessory) {
        this.log.info('Restoring cached accessory:', accessory.displayName);
        this.cachedAccessories.push(accessory);
    }
    discoverDevices() {
        const { baseUrl, username, password, accountNumber, meterNumber } = this.config;
        if (!baseUrl || !username || !password || !accountNumber || !meterNumber) {
            this.log.error('Sensus Analytics: missing required config fields ' +
                '(baseUrl, username, password, accountNumber, meterNumber)');
            return;
        }
        const apiClient = new sensusApi_1.SensusAnalyticsApi(baseUrl, username, password, accountNumber, meterNumber, this.log);
        const displayName = this.config.name || 'Sensus Water Meter';
        const uuid = this.api.hap.uuid.generate(`sensus-${meterNumber}`);
        const existing = this.cachedAccessories.find((a) => a.UUID === uuid);
        if (existing) {
            this.log.info('Restoring water meter accessory:', existing.displayName);
            new accessory_1.SensusWaterMeterAccessory(this, existing, apiClient);
        }
        else {
            this.log.info('Adding new water meter accessory:', displayName);
            const accessory = new this.api.platformAccessory(displayName, uuid);
            accessory.context.meterNumber = meterNumber;
            new accessory_1.SensusWaterMeterAccessory(this, accessory, apiClient);
            this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [accessory]);
        }
    }
}
exports.SensusAnalyticsPlatform = SensusAnalyticsPlatform;
//# sourceMappingURL=platform.js.map