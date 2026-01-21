import { BluetoothDevice, PrinterStatus, ReceiptData } from './types';
import { Capacitor, registerPlugin } from '@capacitor/core';

// Define the custom plugin interface
interface BluetoothPrinterPlugin {
  scan(): Promise<{ devices: { name: string; address: string; id: string }[] }>;
  print(options: { macAddress: string; data: ReceiptData }): Promise<{
    status: 'SUCCESS' | 'FAILED' | 'BUSY';
    message: string;
    printerConnected: boolean;
    canRetry: boolean;
    telemetry?: {
      connectTime: number;
      printTime: number;
      bytes: number;
    };
  }>;
}

// Register the plugin
const BluetoothPrinter = registerPlugin<BluetoothPrinterPlugin>('BluetoothPrinter');

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
  // The native plugin checks this internally during scan/print, but we can expose a check if needed.
  // For now, we'll assume true or let the specific actions fail.
  async isEnabled(): Promise<boolean> {
    return true; 
  }

  // Scan for devices
  async scan(): Promise<BluetoothDevice[]> {
    console.log('Scanning for bluetooth devices...');
    
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await BluetoothPrinter.scan();
        return result.devices.map(d => ({
          name: d.name,
          address: d.address,
          id: d.id || d.address
        }));
      } catch (e) {
        console.error('Scan failed:', e);
        throw e;
      }
    }
    
    // Mock data for browser
    return new Promise(resolve => setTimeout(() => resolve([
      { name: 'Thermal Printer 58 (Mock)', address: '00:11:22:33:44:55', id: '00:11:22:33:44:55' },
      { name: 'RPP02N (Mock)', address: 'AA:BB:CC:DD:EE:FF', id: 'AA:BB:CC:DD:EE:FF' }
    ]), 1000));
  }

  // Connect to a device (Logically select it)
  async connect(address: string): Promise<boolean> {
    console.log(`Selecting printer ${address}...`);
    
    // In our new stateless architecture, "connecting" just means selecting the target MAC address.
    // The actual connection happens during print.
    // We can verify if the device exists in paired list if we want, but simple selection is fine.
    
    this.connectedDevice = { name: 'Printer', address, id: address };
    
    // If native, we could verify it exists or is bonded, but for now we trust the MAC.
    return true;
  }

  // Disconnect (Logically deselect)
  async disconnect(): Promise<boolean> {
    this.connectedDevice = null;
    return true;
  }

  // Print Receipt (New Method)
  async printReceipt(data: ReceiptData): Promise<{ success: boolean; message: string }> {
    if (!this.connectedDevice) {
      throw new Error('No printer selected');
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const result = await BluetoothPrinter.print({
          macAddress: this.connectedDevice.address,
          data: data
        });
        
        if (result.status === 'SUCCESS' || result.status === 'BUSY') {
             // BUSY means "already printed" (idempotency), so we treat it as success for the UI
             return { success: true, message: result.message };
        } else {
             throw new Error(result.message);
        }
      } catch (e: any) {
        console.error('Native print failed:', e);
        throw new Error(e.message || 'Failed to print');
      }
    } else {
      // Browser Mock
      console.log('Printing Receipt (Mock):', data);
      return new Promise(resolve => setTimeout(() => resolve({ success: true, message: 'Printed (Mock)' }), 1000));
    }
  }

  // Deprecated: Write raw bytes (Kept for compatibility if any other code uses it, but implementation changed)
  async write(data: number[]): Promise<boolean> {
    console.warn('write() is deprecated. Use printReceipt() instead.');
    // We cannot support raw byte writing with the new high-level plugin.
    // Throw error to force migration.
    throw new Error('Raw byte writing is not supported. Use printReceipt() with structured data.');
  }

  // Check connection status
  async isConnected(): Promise<boolean> {
    return !!this.connectedDevice;
  }

  getConnectedDevice(): BluetoothDevice | null {
    return this.connectedDevice;
  }
}

export const printerService = BluetoothPrinterService.getInstance();
