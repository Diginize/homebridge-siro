import {AccessoryContext, SiroHomebridgePlatform} from './platform';
import {PlatformAccessory} from 'homebridge';
import {DeviceCommand, DeviceStatus, ReadDevice, ReadDeviceAck, WriteDevice, WriteDeviceAck} from '@diginize/siro-wifi';

export abstract class AbstractAccessory {

    protected status: DeviceStatus|undefined;
    protected lastStatusUpdate: number|undefined;

    protected constructor(
        protected readonly platform: SiroHomebridgePlatform,
        protected readonly accessory: PlatformAccessory<AccessoryContext>,
    ) {
        // set accessory information
        this.accessory.getService(this.platform.Service.AccessoryInformation)!
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Siro')
            .setCharacteristic(this.platform.Characteristic.Model, this.accessory.context.device.deviceType)
            .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.context.device.mac);

        this.updateStatus();
    }

    protected async updateStatus(): Promise<void> {
        // Update max. every 0.5 seconds
        if (this.lastStatusUpdate && (Date.now() - this.lastStatusUpdate) < 500) {
            return;
        }

        const statusResponse = await this.platform.bridge.sendMessage<ReadDevice, ReadDeviceAck>({
            msgID: `${Date.now()}`,
            msgType: 'ReadDevice',
            mac: this.accessory.context.device.mac,
            deviceType: this.accessory.context.device.deviceType,
        });

        this.status = statusResponse.data;
        this.lastStatusUpdate = Date.now();
    }

    protected async sendCommand(command: DeviceCommand): Promise<DeviceStatus> {
        const statusResponse = await this.platform.bridge.sendMessage<WriteDevice, WriteDeviceAck>({
            msgID: `${Date.now()}`,
            msgType: 'WriteDevice',
            mac: this.accessory.context.device.mac,
            deviceType: this.accessory.context.device.deviceType,
            AccessToken: this.platform.bridge.getAccessToken(),
            data: command
        });

        return statusResponse.data;
    }

}
