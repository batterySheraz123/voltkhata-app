import { useState } from 'react';
import { ArrowLeftRight, ArrowDownLeft, ArrowUpRight, X } from 'lucide-react';
import type { ErpDatabase, TransferFundsInput } from '../types/erp';
import { getTodayDateString } from '../data/seedData';
import { formatPKR } from '../utils/erpLogic';

interface AccountsViewProps {
  db: ErpDatabase;
  onTransferFunds: (input: TransferFundsInput) => Promise<void>;
}

export function AccountsView({ db, onTransferFunds }: AccountsViewProps) {
  const [accountFilter, setAccountFilter] = useState<string>('ALL');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'IN' | 'OUT' | 'TRANSFER'>('ALL');
  const [transferOpen, setTransferOpen] = useState(false);

  const [fromId, setFromId] = useState(db.accounts[0]?.id || 'acc-cash');
  const [toId, setToId] = useState(db.accounts[1]?.id || 'acc-meezan');
  const [amount, setAmount] = useState(10000);
  const [date, setDate] = useState(getTodayDateString());
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const totalBalance = db.accounts.reduce((sum, a) => sum + a.balance, 0);
  const accountNameById = new Map(db.accounts.map((a) => [a.id, a.name]));

  const filteredTx = db.cashTransactions.filter((tx) => {
    if (
      accountFilter !== 'ALL' &&
      tx.accountId !== accountFilter &&
      tx.toAccountId !== accountFilter
    ) {
      return false;
    }
    if (directionFilter !== 'ALL' && tx.direction !== directionFilter) return false;
    return true;
  });

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      await onTransferFunds({
        date,
        fromAccountId: fromId,
        toAccountId: toId,
        amount: Number(amount),
        note,
      });
      setTransferOpen(false);
      setNote('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Transfer failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500">Total Available Across All Accounts</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatPKR(totalBalance)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setErrorMsg('');
            setTransferOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>Transfer Between Accounts</span>
        </button>
      </div>

      {/* Account Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {db.accounts.map((acc) => {
          const isSelected = accountFilter === acc.id;
          return (
            <button
              key={acc.id}
              type="button"
              onClick={() => setAccountFilter(isSelected ? 'ALL' : acc.id)}
              className={`text-left p-4 rounded-xl border transition-colors ${
                isSelected
                  ? 'bg-blue-50 border-blue-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="text-xs font-medium text-slate-500">{acc.type}</div>
              <div className="mt-1 font-semibold text-sm text-slate-900 truncate">{acc.name}</div>
              <div className="mt-2 font-mono tabular-nums text-lg font-bold text-slate-900">
                {formatPKR(acc.balance)}
              </div>
              <div className="mt-1 text-[11px] font-mono text-slate-400 truncate">
                {acc.accountNumber}
              </div>
            </button>
          );
        })}
      </section>

      {/* Cash Flow Ledger */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Complete Cash Ledger (Kis Se Aya / Kis Ko Diya)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Filter by account or transaction type
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by account"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="ALL">All Accounts</option>
              {db.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['ALL', 'IN', 'OUT', 'TRANSFER'] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => setDirectionFilter(dir)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                    directionFilter === dir ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {dir === 'ALL' ? 'All' : dir === 'IN' ? 'Money In' : dir === 'OUT' ? 'Money Out' : 'Transfers'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                <th className="py-2.5 px-5">Date</th>
                <th className="py-2.5 px-4">Flow</th>
                <th className="py-2.5 px-4">Account</th>
                <th className="py-2.5 px-4">Party / Counterparty</th>
                <th className="py-2.5 px-4">Details</th>
                <th className="py-2.5 px-5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTx.map((tx) => {
                const isIn = tx.direction === 'IN';
                const isOut = tx.direction === 'OUT';
                const accName = accountNameById.get(tx.accountId) || tx.accountId;
                const toName = tx.toAccountId
                  ? accountNameById.get(tx.toAccountId) || tx.toAccountId
                  : null;

                return (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-5 font-mono text-xs text-slate-600">{tx.date}</td>
                    <td className="py-3 px-4 text-xs font-semibold">
                      {isIn ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <ArrowDownLeft className="w-3.5 h-3.5" /> Money In
                        </span>
                      ) : isOut ? (
                        <span className="inline-flex items-center gap-1 text-rose-700">
                          <ArrowUpRight className="w-3.5 h-3.5" /> Money Out
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-700">
                          <ArrowLeftRight className="w-3.5 h-3.5" /> Transfer
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-800">
                      {toName ? `${accName} -> ${toName}` : accName}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {tx.partyName || 'Internal'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{tx.note}</td>
                    <td
                      className={`py-3 px-5 text-right font-mono tabular-nums font-bold ${
                        isIn ? 'text-emerald-700' : isOut ? 'text-rose-700' : 'text-slate-700'
                      }`}
                    >
                      {isIn ? '+' : isOut ? '-' : ''}
                      {formatPKR(tx.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Transfer Modal */}
      {transferOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Transfer Funds"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Transfer Between Accounts</h2>
              <button
                type="button"
                onClick={() => setTransferOpen(false)}
                aria-label="Close transfer modal"
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleTransfer} className="p-6 space-y-4 text-sm">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                  {errorMsg}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  From Account
                </label>
                <select
                  value={fromId}
                  onChange={(e) => setFromId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {db.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatPKR(a.balance)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  To Account
                </label>
                <select
                  value={toId}
                  onChange={(e) => setToId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {db.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatPKR(a.balance)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount (Rs.)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Note</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Evening cash deposit into Meezan Bank"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
