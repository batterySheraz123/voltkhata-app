import type {
  CreateInvoiceInput,
  CreateScrapInput,
  DayEndSummary,
  ErpDatabase,
  Invoice,
  InvoiceItem,
  PaymentStatus,
  Product,
  RecordPaymentInput,
  ScrapPurchase,
  TransferFundsInput,
} from '../types/erp';

export function formatPKR(amount: number): string {
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toLocaleString('en-PK');
  return amount < 0 ? `-Rs. ${formatted}` : `Rs. ${formatted}`;
}

export function formatKg(weightKg: number): string {
  return `${Number(weightKg).toLocaleString('en-PK', {
    minimumFractionDigits: weightKg % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  })} kg`;
}

export function computePaymentBreakdown(totalAmount: number, paidAmount: number): {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentPercent: number;
  status: PaymentStatus;
} {
  const cleanTotal = Math.max(0, Math.round(totalAmount));
  const cleanPaid = Math.min(cleanTotal, Math.max(0, Math.round(paidAmount)));
  const remaining = Math.max(0, cleanTotal - cleanPaid);
  const percent = cleanTotal === 0 ? 100 : Math.round((cleanPaid / cleanTotal) * 100);
  let status: PaymentStatus = 'UNPAID';
  if (remaining === 0 && cleanTotal > 0) {
    status = 'PAID';
  } else if (cleanPaid > 0 && remaining > 0) {
    status = 'PARTIAL';
  }
  return {
    totalAmount: cleanTotal,
    paidAmount: cleanPaid,
    remainingAmount: remaining,
    paymentPercent: percent,
    status,
  };
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function applyInvoice(
  db: ErpDatabase,
  input: CreateInvoiceInput
): { db: ErpDatabase; invoice: Invoice } {
  const party = db.parties.find((p) => p.id === input.partyId);
  if (!party) {
    throw new Error('Selected party was not found.');
  }
  if (!input.items || input.items.length === 0) {
    throw new Error('Invoice must contain at least one battery item.');
  }

  const nowIso = new Date().toISOString();
  const nextProducts = db.products.map((p) => ({ ...p }));
  const newMovements = [...db.stockMovements];
  const resolvedItems: InvoiceItem[] = [];

  for (const rawItem of input.items) {
    if (rawItem.qty <= 0 || !Number.isFinite(rawItem.qty)) {
      throw new Error('Item quantity must be greater than zero.');
    }
    if (rawItem.unitPrice < 0 || !Number.isFinite(rawItem.unitPrice)) {
      throw new Error('Unit price cannot be negative.');
    }

    const product = nextProducts.find((p) => p.id === rawItem.productId);
    if (!product) {
      throw new Error(`Battery item (${rawItem.productId}) not found in inventory.`);
    }

    if (input.type === 'SALE_OUT' && product.stockQty < rawItem.qty) {
      throw new Error(
        `Insufficient stock for ${product.name}. Available: ${product.stockQty}, requested: ${rawItem.qty}.`
      );
    }

    const qtyDelta = input.type === 'SALE_OUT' ? -rawItem.qty : rawItem.qty;
    product.stockQty += qtyDelta;

    if (input.type === 'PURCHASE_IN' && rawItem.unitPrice > 0) {
      product.purchasePrice = Math.round(rawItem.unitPrice);
    }

    const lineTotal = Math.round(rawItem.qty * rawItem.unitPrice);
    resolvedItems.push({
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      qty: rawItem.qty,
      unitPrice: Math.round(rawItem.unitPrice),
      lineTotal,
    });

    newMovements.unshift({
      id: nextId('mov'),
      date: input.date,
      createdAt: nowIso,
      productId: product.id,
      productName: product.name,
      type: input.type === 'SALE_OUT' ? 'OUT' : 'IN',
      qtyChange: qtyDelta,
      resultingQty: product.stockQty,
      referenceType: 'INVOICE',
      note:
        input.type === 'SALE_OUT'
          ? `Sold to ${party.name}`
          : `Purchased from ${party.name}`,
    });
  }

  const subtotal = resolvedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const discount = Math.max(0, Math.min(subtotal, Math.round(input.discount || 0)));
  const totalAmount = Math.max(0, subtotal - discount);
  const breakdown = computePaymentBreakdown(totalAmount, input.paidAmount);

  if (breakdown.paidAmount > 0 && !input.accountId) {
    throw new Error('Select a Cash/Bank account for the paid amount.');
  }

  const existingCount =
    db.invoices.filter((inv) => inv.type === input.type).length + 1001;
  const prefix = input.type === 'SALE_OUT' ? 'INV' : 'PUR';
  const invoiceNo = `${prefix}-${input.date.slice(0, 4)}-${existingCount}`;

  const invoice: Invoice = {
    id: nextId('inv'),
    invoiceNo,
    type: input.type,
    date: input.date,
    createdAt: nowIso,
    partyId: party.id,
    partyName: party.name,
    items: resolvedItems,
    subtotal,
    discount,
    totalAmount: breakdown.totalAmount,
    paidAmount: breakdown.paidAmount,
    remainingAmount: breakdown.remainingAmount,
    paymentPercent: breakdown.paymentPercent,
    status: breakdown.status,
    accountId: breakdown.paidAmount > 0 ? input.accountId : undefined,
    dueDate: input.dueDate || undefined,
    notes: input.notes?.trim() || undefined,
  };

  // Attach referenceId to the stock movements we just created for this invoice
  for (let i = 0; i < resolvedItems.length; i++) {
    newMovements[i] = {
      ...newMovements[i],
      referenceId: invoice.id,
      note: `${invoice.invoiceNo} · ${newMovements[i].note}`,
    };
  }

  // Update Account Balance & Cash Transaction
  const nextAccounts = db.accounts.map((a) => ({ ...a }));
  const nextCashTx = [...db.cashTransactions];

  if (breakdown.paidAmount > 0 && input.accountId) {
    const account = nextAccounts.find((a) => a.id === input.accountId);
    if (!account) {
      throw new Error('Selected payment account not found.');
    }
    if (input.type === 'SALE_OUT') {
      account.balance += breakdown.paidAmount;
      nextCashTx.unshift({
        id: nextId('tx'),
        date: input.date,
        createdAt: nowIso,
        direction: 'IN',
        accountId: account.id,
        amount: breakdown.paidAmount,
        partyId: party.id,
        partyName: party.name,
        category: 'SALE_RECEIPT',
        referenceId: invoice.id,
        note: `${invoice.invoiceNo} (${breakdown.paymentPercent}% received${
          breakdown.remainingAmount > 0 ? `, ${formatPKR(breakdown.remainingAmount)} udhaar` : ''
        })`,
      });
    } else {
      account.balance -= breakdown.paidAmount;
      nextCashTx.unshift({
        id: nextId('tx'),
        date: input.date,
        createdAt: nowIso,
        direction: 'OUT',
        accountId: account.id,
        amount: breakdown.paidAmount,
        partyId: party.id,
        partyName: party.name,
        category: 'PURCHASE_PAYMENT',
        referenceId: invoice.id,
        note: `${invoice.invoiceNo} (${breakdown.paymentPercent}% paid${
          breakdown.remainingAmount > 0 ? `, ${formatPKR(breakdown.remainingAmount)} payable` : ''
        })`,
      });
    }
  }

  // Update Party Balance:
  // Positive = Party owes us (Lene Hain)
  // Negative = We owe party (Dene Hain)
  const nextParties = db.parties.map((p) => {
    if (p.id !== party.id) return p;
    const balanceDelta =
      input.type === 'SALE_OUT'
        ? breakdown.remainingAmount
        : -breakdown.remainingAmount;
    return {
      ...p,
      balance: p.balance + balanceDelta,
    };
  });

  return {
    db: {
      ...db,
      products: nextProducts,
      parties: nextParties,
      accounts: nextAccounts,
      invoices: [invoice, ...db.invoices],
      stockMovements: newMovements,
      cashTransactions: nextCashTx,
    },
    invoice,
  };
}

export function applyPartyPayment(
  db: ErpDatabase,
  input: RecordPaymentInput
): ErpDatabase {
  if (input.amount <= 0 || !Number.isFinite(input.amount)) {
    throw new Error('Payment amount must be greater than zero.');
  }
  const cleanAmount = Math.round(input.amount);
  const party = db.parties.find((p) => p.id === input.partyId);
  if (!party) {
    throw new Error('Party not found.');
  }
  const account = db.accounts.find((a) => a.id === input.accountId);
  if (!account) {
    throw new Error('Payment account not found.');
  }

  const nowIso = new Date().toISOString();

  // Update Account Balance
  const nextAccounts = db.accounts.map((a) => {
    if (a.id !== account.id) return a;
    return {
      ...a,
      balance:
        input.direction === 'IN'
          ? a.balance + cleanAmount
          : a.balance - cleanAmount,
    };
  });

  // Update Party Balance:
  // When direction === 'IN' (we received money from party), receivable decreases (balance -= amount).
  // When direction === 'OUT' (we paid money to party), payable decreases (balance += amount).
  const nextParties = db.parties.map((p) => {
    if (p.id !== party.id) return p;
    return {
      ...p,
      balance:
        input.direction === 'IN'
          ? p.balance - cleanAmount
          : p.balance + cleanAmount,
    };
  });

  // Apply payment against open invoice(s) for this party (specific invoice first, or FIFO)
  let remainingToAllocate = cleanAmount;
  const targetType = input.direction === 'IN' ? 'SALE_OUT' : 'PURCHASE_IN';

  // Sort oldest-first indices when auto-allocating
  const invoiceIdsOrder = db.invoices
    .filter(
      (inv) =>
        inv.partyId === party.id &&
        inv.type === targetType &&
        inv.remainingAmount > 0
    )
    .sort((a, b) => {
      if (input.invoiceId) {
        if (a.id === input.invoiceId) return -1;
        if (b.id === input.invoiceId) return 1;
      }
      return a.date.localeCompare(b.date);
    })
    .map((inv) => inv.id);

  const allocations = new Map<string, number>();
  for (const invId of invoiceIdsOrder) {
    if (remainingToAllocate <= 0) break;
    const inv = db.invoices.find((i) => i.id === invId);
    if (!inv) continue;
    const applyAmt = Math.min(inv.remainingAmount, remainingToAllocate);
    allocations.set(invId, applyAmt);
    remainingToAllocate -= applyAmt;
  }

  const nextInvoices = db.invoices.map((inv) => {
    const applied = allocations.get(inv.id);
    if (!applied) return inv;
    const updated = computePaymentBreakdown(inv.totalAmount, inv.paidAmount + applied);
    return {
      ...inv,
      paidAmount: updated.paidAmount,
      remainingAmount: updated.remainingAmount,
      paymentPercent: updated.paymentPercent,
      status: updated.status,
    };
  });

  // Also allocate leftover against open scrap payables if direction === 'OUT'
  let nextScrap = db.scrapPurchases;
  if (input.direction === 'OUT' && remainingToAllocate > 0) {
    nextScrap = db.scrapPurchases.map((s) => {
      if (s.partyId !== party.id || s.remainingAmount <= 0 || remainingToAllocate <= 0) {
        return s;
      }
      const applyAmt = Math.min(s.remainingAmount, remainingToAllocate);
      remainingToAllocate -= applyAmt;
      const updated = computePaymentBreakdown(s.totalAmount, s.paidAmount + applyAmt);
      return {
        ...s,
        paidAmount: updated.paidAmount,
        remainingAmount: updated.remainingAmount,
        status: updated.status,
      };
    });
  }

  const txNote =
    input.note?.trim() ||
    (input.direction === 'IN'
      ? `Udhaar recovery from ${party.name}`
      : `Payment made to ${party.name}`);

  const nextCashTx = [
    {
      id: nextId('tx'),
      date: input.date,
      createdAt: nowIso,
      direction: input.direction,
      accountId: account.id,
      amount: cleanAmount,
      partyId: party.id,
      partyName: party.name,
      category:
        input.direction === 'IN' ? ('UDHAAR_RECOVERY' as const) : ('SUPPLIER_PAYMENT' as const),
      referenceId: input.invoiceId,
      note: txNote,
    },
    ...db.cashTransactions,
  ];

  return {
    ...db,
    accounts: nextAccounts,
    parties: nextParties,
    invoices: nextInvoices,
    scrapPurchases: nextScrap,
    cashTransactions: nextCashTx,
  };
}

export function applyAccountTransfer(
  db: ErpDatabase,
  input: TransferFundsInput
): ErpDatabase {
  if (input.fromAccountId === input.toAccountId) {
    throw new Error('Source and destination accounts must be different.');
  }
  if (input.amount <= 0 || !Number.isFinite(input.amount)) {
    throw new Error('Transfer amount must be greater than zero.');
  }
  const cleanAmount = Math.round(input.amount);
  const fromAcc = db.accounts.find((a) => a.id === input.fromAccountId);
  const toAcc = db.accounts.find((a) => a.id === input.toAccountId);
  if (!fromAcc || !toAcc) {
    throw new Error('Account not found.');
  }

  const nextAccounts = db.accounts.map((a) => {
    if (a.id === fromAcc.id) return { ...a, balance: a.balance - cleanAmount };
    if (a.id === toAcc.id) return { ...a, balance: a.balance + cleanAmount };
    return a;
  });

  const nowIso = new Date().toISOString();
  const nextCashTx = [
    {
      id: nextId('tx'),
      date: input.date,
      createdAt: nowIso,
      direction: 'TRANSFER' as const,
      accountId: fromAcc.id,
      toAccountId: toAcc.id,
      amount: cleanAmount,
      category: 'TRANSFER' as const,
      note: input.note?.trim() || `Transfer: ${fromAcc.name} -> ${toAcc.name}`,
    },
    ...db.cashTransactions,
  ];

  return {
    ...db,
    accounts: nextAccounts,
    cashTransactions: nextCashTx,
  };
}

export function applyScrapPurchase(
  db: ErpDatabase,
  input: CreateScrapInput
): { db: ErpDatabase; scrap: ScrapPurchase } {
  const cleanName = input.scrapName.trim();
  if (!cleanName) {
    throw new Error('Scrap name is required.');
  }
  if (input.weightKg <= 0 || !Number.isFinite(input.weightKg)) {
    throw new Error('Weight in KG must be greater than zero.');
  }
  if (input.ratePerKg <= 0 || !Number.isFinite(input.ratePerKg)) {
    throw new Error('Rate per KG must be greater than zero.');
  }

  const totalAmount = Math.round(input.weightKg * input.ratePerKg);
  const breakdown = computePaymentBreakdown(totalAmount, input.paidAmount);

  if (breakdown.paidAmount > 0 && !input.accountId) {
    throw new Error('Select a payment account for the paid scrap amount.');
  }

  const party = input.partyId
    ? db.parties.find((p) => p.id === input.partyId)
    : undefined;
  const sellerName = party ? party.name : input.sellerName.trim() || 'Walk-in Scrap Seller';

  if (breakdown.remainingAmount > 0 && !party) {
    throw new Error('To keep scrap balance as Udhaar/Payable, please select a Party.');
  }

  const nowIso = new Date().toISOString();
  const receiptNo = `SCR-${1001 + db.scrapPurchases.length}`;

  const scrap: ScrapPurchase = {
    id: nextId('scr'),
    receiptNo,
    date: input.date,
    createdAt: nowIso,
    scrapName: cleanName,
    weightKg: Number(input.weightKg.toFixed(2)),
    pieceCount: input.pieceCount && input.pieceCount > 0 ? Math.round(input.pieceCount) : undefined,
    ratePerKg: Math.round(input.ratePerKg),
    totalAmount: breakdown.totalAmount,
    paidAmount: breakdown.paidAmount,
    remainingAmount: breakdown.remainingAmount,
    status: breakdown.status,
    partyId: party?.id,
    sellerName,
    accountId: breakdown.paidAmount > 0 ? input.accountId : undefined,
    notes: input.notes?.trim() || undefined,
  };

  const nextAccounts = db.accounts.map((a) => {
    if (breakdown.paidAmount > 0 && a.id === input.accountId) {
      return { ...a, balance: a.balance - breakdown.paidAmount };
    }
    return a;
  });

  const nextParties = db.parties.map((p) => {
    if (party && p.id === party.id && breakdown.remainingAmount > 0) {
      return { ...p, balance: p.balance - breakdown.remainingAmount };
    }
    return p;
  });

  const nextCashTx = [...db.cashTransactions];
  if (breakdown.paidAmount > 0 && input.accountId) {
    nextCashTx.unshift({
      id: nextId('tx'),
      date: input.date,
      createdAt: nowIso,
      direction: 'OUT',
      accountId: input.accountId,
      amount: breakdown.paidAmount,
      partyId: party?.id,
      partyName: sellerName,
      category: 'SCRAP_BUY',
      referenceId: scrap.id,
      note: `${receiptNo} · ${cleanName} (${scrap.weightKg} kg @ ${formatPKR(scrap.ratePerKg)}/kg)`,
    });
  }

  return {
    db: {
      ...db,
      accounts: nextAccounts,
      parties: nextParties,
      scrapPurchases: [scrap, ...db.scrapPurchases],
      cashTransactions: nextCashTx,
    },
    scrap,
  };
}

export function applyProductCreateOrAdjust(
  db: ErpDatabase,
  payload:
    | { mode: 'CREATE'; product: Omit<Product, 'id'> }
    | { mode: 'ADJUST'; productId: string; deltaQty: number; date: string; note: string }
): ErpDatabase {
  const nowIso = new Date().toISOString();
  if (payload.mode === 'CREATE') {
    const p = payload.product;
    if (!p.name.trim() || !p.sku.trim()) {
      throw new Error('Battery Name and SKU are required.');
    }
    const created: Product = {
      ...p,
      id: nextId('prod'),
      name: p.name.trim(),
      sku: p.sku.trim().toUpperCase(),
      stockQty: Math.max(0, Math.round(p.stockQty)),
      purchasePrice: Math.max(0, Math.round(p.purchasePrice)),
      salePrice: Math.max(0, Math.round(p.salePrice)),
    };
    const nextMovements = [...db.stockMovements];
    if (created.stockQty > 0) {
      nextMovements.unshift({
        id: nextId('mov'),
        date: nowIso.slice(0, 10),
        createdAt: nowIso,
        productId: created.id,
        productName: created.name,
        type: 'IN',
        qtyChange: created.stockQty,
        resultingQty: created.stockQty,
        referenceType: 'MANUAL',
        note: 'Opening stock added',
      });
    }
    return {
      ...db,
      products: [created, ...db.products],
      stockMovements: nextMovements,
    };
  }

  const target = db.products.find((p) => p.id === payload.productId);
  if (!target) {
    throw new Error('Battery item not found.');
  }
  const cleanDelta = Math.round(payload.deltaQty);
  if (cleanDelta === 0) {
    throw new Error('Stock adjustment quantity cannot be zero.');
  }
  if (target.stockQty + cleanDelta < 0) {
    throw new Error('Stock quantity cannot become negative.');
  }

  const resultingQty = target.stockQty + cleanDelta;
  const nextProducts = db.products.map((p) =>
    p.id === target.id ? { ...p, stockQty: resultingQty } : p
  );
  const nextMovements = [
    {
      id: nextId('mov'),
      date: payload.date,
      createdAt: nowIso,
      productId: target.id,
      productName: target.name,
      type: cleanDelta > 0 ? ('IN' as const) : ('OUT' as const),
      qtyChange: cleanDelta,
      resultingQty,
      referenceType: 'MANUAL' as const,
      note: payload.note.trim() || 'Manual stock adjustment',
    },
    ...db.stockMovements,
  ];

  return {
    ...db,
    products: nextProducts,
    stockMovements: nextMovements,
  };
}

export function computeDayEndSummary(db: ErpDatabase, date: string): DayEndSummary {
  const salesToday = db.invoices.filter((i) => i.date === date && i.type === 'SALE_OUT');
  const purchasesToday = db.invoices.filter((i) => i.date === date && i.type === 'PURCHASE_IN');
  const scrapToday = db.scrapPurchases.filter((s) => s.date === date);
  const txToday = db.cashTransactions.filter((t) => t.date === date);

  const totalSalesBilled = salesToday.reduce((s, i) => s + i.totalAmount, 0);
  const salesCashCollected = salesToday.reduce((s, i) => s + i.paidAmount, 0);
  const salesUdhaarAdded = salesToday.reduce((s, i) => s + i.remainingAmount, 0);

  const totalPurchasesBilled = purchasesToday.reduce((s, i) => s + i.totalAmount, 0);
  const purchasesPaid = purchasesToday.reduce((s, i) => s + i.paidAmount, 0);
  const purchasesPayableAdded = purchasesToday.reduce((s, i) => s + i.remainingAmount, 0);

  const scrapTotalKg = scrapToday.reduce((s, i) => s + i.weightKg, 0);
  const scrapTotalAmount = scrapToday.reduce((s, i) => s + i.totalAmount, 0);
  const scrapPaidAmount = scrapToday.reduce((s, i) => s + i.paidAmount, 0);
  const scrapPayableAdded = scrapToday.reduce((s, i) => s + i.remainingAmount, 0);

  const udhaarRecoveredToday = txToday
    .filter((t) => t.category === 'UDHAAR_RECOVERY')
    .reduce((s, t) => s + t.amount, 0);
  const supplierPaidToday = txToday
    .filter((t) => t.category === 'SUPPLIER_PAYMENT')
    .reduce((s, t) => s + t.amount, 0);

  const totalMoneyInToday = txToday
    .filter((t) => t.direction === 'IN')
    .reduce((s, t) => s + t.amount, 0);
  const totalMoneyOutToday = txToday
    .filter((t) => t.direction === 'OUT')
    .reduce((s, t) => s + t.amount, 0);

  const accountFlows = db.accounts.map((acc) => {
    let moneyIn = 0;
    let moneyOut = 0;
    for (const tx of txToday) {
      if (tx.direction === 'IN' && tx.accountId === acc.id) {
        moneyIn += tx.amount;
      } else if (tx.direction === 'OUT' && tx.accountId === acc.id) {
        moneyOut += tx.amount;
      } else if (tx.direction === 'TRANSFER') {
        if (tx.accountId === acc.id) moneyOut += tx.amount;
        if (tx.toAccountId === acc.id) moneyIn += tx.amount;
      }
    }
    return {
      accountId: acc.id,
      accountName: acc.name,
      moneyIn,
      moneyOut,
      netFlow: moneyIn - moneyOut,
      currentBalance: acc.balance,
    };
  });

  const partialInvoicesToday = salesToday.filter((i) => i.remainingAmount > 0);
  const allOpenPartialInvoices = db.invoices.filter(
    (i) => i.type === 'SALE_OUT' && i.remainingAmount > 0
  );

  return {
    date,
    salesCount: salesToday.length,
    totalSalesBilled,
    salesCashCollected,
    salesUdhaarAdded,
    purchasesCount: purchasesToday.length,
    totalPurchasesBilled,
    purchasesPaid,
    purchasesPayableAdded,
    scrapCount: scrapToday.length,
    scrapTotalKg: Number(scrapTotalKg.toFixed(2)),
    scrapTotalAmount,
    scrapPaidAmount,
    scrapPayableAdded,
    udhaarRecoveredToday,
    supplierPaidToday,
    totalMoneyInToday,
    totalMoneyOutToday,
    netCashFlowToday: totalMoneyInToday - totalMoneyOutToday,
    accountFlows,
    partialInvoicesToday,
    allOpenPartialInvoices,
  };
}
