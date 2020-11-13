import {PlatformAccessory, Service} from 'homebridge';

import {AccessoryContext, SiroHomebridgePlatform} from './platform';
import {AbstractAccessory} from './abstract-accessory';
import {Operations, VoltageModes} from '@diginize/siro-wifi';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class RadioMotorPlatformAccessory extends AbstractAccessory {
  private windowCoverService: Service|undefined;
  private batteryService: Service|undefined;

  constructor(
    platform: SiroHomebridgePlatform,
    accessory: PlatformAccessory<AccessoryContext>,
  ) {
    super(platform, accessory);

    this.setupWindowCoverService();
    this.setupBatteryService();
  }

  protected setupWindowCoverService(): void {
    this.windowCoverService = this.accessory.getService(this.platform.Service.WindowCovering) || this.accessory.addService(this.platform.Service.WindowCovering);

    this.windowCoverService.setCharacteristic(this.platform.Characteristic.Name, this.accessory.context.displayName);

    this.windowCoverService.getCharacteristic(this.platform.Characteristic.CurrentPosition)
        .on('get', this.handleCurrentPositionGet.bind(this));

    this.windowCoverService.getCharacteristic(this.platform.Characteristic.TargetPosition)
        .on('get', this.handleTargetPositionGet.bind(this))
        .on('set', this.handleTargetPositionSet.bind(this));

    this.windowCoverService.getCharacteristic(this.platform.Characteristic.PositionState)
        .on('get', this.handlePositionStateGet.bind(this));
  }

  protected async setupBatteryService(): Promise<void> {
    // check if service is available
    await this.updateStatus();
    if (this.status?.voltageMode !== VoltageModes.DcMotor && !this.status?.batteryLevel) {
      return;
    }

    // register service
    this.batteryService = this.accessory.getService(this.platform.Service.BatteryService) || this.accessory.addService(this.platform.Service.BatteryService);

    this.batteryService.getCharacteristic(this.platform.Characteristic.BatteryLevel)
        .on('get', this.handleBatteryLevelGet.bind(this));

    this.batteryService.getCharacteristic(this.platform.Characteristic.ChargingState)
        .on('get', this.handleChargingStateGet.bind(this));

    this.batteryService.getCharacteristic(this.platform.Characteristic.StatusLowBattery)
        .on('get', this.handleStatusLowBatteryGet.bind(this));
  }

  async handleCurrentPositionGet(callback) {
    this.platform.log.debug('Triggered GET CurrentPosition');

    await this.updateStatus();
    callback(null, this.status?.currentPosition || 0);
  }

  async handleTargetPositionGet(callback) {
    this.platform.log.debug('Triggered GET TargetPosition');

    await this.updateStatus();
    callback(null, this.status?.currentPosition || 0);
  }

  async handleTargetPositionSet(value, callback) {
    this.platform.log.debug('Triggered SET TargetPosition:' + value);

    await this.sendCommand({
      targetPosition: value
    });
    callback(null);
  }

  async handlePositionStateGet(callback) {
    this.platform.log.debug('Triggered GET PositionState');

    await this.updateStatus();
    let status: number;
    switch (this.status?.operation) {
      case Operations.OpenUp:
        status = this.platform.Characteristic.PositionState.DECREASING;
        break;

      case Operations.CloseDown:
        status = this.platform.Characteristic.PositionState.INCREASING;
        break;

      default:
        status = this.platform.Characteristic.PositionState.STOPPED;
    }

    callback(null, status);
  }

  async handleBatteryLevelGet(callback) {
    this.platform.log.debug('Triggered GET BatteryLevel');

    await this.updateStatus();
    callback(null, this.status?.batteryLevel || 0);
  }

  async handleChargingStateGet(callback) {
    this.platform.log.debug('Triggered GET ChargingState');
    callback(null, this.platform.Characteristic.ChargingState.NOT_CHARGING);
  }

  async handleStatusLowBatteryGet(callback) {
    this.platform.log.debug('Triggered GET StatusLowBattery');

    await this.updateStatus();
    const batteryLevel = this.status?.batteryLevel || 1000;

    callback(null, batteryLevel < 200 ? this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
  }

}
