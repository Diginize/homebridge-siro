import {AccessoryContext, SiroHomebridgePlatform} from './platform';
import {PlatformAccessory} from 'homebridge';
import {DeviceCommand, DeviceStatus, ReadDevice, ReadDeviceAck, WriteDevice, WriteDeviceAck} from '@diginize/siro-wifi';

export abstract class AbstractAccessory {

    protected status: DeviceStatus | undefined;
    protected statusUpdateInProgress = false;
    protected lastStatusUpdate: number | undefined;

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
        if (this.statusUpdateInProgress) {
            return;
        }
        this.statusUpdateInProgress = true;

        // Update max. every 0.5 seconds
        if (this.lastStatusUpdate && (Date.now() - this.lastStatusUpdate) < 1000) {
            this.statusUpdateInProgress = false;
            return;
        }

        try {
            const statusResponse = await this.platform.bridge.sendMessage<ReadDevice, ReadDeviceAck>({
                msgID: `${Date.now()}`,
                msgType: 'ReadDevice',
                mac: this.accessory.context.device.mac,
                deviceType: this.accessory.context.device.deviceType,
            });

            this.platform.log.debug('ReadDevice Response', statusResponse);
            this.status = statusResponse.data;
            this.lastStatusUpdate = Date.now();
        } catch (e) {
            // catch timeout
            this.platform.log.error('Request Timeout (ReadDevice)', this.accessory.context.device.mac);
        } finally {
            this.statusUpdateInProgress = false;
        }
    }

    protected async sendCommand(command: DeviceCommand): Promise<void> {
        try {
            const statusResponse = await this.platform.bridge.sendMessage<WriteDevice, WriteDeviceAck>({
                msgID: `${Date.now()}`,
                msgType: 'WriteDevice',
                mac: this.accessory.context.device.mac,
                deviceType: this.accessory.context.device.deviceType,
                AccessToken: this.platform.bridge.getAccessToken(),
                data: command,
            });

            this.platform.log.debug('WriteDevice Response', statusResponse);
            this.status = statusResponse.data;
            this.lastStatusUpdate = Date.now();
        } catch (e) {
            // catch timeout
            this.platform.log.error('Request Timeout (ReadDevice)', this.accessory.context.device.mac);
        }
    }

}
