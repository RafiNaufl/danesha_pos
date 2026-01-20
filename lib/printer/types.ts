export interface BluetoothDevice {
  name: string;
  address: string; // MAC address
  id: string;      // Android often uses MAC as ID
  class?: number;
}

export interface PrinterStatus {
  isConnected: boolean;
  isConnecting: boolean;
  lastError: string | null;
  connectedDevice: BluetoothDevice | null;
}

// Minimal Snapshot Interface required for printing
// Based on the Prisma Model and "Snapshot" requirement
export interface PrintableTransactionItem {
  name: string;
  qty: number;
  unitPrice: number; // Snapshot value
  lineTotal: number; // Snapshot value
}

export interface PrintableTransaction {
  id: string;
  number: string;
  createdAt: Date | string;
  cashierName: string;
  customerCategory: string;
  storeName: string; // From settings
  
  items: PrintableTransactionItem[];
  
  subtotal: number;
  discountTotal: number;
  total: number;
  
  paymentMethod: string;
  paidAmount: number;
  changeAmount: number;
}
