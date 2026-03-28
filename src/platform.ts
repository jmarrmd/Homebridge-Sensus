import {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { SensusWaterMeterAccessory } from './accessory';
import { SensusAnalyticsApi } from './sensusApi';

export class SensusAnalyticsPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // Restored cached accessories from disk
  public readonly cachedAccessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    this.log.debug('Sensus Analytics platform initialising');

    this.api.on('didFinishLaunching', () => {
      this.discoverDevices();
    });
  }

  /** Called by Homebridge to restore cached accessories on startup. */
  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('Restoring cached accessory:', accessory.displayName);
    this.cachedAccessories.push(accessory);
  }

  private discoverDevices(): void {
    const { baseUrl, username, password, accountNumber, meterNumber } = this.config;

    if (!baseUrl || !username || !password || !accountNumber || !meterNumber) {
      this.log.error(
        'Sensus Analytics: missing required config fields ' +
        '(baseUrl, username, password, accountNumber, meterNumber)',
      );
      return;
    }

    const apiClient = new SensusAnalyticsApi(
      baseUrl,
      username,
      password,
      accountNumber,
      meterNumber,
      this.log,
    );

    const displayName = (this.config.name as string | undefined) || 'Sensus Water Meter';
    const uuid = this.api.hap.uuid.generate(`sensus-${meterNumber}`);

    const existing = this.cachedAccessories.find((a) => a.UUID === uuid);

    if (existing) {
      this.log.info('Restoring water meter accessory:', existing.displayName);
      new SensusWaterMeterAccessory(this, existing, apiClient);
    } else {
      this.log.info('Adding new water meter accessory:', displayName);
      const accessory = new this.api.platformAccessory(displayName, uuid);
      accessory.context.meterNumber = meterNumber;
      new SensusWaterMeterAccessory(this, accessory, apiClient);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
  }
}
