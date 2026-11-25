import { ArrowDownLeft, ArrowUpRight, AlertTriangle, ChevronRight } from 'lucide-react';
import type { ErpDatabase } from '../types/erp';
import { getTodayDateString } from '../data/seedData';
import { computeDayEndSummary, formatKg, formatPKR } from '../utils/erpLogic';
import type { NavSection } from './Sidebar';

interface DashboardViewProps {
  db: ErpDatabase;
  onNavigate: (section: NavSection) => void;
  onInspectParty: (partyId: string) => void;
  onStartInvoice: (type: 'SALE_OUT' | 'PURCHASE_IN') => void;
}

export function DashboardView({
  db,
  onNavigate,
  onInspectParty,
  onStartInvoice,
}: DashboardViewProps) {
  const today = getTodayDateString();
  const dayEnd = computeDayEndSummary(db, today);

  const totalStockUnits = db.products.reduce((sum, p) => sum + p.stockQty, 0);
  const totalStockCostValue = db.products.reduce(
    (sum, p) => sum + p.stockQty * p.purchasePrice,
    0
  );
  const lowStockItems = db.products.filter((p) => p.stockQty <= p.minStockAlert);

  const totalCashAndBank = db.accounts.reduce((sum, a) => sum + a.balance, 0);

  const receivableParties = db.parties
    .filter((p) => p.balance > 0)
    .sort((a, b) => b.balance - a.balance);
  const totalReceivable = receivableParties.reduce((sum, p) => sum + p.balance, 0);

  const payableParties = db.parties
    .filter((p) => p.balance < 0)
    .sort((a, b) => a.balance - b.balance);
  const totalPayable = payableParties.reduce((sum, p) => sum + Math.abs(p.balance), 0);

  const accountNameById = new Map(db.accounts.map((a) => [a.id, a.name]));

  return (
    <div className="space-y-6">
      {/* Top KPI Strip */}
      <section aria-label="Business Financial Summary" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Total Cash & Bank Balance</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatPKR(totalCashAndBank)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span>{db.accounts.length} active accounts</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => onNavigate('accounts')}
              className="text-blue-700 font-medium hover:underline"
            >
              View breakdown
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Lene Hain (Customer Udhaar)</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {formatPKR(totalReceivable)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span>{receivableParties.length} parties owe you</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => onNavigate('parties')}
              className="text-blue-700 font-medium hover:underline"
            >
              Recover udhaar
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Dene Hain (Supplier Payable)</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-rose-700">
            {formatPKR(totalPayable)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span>{payableParties.length} suppliers payable</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => onNavigate('parties')}
              className="text-blue-700 font-medium hover:underline"
            >
              Settle dues
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Battery Inventory Value</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatPKR(totalStockCostValue)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono tabular-nums">{totalStockUnits} units in stock</span>
            <span aria-hidden="true">·</span>
            <span className={lowStockItems.length > 0 ? 'text-amber-700 font-medium' : ''}>
              {lowStockItems.length} low stock
            </span>
          </div>
        </div>
      </section>

      {/* Account Balances + Day-End Snapshot */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Accounts: Amount kis mein kitna hai */}
        <section className="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Account Balances (Kis Mein Kitna Hai)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Live balance across cash drawer, bank accounts, and mobile wallets
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('accounts')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>Manage Cash</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                  <th className="py-2.5 px-5">Account</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4 text-right">Today In / Out</th>
                  <th className="py-2.5 px-5 text-right">Current Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {dayEnd.accountFlows.map((flow) => {
                  const acc = db.accounts.find((a) => a.id === flow.accountId)!;
                  return (
                    <tr key={acc.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-5">
                        <div className="font-medium text-slate-900">{acc.name}</div>
                        <div className="text-xs text-slate-400 font-mono">{acc.accountNumber}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">{acc.type}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                        <span className="text-emerald-700">+{formatPKR(flow.moneyIn)}</span>
                        <span className="text-slate-300 mx-1.5">/</span>
                        <span className="text-rose-700">-{formatPKR(flow.moneyOut)}</span>
                      </td>
                      <td className="py-3 px-5 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatPKR(acc.balance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Today's Day-End Quick Summary */}
        <section className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Today&apos;s Day-End Hisaab</h2>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">{today}</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('dayend')}
                className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap"
              >
                Full Closing Sheet
              </button>
            </div>

            <dl className="mt-4 divide-y divide-slate-100 text-sm">
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-600">Total Sales Billed ({dayEnd.salesCount})</dt>
                <dd className="font-mono tabular-nums font-semibold text-slate-900">
                  {formatPKR(dayEnd.totalSalesBilled)}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-600">Cash Collected on Sales</dt>
                <dd className="font-mono tabular-nums font-semibold text-emerald-700">
                  {formatPKR(dayEnd.salesCashCollected)}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-600">Pending Baqiya / Udhaar Added</dt>
                <dd className="font-mono tabular-nums font-semibold text-amber-700">
                  {formatPKR(dayEnd.salesUdhaarAdded)}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-600">
                  Scrap Bought ({formatKg(dayEnd.scrapTotalKg)})
                </dt>
                <dd className="font-mono tabular-nums font-semibold text-slate-900">
                  {formatPKR(dayEnd.scrapTotalAmount)}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-600">Net Cash Flow Today</dt>
                <dd
                  className={`font-mono tabular-nums font-bold ${
                    dayEnd.netCashFlowToday >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {dayEnd.netCashFlowToday >= 0 ? '+' : ''}
                  {formatPKR(dayEnd.netCashFlowToday)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onStartInvoice('SALE_OUT')}
              className="flex-1 py-2 px-3 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap"
            >
              + Sale Invoice (Out)
            </button>
            <button
              type="button"
              onClick={() => onStartInvoice('PURCHASE_IN')}
              className="flex-1 py-2 px-3 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              + Purchase Bill (In)
            </button>
          </div>
        </section>
      </div>

      {/* Partial Payments (10% Jama, 90% Baqiya) + Udhaar Overview + Recent Cash Flow */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Partial Payment & Open Udhaar Watchlist */}
        <section className="xl:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Partial Payments &amp; Pending Baqiya (Day-End Watchlist)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Invoices where customer paid partial (e.g. 10%) and remaining is due later
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('invoices')}
              className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap"
            >
              All Invoices
            </button>
          </div>

          {dayEnd.allOpenPartialInvoices.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              All sale invoices are 100% cleared. No pending baqiya.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {dayEnd.allOpenPartialInvoices.slice(0, 6).map((inv) => (
                <div
                  key={inv.id}
                  className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-slate-50/70"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onInspectParty(inv.partyId)}
                      className="font-medium text-sm text-slate-900 hover:text-blue-700 text-left truncate block"
                    >
                      {inv.partyName}
                    </button>
                    <div className="text-xs text-slate-500 font-mono truncate">
                      {inv.invoiceNo} · {inv.date}
                      {inv.dueDate ? ` · Due ${inv.dueDate}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0 whitespace-nowrap">
                    <div className="font-mono tabular-nums text-sm font-semibold text-amber-700">
                      {formatPKR(inv.remainingAmount)} due
                    </div>
                    <div className="font-mono tabular-nums text-xs text-slate-500">
                      <span className="text-emerald-700 font-medium">
                        {formatPKR(inv.paidAmount)} ({inv.paymentPercent}%)
                      </span>{' '}
                      / {formatPKR(inv.totalAmount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Money In / Money Out (Kis se aya / Kis ko diya) */}
        <section className="xl:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Recent Cash Flow (Kis Se Aya / Kis Ko Diya)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every rupee received or paid across your accounts
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('accounts')}
              className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap"
            >
              Full Ledger
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {db.cashTransactions.slice(0, 6).map((tx) => {
              const accName = accountNameById.get(tx.accountId) || tx.accountId;
              const isIn = tx.direction === 'IN';
              const isOut = tx.direction === 'OUT';
              return (
                <div key={tx.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`mt-0.5 p-1.5 rounded-md shrink-0 ${
                        isIn
                          ? 'bg-emerald-50 text-emerald-700'
                          : isOut
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isIn ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {tx.partyName || 'Internal Transfer'}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {accName} · {tx.date} · {tx.note}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`font-mono tabular-nums text-sm font-semibold shrink-0 ${
                      isIn ? 'text-emerald-700' : isOut ? 'text-rose-700' : 'text-slate-700'
                    }`}
                  >
                    {isIn ? '+' : isOut ? '-' : ''}
                    {formatPKR(tx.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Low Stock Alert Strip (only if items are low) */}
      {lowStockItems.length > 0 && (
        <section className="bg-amber-50/70 border border-amber-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="font-medium">
              Low Stock Alert: {lowStockItems.map((p) => `${p.name} (${p.stockQty} left)`).join(', ')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onStartInvoice('PURCHASE_IN')}
            className="text-xs font-semibold text-amber-900 underline hover:text-amber-950 whitespace-nowrap"
          >
            Restock via Purchase Invoice
          </button>
        </section>
      )}
    </div>
  );
}
