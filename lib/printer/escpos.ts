import { PrintableTransaction } from './types';

const ESC = 0x1B;
const GS = 0x1D;

const COMMANDS = {
  INIT: [ESC, 0x40],
  ALIGN_LEFT: [ESC, 0x61, 0],
  ALIGN_CENTER: [ESC, 0x61, 1],
  ALIGN_RIGHT: [ESC, 0x61, 2],
  BOLD_ON: [ESC, 0x45, 1],
  BOLD_OFF: [ESC, 0x45, 0],
  CUT: [GS, 0x56, 66, 0], // Feeds paper and cuts
  LF: [0x0A], // Line Feed
};

// Helper to format currency
const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { 
    style: 'decimal', 
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

// Helper to create a divider line
const createDivider = (width: number) => {
  return '-'.repeat(width);
};

// Helper to pad text for columns
// Example: "Item Name     10.000"
const formatLineItem = (name: string, price: string, width: number) => {
  const priceLen = price.length;
  const nameLen = width - priceLen - 1; // -1 for space
  
  if (nameLen < 1) return name + ' ' + price; // Fallback if too narrow

  let truncatedName = name;
  if (name.length > nameLen) {
    truncatedName = name.substring(0, nameLen);
  } else {
    truncatedName = name.padEnd(nameLen, ' ');
  }
  
  return truncatedName + ' ' + price;
};

export const generateReceipt = (
  tx: PrintableTransaction, 
  paperWidthChars: number = 32 // 32 for 58mm, 48 for 80mm
): number[] => {
  let buffer: number[] = [];

  const add = (bytes: number[]) => buffer.push(...bytes);
  const addText = (text: string) => {
    // Convert string to bytes (simple ASCII/UTF-8 for now)
    // For specific code pages (like CP437 for box drawing), we might need encoding
    // But standard ASCII is usually safe for basic receipts
    for (let i = 0; i < text.length; i++) {
      buffer.push(text.charCodeAt(i));
    }
  };
  const addLine = (text: string) => {
    addText(text);
    add(COMMANDS.LF);
  };

  // 1. Initialize
  add(COMMANDS.INIT);
  add(COMMANDS.ALIGN_CENTER);

  // 2. Header
  add(COMMANDS.BOLD_ON);
  addLine(tx.storeName);
  add(COMMANDS.BOLD_OFF);
  
  // Date & Number
  add(COMMANDS.ALIGN_LEFT); // Or Center
  add(COMMANDS.ALIGN_CENTER);
  addLine(new Date(tx.createdAt).toLocaleString('id-ID'));
  addLine(tx.number);
  addLine(createDivider(paperWidthChars));

  // 3. Info
  add(COMMANDS.ALIGN_LEFT);
  addLine(`Kasir: ${tx.cashierName}`);
  addLine(`Kategori: ${tx.customerCategory}`);
  addLine(createDivider(paperWidthChars));

  // 4. Items
  tx.items.forEach(item => {
    // Format: "ItemName xQty" then next line "Total" or inline?
    // Standard compact:
    // Item Name
    // 2 x 10.000        20.000
    
    addLine(item.name);
    
    const qtyPrice = `${item.qty} x ${formatMoney(item.unitPrice)}`;
    const lineTotal = formatMoney(item.lineTotal);
    
    addLine(formatLineItem(qtyPrice, lineTotal, paperWidthChars));
  });
  
  addLine(createDivider(paperWidthChars));

  // 5. Totals
  const addTotalLine = (label: string, value: number, isBold: boolean = false) => {
    if (isBold) add(COMMANDS.BOLD_ON);
    addLine(formatLineItem(label, formatMoney(value), paperWidthChars));
    if (isBold) add(COMMANDS.BOLD_OFF);
  };

  addTotalLine('Subtotal', tx.subtotal);
  if (tx.discountTotal > 0) {
    addTotalLine('Diskon', -tx.discountTotal);
  }
  addTotalLine('TOTAL', tx.total, true);
  
  addLine(createDivider(paperWidthChars));
  
  // 6. Payment
  addTotalLine(tx.paymentMethod, tx.paidAmount);
  addTotalLine('Kembali', tx.changeAmount);

  // 7. Footer
  add(COMMANDS.LF);
  add(COMMANDS.ALIGN_CENTER);
  addLine('Terima Kasih');
  addLine('Simpan struk ini sebagai');
  addLine('bukti pembayaran yang sah');
  
  // 8. Feed and Cut
  add(COMMANDS.LF);
  add(COMMANDS.LF);
  add(COMMANDS.LF); // Feed a bit
  // add(COMMANDS.CUT); // Some printers jam with CUT if not properly set up, use generic feed instead usually safer for mobile printers, but we'll include it.
  
  return buffer;
};
