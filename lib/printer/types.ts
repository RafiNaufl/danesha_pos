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

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
  discountType?: 'PERCENT' | 'NOMINAL' | null;
  discountPercent?: number;
  discountAmount?: number;
}

export interface ReceiptData {
  storeName: string;
  storeAddress: string;
  storePhone?: string;
  transactionId: string;
  date: string;
  cashierName: string;
  
  // Member Info
  memberName?: string;
  memberStatus?: string; // e.g., "Gold", "Silver", or "Non-Member"

  items: ReceiptItem[];
  
  // Totals
  subtotal: number;
  discountTotal: number;
  tax: number;
  total: number;
  
  // Payment
  paymentMethod?: string;
  paidAmount?: number;
  changeAmount?: number;
  
  footerMessage: string;
}
