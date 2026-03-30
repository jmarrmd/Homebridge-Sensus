"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SensusWaterMeterAccessory = void 0;
// Eve custom characteristic UUID for current consumption
const EVE_UUID_WATER_CONSUMPTION = 'E863F10D-079E-48FF-8F27-9C2605A29F52';
const DEFAULT_POLL_INTERVAL_MINUTES = 30;
class SensusWaterMeterAccessory {
    constructor(platform, accessory, apiClient) {
        this.platform = platform;
        this.accessory = accessory;
        this.apiClient = apiClient;
        this.lastData = null;
        this.lastLoggedTimestamps = new Set();
        const { hap } = platform.api;
        const { Service: Svc, Characteristic: Char } = platform;
        this.leakThreshold = platform.config.leakThreshold ?? 150;
        this.pollIntervalMs =
            (platform.config.pollInterval ?? DEFAULT_POLL_INTERVAL_MINUTES) *
                60 *
                1000;
        // ── Accessory Information ─────────────────────────────────────────────
        this.accessory
            .getService(Svc.AccessoryInformation)
            .setCharacteristic(Char.Manufacturer, 'Sensus')
            .setCharacteristic(Char.Model, 'Smart Water Meter')
            .setCharacteristic(Char.SerialNumber, accessory.context.meterNumber ?? 'Unknown');
        // ── Leak Sensor (primary HomeKit service) ─────────────────────────────
        this.leakService =
            this.accessory.getService(Svc.LeakSensor) ?? this.accessory.addService(Svc.LeakSensor);
        this.leakService.setCharacteristic(Char.Name, accessory.displayName);
        this.leakService
            .getCharacteristic(Char.LeakDetected)
            .onGet(this.handleLeakDetectedGet.bind(this));
        this.leakService
            .getCharacteristic(Char.StatusActive)
            .onGet(() => true);
        // ── Remove old Total Water characteristic if cached ───────────────────
        const oldTotalChar = this.leakService.characteristics.find((c) => c.UUID === 'E863F10C-079E-48FF-8F27-9C2605A29F52');
        if (oldTotalChar) {
            this.leakService.removeCharacteristic(oldTotalChar);
        }
        // ── Eve Consumption Characteristic ────────────────────────────────────
        this.eveConsumptionChar = this.addEveCharacteristic('Water Consumption', EVE_UUID_WATER_CONSUMPTION, "float" /* hap.Formats.FLOAT */, ["ev" /* hap.Perms.NOTIFY */, "pr" /* hap.Perms.PAIRED_READ */], 0, 1000000, 0.001);
        // ── Fakegato History Service ──────────────────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const FakeGatoHistoryService = require('fakegato-history')(platform.api);
        this.historyService = new FakeGatoHistoryService('energy', this.accessory, {
            log: platform.log,
            storage: 'fs',
            size: 4032,
        });
        // ── Start polling ─────────────────────────────────────────────────────
        this.poll();
        setInterval(() => this.poll(), this.pollIntervalMs);
    }
    addEveCharacteristic(displayName, uuid, format, perms, minValue, maxValue, minStep) {
        const { hap } = this.platform.api;
        const existing = this.leakService.characteristics.find((c) => c.UUID === uuid);
        if (existing) {
            return existing;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const props = { format, unit: 'gal', minValue, maxValue, minStep, perms };
        const char = new hap.Characteristic(displayName, uuid, props);
        char.setValue(0);
        this.leakService.addCharacteristic(char);
        return char;
    }
    handleLeakDetectedGet() {
        const { LEAK_DETECTED, LEAK_NOT_DETECTED } = this.platform.Characteristic.LeakDetected;
        if (!this.lastData) {
            return LEAK_NOT_DETECTED;
        }
        return this.lastData.daily.dailyUsage > this.leakThreshold
            ? LEAK_DETECTED
            : LEAK_NOT_DETECTED;
    }
    /** Log hourly entries to fakegato, skipping already-logged timestamps. */
    logHourlyHistory(hourly) {
        for (const entry of hourly) {
            if (this.lastLoggedTimestamps.has(entry.timestamp)) {
                continue;
            }
            this.historyService.addEntry({
                time: Math.floor(entry.timestamp / 1000),
                power: entry.usage,
            });
            this.lastLoggedTimestamps.add(entry.timestamp);
        }
        // Keep only the last 48 hours of timestamps to avoid unbounded growth
        if (this.lastLoggedTimestamps.size > 48) {
            const sorted = [...this.lastLoggedTimestamps].sort((a, b) => a - b);
            const toRemove = sorted.slice(0, sorted.length - 48);
            for (const ts of toRemove) {
                this.lastLoggedTimestamps.delete(ts);
            }
        }
    }
    async poll() {
        this.platform.log.debug('Sensus Analytics: polling for new data...');
        const data = await this.apiClient.fetchData();
        if (!data) {
            this.platform.log.warn('Sensus Analytics: no data returned, will retry next interval');
            return;
        }
        this.lastData = data;
        const { daily, hourly } = data;
        const { LEAK_DETECTED, LEAK_NOT_DETECTED } = this.platform.Characteristic.LeakDetected;
        const isLeaking = daily.dailyUsage > this.leakThreshold;
        // Push updates to HomeKit
        this.leakService.updateCharacteristic(this.platform.Characteristic.LeakDetected, isLeaking ? LEAK_DETECTED : LEAK_NOT_DETECTED);
        // Update current consumption value
        this.eveConsumptionChar.updateValue(daily.dailyUsage);
        // Log hourly data to fakegato history for Eve graphs
        if (hourly.length > 0) {
            this.logHourlyHistory(hourly);
            this.platform.log.debug(`Logged ${hourly.length} hourly entries to history`);
        }
        // Log a summary
        const lastHour = hourly.at(-1);
        this.platform.log.info(`[${this.accessory.displayName}] ` +
            `daily=${daily.dailyUsage} ${daily.usageUnit} | ` +
            `billing=${daily.billingUsage} ${daily.usageUnit} | ` +
            `leak=${isLeaking}` +
            (lastHour ? ` | lastHourUsage=${lastHour.usage} | temp=${lastHour.temp}°F` : ''));
    }
}
exports.SensusWaterMeterAccessory = SensusWaterMeterAccessory;
//# sourceMappingURL=accessory.js.map