import { useState } from 'react';
import { Printer } from 'lucide-react';
import type { ErpDatabase } from '../types/erp';
import { getTodayDateString } from '../data/seedData';
import { computeDayEndSummary, formatKg, formatPKR } from '../utils/erpLogic';

interface DayEndViewProps {
  db: ErpDatabase;
  onInspectParty: (partyId: string) => void;
}

export function DayEndView({ db, onInspectParty }: DayEndViewProps) {
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const summary = computeDayEndSummary(db, selectedDate);
  const totalLiquidity = db.accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <label
            htmlFor="dayend-date-picker"
            className="text-xs font-semibold text-slate-700"
          >
            Select Hisaab Date:
          </label>
          <input
            id="dayend-date-picker"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 text-sm font-mono bg-white border border-slate-300 rounded-lg"
          />
          <button
            type="button"
            onClick={() => setSelectedDate(getTodayDateString())}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Today
          </button>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print Day-End Closing</span>
        </button>
      </div>

      {/* Print Header */}
      <div className="hidden print-only border-b border-slate-300 pb-4 mb-4">
        <h2 className="text-xl font-bold text-slate-900">
          {db.shopName} — Day-End Hisaab ({selectedDate})
        </h2>
        <p className="text-xs text-slate-600">{db.shopAddress}</p>
      </div>

      {/* Day-End 4-Column Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Sales Billed ({summary.salesCount} invoices)
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatPKR(summary.totalSalesBilled)}
          </div>
          <div className="mt-2 text-xs text-slate-600 font-mono tabular-nums">
            Collected: <span className="text-emerald-700 font-semibold">{formatPKR(summary.salesCashCollected)}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Udhaar / Baqiya Added on {selectedDate}
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-700">
            {formatPKR(summary.salesUdhaarAdded)}
          </div>
          <div className="mt-2 text-xs text-slate-600">
            {summary.partialInvoicesToday.length} partial / udhaar invoices
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Scrap Bought ({summary.scrapCount} lots)
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatKg(summary.scrapTotalKg)}
          </div>
          <div className="mt-2 text-xs text-slate-600 font-mono tabular-nums">
            Value: {formatPKR(summary.scrapTotalAmount)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Net Cash Flow on {selectedDate}</div>
          <div
            className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
              summary.netCashFlowToday >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {summary.netCashFlowToday >= 0 ? '+' : ''}
            {formatPKR(summary.netCashFlowToday)}
          </div>
          <div className="mt-2 text-xs text-slate-600 font-mono tabular-nums">
            Total Liquid Cash: {formatPKR(totalLiquidity)}
          </div>
        </div>
      </section>

      {/* Account Reconciliation Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            Account-Wise Day-End Reconciliation ({selectedDate})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Exact inflows, outflows, and current closing balance per cash/bank account
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-2.5 px-5">Account</th>
                <th className="py-2.5 px-4 text-right">Money In (+)</th>
                <th className="py-2.5 px-4 text-right">Money Out (-)</th>
                <th className="py-2.5 px-4 text-right">Net Day Change</th>
                <th className="py-2.5 px-5 text-right">Current Closing Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.accountFlows.map((flow) => (
                <tr key={flow.accountId}>
                  <td className="py-3 px-5 font-medium text-slate-900">{flow.accountName}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">
                    +{formatPKR(flow.moneyIn)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-rose-700">
                    -{formatPKR(flow.moneyOut)}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                      flow.netFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {flow.netFlow >= 0 ? '+' : ''}
                    {formatPKR(flow.netFlow)}
                  </td>
                  <td className="py-3 px-5 text-right font-mono tabular-nums font-bold text-slate-900">
                    {formatPKR(flow.currentBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Partial Payment & Remaining Baqiya Review */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            All Open Partial Payments &amp; Pending Baqiya ({summary.allOpenPartialInvoices.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Customers who paid partial (e.g. 10% jama) and promised remaining payment later
          </p>
        </div>

        {summary.allOpenPartialInvoices.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No pending partial payments.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2.5 px-5">Invoice &amp; Date</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Note / Promise</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                  <th className="py-2.5 px-4 text-right">Paid (%)</th>
                  <th className="py-2.5 px-5 text-right">Baqiya Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.allOpenPartialInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-5 whitespace-nowrap">
                      <div className="font-mono font-semibold text-slate-900">{inv.invoiceNo}</div>
                      <div className="text-xs text-slate-500 font-mono">
                        {inv.date}
                        {inv.dueDate ? ` · Due ${inv.dueDate}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onInspectParty(inv.partyId)}
                        className="font-medium text-blue-700 hover:underline text-left"
                      >
                        {inv.partyName}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-xs">
                      {inv.notes || 'Partial udhaar'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                      {formatPKR(inv.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 text-xs whitespace-nowrap">
                      {formatPKR(inv.paidAmount)} ({inv.paymentPercent}%)
                    </td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums font-bold text-amber-700 whitespace-nowrap">
                      {formatPKR(inv.remainingAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
