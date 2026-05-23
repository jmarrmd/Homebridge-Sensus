import { PlatformAccessory, CharacteristicValue, Service, Characteristic } from 'homebridge';
import { SensusAnalyticsPlatform } from './platform';
import { SensusAnalyticsApi, SensusData } from './sensusApi';

// Eve for HomeKit custom characteristic UUIDs for water meters
const EVE_UUID_WATER_CONSUMPTION = 'E863F10D-079E-48FF-8F27-9C2605A29F52'; // daily usage
const EVE_UUID_TOTAL_WATER = 'E863F10C-079E-48FF-8F27-9C2605A29F52';       // odometer / total

const DEFAULT_POLL_INTERVAL_MINUTES = 30;

export class SensusWaterMeterAccessory {
  private readonly leakService: Service;
  private readonly leakThreshold: number;
  private readonly pollIntervalMs: number;
  private readonly displayUnit: string;

  // Direct references to Eve custom characteristics to avoid UUID lookups on update
  private readonly eveConsumptionChar: Characteristic;
  private readonly eveTotalChar: Characteristic;

  private lastData: SensusData | null = null;

  constructor(
    private readonly platform: SensusAnalyticsPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly apiClient: SensusAnalyticsApi,
  ) {
    const { hap } = platform.api;
    const { Service: Svc, Characteristic: Char } = platform;

    this.leakThreshold = (platform.config.leakThreshold as number | undefined) ?? 150;
    this.pollIntervalMs =
      ((platform.config.pollInterval as number | undefined) ?? DEFAULT_POLL_INTERVAL_MINUTES) *
      60 *
      1000;
    this.displayUnit = (platform.config.displayUnit as string | undefined) ?? 'gal';

    // ── Accessory Information ─────────────────────────────────────────────
    this.accessory
      .getService(Svc.AccessoryInformation)!
      .setCharacteristic(Char.Manufacturer, 'Sensus')
      .setCharacteristic(Char.Model, 'Smart Water Meter')
      .setCharacteristic(
        Char.SerialNumber,
        (accessory.context.meterNumber as string | undefined) ?? 'Unknown',
      );

    // ── Leak Sensor (primary HomeKit service) ─────────────────────────────
    // Visible in Apple Home app as a leak sensor tile with alert notifications
    this.leakService =
      this.accessory.getService(Svc.LeakSensor) ?? this.accessory.addService(Svc.LeakSensor);

    this.leakService.setCharacteristic(Char.Name, accessory.displayName);

    this.leakService
      .getCharacteristic(Char.LeakDetected)
      .onGet(this.handleLeakDetectedGet.bind(this));

    this.leakService
      .getCharacteristic(Char.StatusActive)
      .onGet(() => true);

    // ── Eve Custom Characteristics ────────────────────────────────────────
    // These are shown in the Eve for HomeKit app as consumption graphs.
    // They are attached to the LeakSensor service so they share one accessory tile.

    this.eveConsumptionChar = this.addEveCharacteristic(
      'Water Consumption',
      EVE_UUID_WATER_CONSUMPTION,
      hap.Formats.FLOAT,
      [hap.Perms.NOTIFY, hap.Perms.PAIRED_READ],
      0, 1_000_000, 0.001,
    );

    this.eveTotalChar = this.addEveCharacteristic(
      'Total Water Consumption',
      EVE_UUID_TOTAL_WATER,
      hap.Formats.FLOAT,
      [hap.Perms.NOTIFY, hap.Perms.PAIRED_READ],
      0, 1_000_000_000, 0.001,
    );

    // ── Start polling ─────────────────────────────────────────────────────
    this.poll();
    setInterval(() => this.poll(), this.pollIntervalMs);
  }

  /**
   * Helper to get the conversion factor from the Sensus API unit to Gallons.
   */
  private getSensusUnitMultiplier(sensusUnit: string): number {
    const unit = sensusUnit.toUpperCase().trim();
    if (unit === 'CCF' || unit === 'HCF') {
      return 748.052; // 1 CCF = 748.052 Gallons
    }
    if (unit === 'CF' || unit === 'CUBIC_FOOT' || unit === 'CUBIC_FEET' || unit === 'CUBIC FEET') {
      return 7.48052; // 1 Cubic Foot = 7.48052 Gallons
    }
    if (unit === 'L' || unit === 'LITER' || unit === 'LITERS' || unit === 'LITRES') {
      return 0.264172; // 1 Liter = 0.264172 Gallons
    }
    return 1.0; // Default to 1 (already gallons or unknown)
  }

  /**
   * Converts a value in Gallons to the user's configured HomeKit display unit (gal or l).
   */
  private convertGallonsToDisplayUnit(gallons: number): number {
    if (this.displayUnit === 'l') {
      return gallons * 3.78541; // 1 Gallon = 3.78541 Liters
    }
    return gallons; // Default to Gallons
  }

  /**
   * Creates and registers a custom Characteristic on the LeakSensor service.
   * If the characteristic already exists (restored from cache), it is returned as-is.
   */
  private addEveCharacteristic(
    displayName: string,
    uuid: string,
    format: string,
    perms: string[],
    minValue: number,
    maxValue: number,
    minStep: number,
  ): Characteristic {
    const { hap } = this.platform.api;

    const existing = this.leakService.characteristics.find((c) => c.UUID === uuid);
    if (existing) {
      return existing;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props: any = { format, unit: this.displayUnit, minValue, maxValue, minStep, perms };
    const char = new hap.Characteristic(displayName, uuid, props);
    char.setValue(0);
    this.leakService.addCharacteristic(char);
    return char;
  }

  /** Called by HomeKit to read the current leak state. */
  private handleLeakDetectedGet(): CharacteristicValue {
    const { LEAK_DETECTED, LEAK_NOT_DETECTED } = this.platform.Characteristic.LeakDetected;

    if (!this.lastData) {
      return LEAK_NOT_DETECTED;
    }

    const multiplier = this.getSensusUnitMultiplier(this.lastData.daily.usageUnit);
    const dailyUsageGallons = this.lastData.daily.dailyUsage * multiplier;

    return dailyUsageGallons > this.leakThreshold
      ? LEAK_DETECTED
      : LEAK_NOT_DETECTED;
  }

  /** Fetch latest data from Sensus Analytics and push updates to HomeKit. */
  private async poll(): Promise<void> {
    this.platform.log.debug('Sensus Analytics: polling for new data...');

    const data = await this.apiClient.fetchData();
    if (!data) {
      this.platform.log.warn('Sensus Analytics: no data returned, will retry next interval');
      return;
    }

    this.lastData = data;
    const { daily, hourly } = data;
    const { LEAK_DETECTED, LEAK_NOT_DETECTED } = this.platform.Characteristic.LeakDetected;

    // Convert raw API values (which can be in CCF, CF, liters, etc.) to Gallons
    const multiplier = this.getSensusUnitMultiplier(daily.usageUnit);
    const dailyUsageGallons = daily.dailyUsage * multiplier;
    const odometerGallons = daily.odometer * multiplier;
    const billingUsageGallons = daily.billingUsage * multiplier;

    // Perform leak check in Gallons
    const isLeaking = dailyUsageGallons > this.leakThreshold;

    // Push leak status to HomeKit
    this.leakService.updateCharacteristic(
      this.platform.Characteristic.LeakDetected,
      isLeaking ? LEAK_DETECTED : LEAK_NOT_DETECTED,
    );

    // Convert from Gallons to configured display unit (gal or l)
    const dailyUsageDisplay = this.convertGallonsToDisplayUnit(dailyUsageGallons);
    const odometerDisplay = this.convertGallonsToDisplayUnit(odometerGallons);

    // Update custom Eve characteristics
    // - eveConsumptionChar (E863F10D, Current Power / Consumption in Watts) displays daily value
    this.eveConsumptionChar.updateValue(dailyUsageDisplay);
    // - eveTotalChar (E863F10C, Total Consumption in kWh) displays cumulative odometer
    // Multiply by 1000 because Eve app divides E863F10C by 1000 to show kWh
    this.eveTotalChar.updateValue(odometerDisplay * 1000);

    // Log a summary showing both raw units and HomeKit display units
    const lastHour = hourly.at(-1);
    this.platform.log.info(
      `[${this.accessory.displayName}] ` +
      `daily=${dailyUsageDisplay.toFixed(2)} ${this.displayUnit} (raw=${daily.dailyUsage} ${daily.usageUnit}) | ` +
      `odometer=${odometerDisplay.toFixed(2)} ${this.displayUnit} (raw=${daily.odometer} ${daily.usageUnit}) | ` +
      `billing=${billingUsageGallons.toFixed(2)} gal (raw=${daily.billingUsage} ${daily.usageUnit}) | ` +
      `leak=${isLeaking}` +
      (lastHour ? ` | lastHourUsage=${lastHour.usage} | temp=${lastHour.temp}°F` : ''),
    );
  }
}
