import { BluetoothDevice, PrinterStatus } from './types';
import { Capacitor } from '@capacitor/core';

// Declare the interface for the plugin
// capacitor-bluetooth-serial usually exposes itself on window.BluetoothSerial or via import
// Since it's a Cordova plugin wrapped for Capacitor, it's often on window
declare global {
  interface Window {
    BluetoothSerial?: {
      isEnabled: (success: any, failure: any) => void;
      list: (success: any, failure: any) => void;
      discoverUnpaired: (success: any, failure: any) => void;
      connect: (macAddress: string, success: any, failure: any) => void;
      disconnect: (success: any, failure: any) => void;
      write: (data: any, success: any, failure: any) => void;
      isConnected: (success: any, failure: any) => void;
    };
  }
}

class BluetoothPrinterService {
  private static instance: BluetoothPrinterService;
  private connectedDevice: BluetoothDevice | null = null;
  
  private constructor() {}

  public static getInstance(): BluetoothPrinterService {
    if (!BluetoothPrinterService.instance) {
      BluetoothPrinterService.instance = new BluetoothPrinterService();
    }
    return BluetoothPrinterService.instance;
  }

  // Check if Bluetooth is enabled
  async isEnabled(): Promise<boolean> {
    if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) return true;

    return new Promise((resolve) => {
      if (!window.BluetoothSerial) {
        console.warn('BluetoothSerial plugin not loaded');
        resolve(false);
        return;
      }
      window.BluetoothSerial.isEnabled(
        () => resolve(true),
        () => resolve(false)
      );
    });
  }

  // Scan for devices
  async scan(): Promise<BluetoothDevice[]> {
    console.log('Scanning for bluetooth devices...');
    
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      return new Promise((resolve, reject) => {
        if (!window.BluetoothSerial) {
          reject(new Error('Bluetooth plugin missing'));
          return;
        }

        // List paired devices first
        window.BluetoothSerial.list(
          (paired: any[]) => {
            // Also scan for unpaired? It takes longer. 
            // For now let's return paired devices as they are most stable for POS.
            // If needed, we can chain discoverUnpaired()
            const devices = paired.map(d => ({
              name: d.name,
              address: d.address,
              id: d.address,
              class: d.class
            }));
            resolve(devices);
          },
          (err: any) => reject(err)
        );
      });
    }
    
    // Mock data for browser
    return new Promise(resolve => setTimeout(() => resolve([
      { name: 'Thermal Printer 58 (Mock)', address: '00:11:22:33:44:55', id: '00:11:22:33:44:55' },
      { name: 'RPP02N (Mock)', address: 'AA:BB:CC:DD:EE:FF', id: 'AA:BB:CC:DD:EE:FF' }
    ]), 1000));
  }

  // Connect to a device
  async connect(address: string): Promise<boolean> {
    console.log(`Connecting to ${address}...`);
    
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      return new Promise((resolve, reject) => {
        if (!window.BluetoothSerial) return reject('Plugin missing');
        
        window.BluetoothSerial.connect(
          address,
          () => {
            this.connectedDevice = { name: 'Printer', address, id: address };
            resolve(true);
          },
          (err: any) => reject(err)
        );
      });
    }

    // Mock
    return new Promise(resolve => setTimeout(() => {
        this.connectedDevice = { name: 'Mock Printer', address, id: address };
        resolve(true);
    }, 1500));
  }

  // Disconnect
  async disconnect(): Promise<boolean> {
    if (Capacitor.isNativePlatform() && window.BluetoothSerial) {
      return new Promise(resolve => {
        window.BluetoothSerial!.disconnect(
          () => {
            this.connectedDevice = null;
            resolve(true);
          }, 
          () => resolve(false)
        );
      });
    }
    
    this.connectedDevice = null;
    return true;
  }

  // Write data
  async write(data: number[]): Promise<boolean> {
    if (!this.connectedDevice) {
        throw new Error('No printer connected');
    }
    
    if (Capacitor.isNativePlatform()) {
      return new Promise((resolve, reject) => {
        if (!window.BluetoothSerial) return reject('Plugin missing');
        
        // BluetoothSerial expects array or string.
        window.BluetoothSerial.write(
          data,
          () => resolve(true),
          (err: any) => reject(err)
        );
      });
    }
    
    console.log('Writing bytes to printer:', data.length, 'bytes');
    return true;
  }

  // Check connection status
  async isConnected(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      return new Promise(resolve => {
        if (!window.BluetoothSerial) return resolve(false);
        window.BluetoothSerial.isConnected(
          () => resolve(true),
          () => resolve(false)
        );
      });
    }
    return !!this.connectedDevice;
  }

  getConnectedDevice(): BluetoothDevice | null {
    return this.connectedDevice;
  }
}

export const printerService = BluetoothPrinterService.getInstance();
