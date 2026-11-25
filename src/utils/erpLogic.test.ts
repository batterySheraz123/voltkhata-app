import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedDatabase } from '../data/seedData';
import {
  applyAccountTransfer,
  applyInvoice,
  applyPartyPayment,
  applyScrapPurchase,
  computeDayEndSummary,
  computePaymentBreakdown,
} from './erpLogic';

test('computePaymentBreakdown calculates 10% partial payment and 90% udhaar correctly', () => {
  const res = computePaymentBreakdown(100000, 10000);
  assert.equal(res.paidAmount, 10000);
  assert.equal(res.remainingAmount, 90000);
  assert.equal(res.paymentPercent, 10);
  assert.equal(res.status, 'PARTIAL');
});

test('SALE_OUT invoice deducts stock, adds 10% to cash account, and adds 90% to customer receivable', () => {
  const db = createSeedDatabase('2026-11-25');
  const productBefore = db.products.find((p) => p.id === 'prod-ags-gx135')!;
  const cashBefore = db.accounts.find((a) => a.id === 'acc-cash')!.balance;
  const partyBefore = db.parties.find((p) => p.id === 'party-bilal')!.balance;

  const { db: nextDb, invoice } = applyInvoice(db, {
    type: 'SALE_OUT',
    date: '2026-11-25',
    partyId: 'party-bilal',
    items: [{ productId: 'prod-ags-gx135', qty: 4, unitPrice: 25000 }],
    discount: 0,
    paidAmount: 10000, // 10% of 100,000
    accountId: 'acc-cash',
    dueDate: '2026-12-05',
    notes: '10% paid, 90% later',
  });

  const productAfter = nextDb.products.find((p) => p.id === 'prod-ags-gx135')!;
  const cashAfter = nextDb.accounts.find((a) => a.id === 'acc-cash')!.balance;
  const partyAfter = nextDb.parties.find((p) => p.id === 'party-bilal')!.balance;

  assert.equal(productAfter.stockQty, productBefore.stockQty - 4);
  assert.equal(cashAfter, cashBefore + 10000);
  assert.equal(partyAfter, partyBefore + 90000);
  assert.equal(invoice.paymentPercent, 10);
  assert.equal(invoice.remainingAmount, 90000);
  assert.equal(invoice.status, 'PARTIAL');
});

test('SALE_OUT throws error when selling more than available stock', () => {
  const db = createSeedDatabase('2026-11-25');
  assert.throws(() => {
    applyInvoice(db, {
      type: 'SALE_OUT',
      date: '2026-11-25',
      partyId: 'party-bilal',
      items: [{ productId: 'prod-osk-platinum100', qty: 999, unitPrice: 21000 }],
      discount: 0,
      paidAmount: 0,
    });
  }, /Insufficient stock/);
});

test('PURCHASE_IN increases inventory stock, deducts bank balance, and updates payable', () => {
  const db = createSeedDatabase('2026-11-25');
  const productBefore = db.products.find((p) => p.id === 'prod-osk-platinum100')!;
  const bankBefore = db.accounts.find((a) => a.id === 'acc-meezan')!.balance;
  const supplierBefore = db.parties.find((p) => p.id === 'party-exide-dist')!.balance;

  const { db: nextDb, invoice } = applyInvoice(db, {
    type: 'PURCHASE_IN',
    date: '2026-11-25',
    partyId: 'party-exide-dist',
    items: [{ productId: 'prod-osk-platinum100', qty: 10, unitPrice: 18000 }],
    discount: 0,
    paidAmount: 80000,
    accountId: 'acc-meezan',
  });

  const productAfter = nextDb.products.find((p) => p.id === 'prod-osk-platinum100')!;
  const bankAfter = nextDb.accounts.find((a) => a.id === 'acc-meezan')!.balance;
  const supplierAfter = nextDb.parties.find((p) => p.id === 'party-exide-dist')!.balance;

  assert.equal(productAfter.stockQty, productBefore.stockQty + 10);
  assert.equal(bankAfter, bankBefore - 80000);
  assert.equal(supplierAfter, supplierBefore - 100000); // payable increases negatively
  assert.equal(invoice.remainingAmount, 100000);
});

test('applyPartyPayment settles partial invoice and clears customer udhaar', () => {
  const db = createSeedDatabase('2026-11-25');
  const epBefore = db.accounts.find((a) => a.id === 'acc-easypaisa')!.balance;

  const nextDb = applyPartyPayment(db, {
    date: '2026-11-25',
    direction: 'IN',
    partyId: 'party-alfatah',
    accountId: 'acc-easypaisa',
    amount: 83700,
    invoiceId: 'inv-seed-1',
    note: 'Remaining 90% cleared via EasyPaisa',
  });

  const partyAfter = nextDb.parties.find((p) => p.id === 'party-alfatah')!;
  const invAfter = nextDb.invoices.find((i) => i.id === 'inv-seed-1')!;
  const epAfter = nextDb.accounts.find((a) => a.id === 'acc-easypaisa')!;

  assert.equal(partyAfter.balance, 0);
  assert.equal(invAfter.remainingAmount, 0);
  assert.equal(invAfter.status, 'PAID');
  assert.equal(epAfter.balance, epBefore + 83700);
});

test('applyScrapPurchase logs scrap name & kg, deducts account, and reflects in Day-End Hisaab', () => {
  const db = createSeedDatabase('2026-11-25');
  const cashBefore = db.accounts.find((a) => a.id === 'acc-cash')!.balance;

  const { db: nextDb, scrap } = applyScrapPurchase(db, {
    date: '2026-11-25',
    scrapName: 'Dry UPS Lead Scrap',
    weightKg: 120,
    pieceCount: 10,
    ratePerKg: 380,
    paidAmount: 45600,
    sellerName: 'Imran Kabaria',
    accountId: 'acc-cash',
  });

  const cashAfter = nextDb.accounts.find((a) => a.id === 'acc-cash')!.balance;
  assert.equal(scrap.totalAmount, 45600);
  assert.equal(cashAfter, cashBefore - 45600);

  const dayEnd = computeDayEndSummary(nextDb, '2026-11-25');
  assert.equal(dayEnd.scrapTotalKg, 85 + 120);
  assert.equal(dayEnd.scrapTotalAmount, 34850 + 45600);
  assert.equal(dayEnd.partialInvoicesToday.length, 1);
  assert.equal(dayEnd.salesUdhaarAdded, 83700);
});

test('applyAccountTransfer moves funds accurately between accounts', () => {
  const db = createSeedDatabase('2026-11-25');
  const cashBefore = db.accounts.find((a) => a.id === 'acc-cash')!.balance;
  const bankBefore = db.accounts.find((a) => a.id === 'acc-meezan')!.balance;

  const nextDb = applyAccountTransfer(db, {
    date: '2026-11-25',
    fromAccountId: 'acc-cash',
    toAccountId: 'acc-meezan',
    amount: 50000,
  });

  assert.equal(nextDb.accounts.find((a) => a.id === 'acc-cash')!.balance, cashBefore - 50000);
  assert.equal(nextDb.accounts.find((a) => a.id === 'acc-meezan')!.balance, bankBefore + 50000);
});
