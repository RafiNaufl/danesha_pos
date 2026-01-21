'use client';

import React, { useState, useEffect } from 'react';
import { printerService } from '@/lib/printer/bluetooth';
import { BluetoothDevice } from '@/lib/printer/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Printer, RefreshCw, Check, X, Bluetooth } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const PREFERRED_PRINTER_KEY = 'pos_preferred_printer_mac';

export function PrinterConnect({ mobile }: { mobile?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);

  // Initial check and auto-connect
  useEffect(() => {
    checkConnection();
    const savedMac = localStorage.getItem(PREFERRED_PRINTER_KEY);
    if (savedMac && !connectedDevice) {
      handleAutoConnect(savedMac);
    }
  }, []);

  const checkConnection = async () => {
    const isConn = await printerService.isConnected();
    if (isConn) {
      setConnectedDevice(printerService.getConnectedDevice());
    }
  };

  const handleAutoConnect = async (mac: string) => {
    setIsConnecting(true);
    try {
      // In a real scenario, we might need to scan first or just connect directly if supported
      // Assuming direct connect is possible with MAC
      await printerService.connect(mac);
      setConnectedDevice(printerService.getConnectedDevice());
    } catch (e) {
      console.error('Auto-connect failed', e);
    } finally {
      setIsConnecting(false);
    }
  };

  const scanDevices = async () => {
    setIsScanning(true);
    setDevices([]);
    try {
      const results = await printerService.scan();
      setDevices(results);
    } catch (e) {
      console.error('Scan failed', e);
      alert('Failed to scan for Bluetooth devices');
    } finally {
      setIsScanning(false);
    }
  };

  const connectToDevice = async (device: BluetoothDevice) => {
    setIsConnecting(true);
    try {
      await printerService.connect(device.address);
      setConnectedDevice(device);
      localStorage.setItem(PREFERRED_PRINTER_KEY, device.address);
      setIsOpen(false);
    } catch (e) {
      console.error('Connection failed', e);
      alert('Failed to connect to printer');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    await printerService.disconnect();
    setConnectedDevice(null);
    // Optional: Don't clear local storage so it tries to reconnect next time
    // localStorage.removeItem(PREFERRED_PRINTER_KEY); 
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {mobile ? (
           <button className="w-full flex items-center gap-3 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 transition min-h-[48px]">
             <div className={cn("p-2 rounded-full", connectedDevice ? "bg-green-100 text-green-600" : "bg-neutral-200 text-neutral-500")}>
                <Printer size={20} />
             </div>
             <div className="flex flex-col items-start">
               <span className="font-medium">Printer Connection</span>
               <span className="text-xs text-neutral-500">
                 {connectedDevice ? connectedDevice.name : 'Cek Printer'}
               </span>
             </div>
             {connectedDevice && <Check size={16} className="ml-auto text-green-500" />}
           </button>
        ) : (
          <Button variant={connectedDevice ? "outline" : "destructive"} size="sm" className="gap-2">
            <Printer size={16} />
            {connectedDevice ? (
              <span>{connectedDevice.name}</span>
            ) : (
              <span>Cek Printer</span>
            )}
            {connectedDevice && <div className="w-2 h-2 rounded-full bg-green-500" />}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bluetooth Printer</DialogTitle>
          <DialogDescription>Connect to a thermal printer for auto-printing receipts.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${connectedDevice ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                <Bluetooth size={20} />
              </div>
              <div>
                <p className="font-medium">{connectedDevice ? 'Connected' : 'Disconnected'}</p>
                {connectedDevice && <p className="text-sm text-slate-500">{connectedDevice.name}</p>}
              </div>
            </div>
            {connectedDevice && (
              <Button variant="ghost" size="sm" onClick={disconnect}>
                Disconnect
              </Button>
            )}
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Available Devices</h4>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={scanDevices} 
                disabled={isScanning}
              >
                {isScanning ? <RefreshCw className="animate-spin h-4 w-4" /> : 'Scan'}
              </Button>
            </div>

            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {devices.length === 0 && !isScanning && (
                <p className="text-sm text-slate-400 text-center py-4">No devices found. Make sure printer is on and paired in system settings.</p>
              )}
              
              {devices.map((device) => (
                <div 
                  key={device.id} 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => connectToDevice(device)}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{device.name || 'Unknown Device'}</span>
                    <span className="text-xs text-slate-400">{device.address}</span>
                  </div>
                  {connectedDevice?.address === device.address && (
                    <Check size={16} className="text-green-500" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
