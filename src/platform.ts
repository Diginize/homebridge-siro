import {
    API,
    Characteristic,
    DynamicPlatformPlugin,
    Logger,
    PlatformAccessory,
    PlatformConfig,
    Service,
} from 'homebridge';

import {PLATFORM_NAME, PLUGIN_NAME, PluginConfig} from './settings';
import {RadioMotorPlatformAccessory} from './siro-roller-shutter-accessory';
import {BridgeConnector, Device, DeviceTypes, GetDeviceList, GetDeviceListAck} from '@diginize/siro-wifi';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class SiroHomebridgePlatform implements DynamicPlatformPlugin {
    public readonly config: PluginConfig;

    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

    // this is used to track restored cached accessories
    public readonly accessories: PlatformAccessory<AccessoryContext>[] = [];

    public readonly bridge: BridgeConnector;

    constructor(
        public readonly log: Logger,
        config: PlatformConfig,
        public readonly api: API,
    ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.config = config as any;

        this.bridge = new BridgeConnector({
            bridgeIp: this.config.bridgeIp,
            bridgeKey: this.config.bridgeKey,
        });

        this.log.debug('Finished initializing platform:', this.config.name);

        this.api.on('didFinishLaunching', () => this.discoverDevices());
        this.api.on('shutdown', () => this.bridge.closeConnection());
    }

    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory: PlatformAccessory<AccessoryContext>) {
        this.log.info('Loading accessory from cache:', accessory.displayName);

        // add the restored accessory to the accessories cache so we can track if it has already been registered
        this.accessories.push(accessory);
    }

    /**
     * This is an example method showing how to register discovered accessories.
     * Accessories must only be registered once, previously created accessories
     * must not be registered again to prevent "duplicate UUID" errors.
     */
    async discoverDevices() {
        this.log.debug('Start discovering devices');

        const devices = await this.getDevices();

        // remove old accessories
        for (const accessory of this.accessories) {
            // eslint-disable-next-line max-len
            const existingDevice = devices.find(device => this.api.hap.uuid.generate(`${device.deviceType}-${device.mac}`) === accessory.UUID);
            if (existingDevice) {
                continue;
            }

            this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            this.log.info('Removing existing accessory from cache:', accessory.displayName);
        }

        // restore and create new accessories
        for (const device of devices) {
            const uuid = this.api.hap.uuid.generate(`${device.deviceType}-${device.mac}`);
            const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

            if (existingAccessory) {
                // restore accessory
                this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

                this.createAccessory(device, uuid, existingAccessory);
                this.api.updatePlatformAccessories([existingAccessory]);
            } else {
                // create a new accessory
                const accessory = this.createAccessory(device, uuid);
                if (!accessory) {
                    continue;
                }

                this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            }
        }
    }

    private async getDevices(): Promise<Device[]> {
        try {
            const deviceList = await this.bridge.sendMessage<GetDeviceList, GetDeviceListAck>({
                msgID: `${Date.now()}`,
                msgType: 'GetDeviceList',
            });

            this.bridge.setToken(deviceList.token);

            return deviceList.data;
        } catch (e) {
            this.log.error(e, 'GetDevices');
            return [];
        }
    }

    // eslint-disable-next-line max-len
    private createAccessory(device: Device, uuid: string, existingAccessory?: PlatformAccessory<AccessoryContext>): PlatformAccessory<AccessoryContext> | null {
        let accessory: PlatformAccessory<AccessoryContext> | null = existingAccessory || null;
        let displayName: string;

        switch (device.deviceType) {
            case DeviceTypes.RadioMotor433Mhz:
                if (!existingAccessory) {
                    this.log.info('Adding new radio motor accessory:', device.mac);

                    displayName = `Radio Motor ${device.mac}`;
                    accessory = new this.api.platformAccessory(displayName, uuid);
                    accessory.context.device = device;
                    accessory.context.displayName = displayName;
                }

                new RadioMotorPlatformAccessory(this, accessory!);
                break;
        }

        return accessory;
    }
}

export interface AccessoryContext {
    device: Device;
    displayName: string;
}
