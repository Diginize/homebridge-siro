import {PlatformAccessory, Service} from 'homebridge';

import {AccessoryContext, SiroHomebridgePlatform} from './platform';
import {AbstractAccessory} from './abstract-accessory';
import {VoltageModes} from '@diginize/siro-wifi';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class RadioMotorPlatformAccessory extends AbstractAccessory {
    private windowCoverService: Service | undefined;
    private batteryService: Service | undefined;

    private targetPosition = 0;
    private lastTargetUpdate = 0;

    constructor(
        platform: SiroHomebridgePlatform,
        accessory: PlatformAccessory<AccessoryContext>,
    ) {
        super(platform, accessory);

        this.setupWindowCoverService();
        this.setupBatteryService();
    }

    protected setupWindowCoverService(): void {
        // eslint-disable-next-line max-len
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
        // eslint-disable-next-line max-len
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
        const status = 100 - (this.status?.currentPosition || 0);
        this.platform.log.info('GET CurrentPosition:', status);
        callback(null, status);
    }

    async handleTargetPositionGet(callback) {
        this.platform.log.info('Triggered GET TargetPosition');

        let status = this.targetPosition;
        if (
            this.targetPosition !== 100 - (this.status?.currentPosition || 0) &&
            Math.abs((this.lastStatusUpdate || 0) - this.lastTargetUpdate) > 30000
        ) {
            status = 100 - (this.status?.currentPosition || 0);
        }

        this.platform.log.info('GET TargetPosition:', status);
        callback(null, status);
    }

    async handleTargetPositionSet(value, callback) {
        this.platform.log.info('Triggered SET TargetPosition:' + value);
        this.targetPosition = value;
        this.lastTargetUpdate = Date.now();

        this.sendCommand({
            targetPosition: 100 - value,
        });
        callback(null);
    }

    async handlePositionStateGet(callback) {
        this.platform.log.debug('Triggered GET PositionState');
        callback(null, this.platform.Characteristic.PositionState.STOPPED);
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

        // eslint-disable-next-line max-len
        callback(null, batteryLevel < 200 ? this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
    }

}
