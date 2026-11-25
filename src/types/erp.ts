export type BatteryBrand =
  | 'Exide'
  | 'AGS'
  | 'Phoenix'
  | 'Osaka'
  | 'Daewoo'
  | 'Volta'
  | 'Other';

export type BatteryCategory =
  | 'Tubular'
  | 'Dry / MF'
  | 'Lead-Acid Auto'
  | 'Solar Deep Cycle'
  | 'UPS / Inverter';

export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: BatteryBrand;
  category: BatteryCategory;
  voltage: string;
  capacityAh: number;
  purchasePrice: number;
  salePrice: number;
  stockQty: number;
  minStockAlert: number;
  location: string;
  warrantyMonths: number;
}

export type PartyRole = 'CUSTOMER' | 'SUPPLIER' | 'BOTH';

export interface Party {
  id: string;
  name: string;
  phone: string;
  area: string;
  role: PartyRole;
  /** Positive = Lene Hain (Receivable from party), Negative = Dene Hain (Payable to party) */
  balance: number;
  notes?: string;
  createdAt: string;
}

export type AccountType = 'CASH' | 'BANK' | 'WALLET';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  accountNumber: string;
  balance: number;
}

export type InvoiceType = 'SALE_OUT' | 'PURCHASE_IN';
export type PaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID';

export interface InvoiceItem {
  productId: string;
  sku: string;
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  type: InvoiceType;
  date: string; // YYYY-MM-DD
  createdAt: string;
  partyId: string;
  partyName: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentPercent: number;
  status: PaymentStatus;
  accountId?: string;
  dueDate?: string;
  notes?: string;
}

export interface StockMovement {
  id: string;
  date: string;
  createdAt: string;
  productId: string;
  productName: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  qtyChange: number;
  resultingQty: number;
  referenceType: 'INVOICE' | 'MANUAL';
  referenceId?: string;
  note: string;
}

export type CashCategory =
  | 'SALE_RECEIPT'
  | 'UDHAAR_RECOVERY'
  | 'PURCHASE_PAYMENT'
  | 'SUPPLIER_PAYMENT'
  | 'SCRAP_BUY'
  | 'TRANSFER'
  | 'EXPENSE';

export interface CashTransaction {
  id: string;
  date: string;
  createdAt: string;
  direction: 'IN' | 'OUT' | 'TRANSFER';
  accountId: string;
  toAccountId?: string;
  amount: number;
  partyId?: string;
  partyName?: string;
  category: CashCategory;
  referenceId?: string;
  note: string;
}

export interface ScrapPurchase {
  id: string;
  receiptNo: string;
  date: string;
  createdAt: string;
  scrapName: string;
  weightKg: number;
  pieceCount?: number;
  ratePerKg: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: PaymentStatus;
  partyId?: string;
  sellerName: string;
  accountId?: string;
  notes?: string;
}

export interface ErpDatabase {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  products: Product[];
  parties: Party[];
  accounts: Account[];
  invoices: Invoice[];
  stockMovements: StockMovement[];
  cashTransactions: CashTransaction[];
  scrapPurchases: ScrapPurchase[];
}

export interface CreateInvoiceInput {
  type: InvoiceType;
  date: string;
  partyId: string;
  items: {
    productId: string;
    qty: number;
    unitPrice: number;
  }[];
  discount: number;
  paidAmount: number;
  accountId?: string;
  dueDate?: string;
  notes?: string;
}

export interface RecordPaymentInput {
  date: string;
  direction: 'IN' | 'OUT';
  partyId: string;
  accountId: string;
  amount: number;
  invoiceId?: string;
  note?: string;
}

export interface TransferFundsInput {
  date: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  note?: string;
}

export interface CreateScrapInput {
  date: string;
  scrapName: string;
  weightKg: number;
  pieceCount?: number;
  ratePerKg: number;
  paidAmount: number;
  partyId?: string;
  sellerName: string;
  accountId?: string;
  notes?: string;
}

export interface DayEndSummary {
  date: string;
  salesCount: number;
  totalSalesBilled: number;
  salesCashCollected: number;
  salesUdhaarAdded: number;
  purchasesCount: number;
  totalPurchasesBilled: number;
  purchasesPaid: number;
  purchasesPayableAdded: number;
  scrapCount: number;
  scrapTotalKg: number;
  scrapTotalAmount: number;
  scrapPaidAmount: number;
  scrapPayableAdded: number;
  udhaarRecoveredToday: number;
  supplierPaidToday: number;
  totalMoneyInToday: number;
  totalMoneyOutToday: number;
  netCashFlowToday: number;
  accountFlows: {
    accountId: string;
    accountName: string;
    moneyIn: number;
    moneyOut: number;
    netFlow: number;
    currentBalance: number;
  }[];
  partialInvoicesToday: Invoice[];
  allOpenPartialInvoices: Invoice[];
}
