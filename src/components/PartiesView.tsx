import { useState } from 'react';
import { Plus, Wallet, X } from 'lucide-react';
import type { ErpDatabase, PartyRole, RecordPaymentInput } from '../types/erp';
import { getTodayDateString } from '../data/seedData';
import { formatPKR } from '../utils/erpLogic';

interface PartiesViewProps {
  db: ErpDatabase;
  selectedPartyId: string | null;
  onSelectParty: (partyId: string) => void;
  onCreateParty: (party: {
    name: string;
    phone: string;
    area: string;
    role: PartyRole;
    openingBalance?: number;
  }) => Promise<string>;
  onRecordPayment: (input: RecordPaymentInput) => Promise<void>;
}

export function PartiesView({
  db,
  selectedPartyId,
  onSelectParty,
  onCreateParty,
  onRecordPayment,
}: PartiesViewProps) {
  const [filter, setFilter] = useState<'ALL' | 'RECEIVABLE' | 'PAYABLE'>('ALL');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Add party state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [role, setRole] = useState<PartyRole>('CUSTOMER');
  const [openingBalance, setOpeningBalance] = useState(0);

  // Settle payment state
  const [payDirection, setPayDirection] = useState<'IN' | 'OUT'>('IN');
  const [payAmount, setPayAmount] = useState(0);
  const [payAccountId, setPayAccountId] = useState(db.accounts[0]?.id || 'acc-cash');
  const [payDate, setPayDate] = useState(getTodayDateString());
  const [payInvoiceId, setPayInvoiceId] = useState<string>('');
  const [payNote, setPayNote] = useState('');

  const filteredParties = db.parties.filter((p) => {
    if (filter === 'RECEIVABLE' && p.balance <= 0) return false;
    if (filter === 'PAYABLE' && p.balance >= 0) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeParty =
    db.parties.find((p) => p.id === selectedPartyId) || filteredParties[0] || db.parties[0];

  const partyInvoices = activeParty
    ? db.invoices.filter((i) => i.partyId === activeParty.id)
    : [];
  const partyScrap = activeParty
    ? db.scrapPurchases.filter((s) => s.partyId === activeParty.id)
    : [];
  const partyCashTx = activeParty
    ? db.cashTransactions.filter((t) => t.partyId === activeParty.id)
    : [];

  const accountNameById = new Map(db.accounts.map((a) => [a.id, a.name]));

  const openSettleModal = () => {
    if (!activeParty) return;
    const isReceivable = activeParty.balance >= 0;
    setPayDirection(isReceivable ? 'IN' : 'OUT');
    setPayAmount(Math.abs(activeParty.balance) || 0);
    setPayAccountId(db.accounts[0]?.id || 'acc-cash');
    setPayDate(getTodayDateString());
    const openInv = partyInvoices.find((i) => i.remainingAmount > 0);
    setPayInvoiceId(openInv?.id || '');
    setPayNote('');
    setErrorMsg('');
    setPaymentModalOpen(true);
  };

  const handleAddParty = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const createdId = await onCreateParty({
        name,
        phone,
        area,
        role,
        openingBalance: Number(openingBalance) || 0,
      });
      onSelectParty(createdId);
      setAddOpen(false);
      setName('');
      setPhone('');
      setArea('');
      setOpeningBalance(0);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create party.');
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeParty) return;
    setErrorMsg('');
    try {
      await onRecordPayment({
        date: payDate,
        direction: payDirection,
        partyId: activeParty.id,
        accountId: payAccountId,
        amount: Number(payAmount),
        invoiceId: payInvoiceId || undefined,
        note: payNote,
      });
      setPaymentModalOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to record payment.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            {(
              [
                { id: 'ALL', label: 'All Parties' },
                { id: 'RECEIVABLE', label: 'Lene Hain (Receivable)' },
                { id: 'PAYABLE', label: 'Dene Hain (Payable)' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                  filter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, or area..."
            aria-label="Search parties"
            className="w-60 px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorMsg('');
            setAddOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Party</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Directory */}
        <section className="xl:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
            Parties Directory ({filteredParties.length})
          </div>
          <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
            {filteredParties.map((party) => {
              const isSelected = activeParty?.id === party.id;
              return (
                <button
                  key={party.id}
                  type="button"
                  onClick={() => onSelectParty(party.id)}
                  className={`w-full text-left px-5 py-3.5 flex items-center justify-between gap-3 transition-colors ${
                    isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-slate-900 truncate">
                      {party.name}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {party.role} · {party.phone || 'No phone'} · {party.area || 'Lahore'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {party.balance > 0 ? (
                      <>
                        <div className="font-mono tabular-nums font-bold text-sm text-emerald-700">
                          {formatPKR(party.balance)}
                        </div>
                        <div className="text-[11px] text-emerald-700">Lene Hain</div>
                      </>
                    ) : party.balance < 0 ? (
                      <>
                        <div className="font-mono tabular-nums font-bold text-sm text-rose-700">
                          {formatPKR(Math.abs(party.balance))}
                        </div>
                        <div className="text-[11px] text-rose-700">Dene Hain</div>
                      </>
                    ) : (
                      <div className="font-mono tabular-nums text-xs text-slate-500">Clear</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Right Detail: Buying History + Udhaar + Khata */}
        <section className="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          {activeParty ? (
            <div>
              <div className="p-6 border-b border-slate-200 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{activeParty.name}</h2>
                  <div className="text-xs text-slate-500 mt-1">
                    {activeParty.role} · {activeParty.phone} · {activeParty.area}
                  </div>
                  {activeParty.notes && (
                    <div className="text-xs text-slate-600 mt-2">{activeParty.notes}</div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Net Khata Balance</div>
                    {activeParty.balance > 0 ? (
                      <div className="text-xl font-bold font-mono tabular-nums text-emerald-700">
                        {formatPKR(activeParty.balance)} Lene Hain
                      </div>
                    ) : activeParty.balance < 0 ? (
                      <div className="text-xl font-bold font-mono tabular-nums text-rose-700">
                        {formatPKR(Math.abs(activeParty.balance))} Dene Hain
                      </div>
                    ) : (
                      <div className="text-xl font-bold font-mono tabular-nums text-slate-700">
                        Rs. 0 Clear
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={openSettleModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Record Payment</span>
                  </button>
                </div>
              </div>

              {/* Buying / Selling History */}
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">
                    Buying &amp; Invoice History ({partyInvoices.length})
                  </h3>
                  {partyInvoices.length === 0 ? (
                    <div className="text-xs text-slate-500 py-4 border border-slate-200 rounded-lg text-center">
                      No battery invoices recorded for this party yet.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                            <th className="py-2.5 px-3">Invoice</th>
                            <th className="py-2.5 px-3">Items Bought / Sold</th>
                            <th className="py-2.5 px-3 text-right">Total</th>
                            <th className="py-2.5 px-3 text-right">Paid (%)</th>
                            <th className="py-2.5 px-3 text-right">Remaining</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {partyInvoices.map((inv) => (
                            <tr key={inv.id}>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="font-mono font-semibold text-slate-900">
                                  {inv.invoiceNo}
                                </div>
                                <div className="text-slate-500 font-mono">{inv.date}</div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-700">
                                {inv.items.map((it) => `${it.qty}x ${it.productName}`).join(', ')}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium whitespace-nowrap">
                                {formatPKR(inv.totalAmount)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                                {formatPKR(inv.paidAmount)} ({inv.paymentPercent}%)
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold whitespace-nowrap">
                                {inv.remainingAmount > 0 ? (
                                  <span className="text-amber-700">
                                    {formatPKR(inv.remainingAmount)}
                                  </span>
                                ) : (
                                  <span className="text-emerald-700">Cleared</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {partyScrap.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">
                      Scrap Supplied ({partyScrap.length})
                    </h3>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                            <th className="py-2 px-3">Receipt</th>
                            <th className="py-2 px-3">Scrap Name</th>
                            <th className="py-2 px-3 text-right">Weight (kg)</th>
                            <th className="py-2 px-3 text-right">Total</th>
                            <th className="py-2 px-3 text-right">Payable Baqi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {partyScrap.map((s) => (
                            <tr key={s.id}>
                              <td className="py-2 px-3 font-mono whitespace-nowrap">{s.receiptNo}</td>
                              <td className="py-2 px-3 font-medium text-slate-900">{s.scrapName}</td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                                {s.weightKg} kg
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                                {formatPKR(s.totalAmount)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-rose-700 whitespace-nowrap">
                                {formatPKR(s.remainingAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">
                    Cash &amp; Udhaar Payment History ({partyCashTx.length})
                  </h3>
                  {partyCashTx.length === 0 ? (
                    <div className="text-xs text-slate-500">No cash payments recorded yet.</div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                      {partyCashTx.map((tx) => (
                        <div
                          key={tx.id}
                          className="px-4 py-2.5 flex items-center justify-between gap-4 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-mono text-slate-500 mr-2 whitespace-nowrap">
                              {tx.date}
                            </span>
                            <span className="font-medium text-slate-800">{tx.note}</span>
                            <span className="text-slate-500 ml-2 whitespace-nowrap">
                              ({accountNameById.get(tx.accountId) || tx.accountId})
                            </span>
                          </div>
                          <span
                            className={`font-mono tabular-nums font-bold whitespace-nowrap shrink-0 ${
                              tx.direction === 'IN' ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {tx.direction === 'IN' ? '+' : '-'}
                            {formatPKR(tx.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-slate-500">
              Select a party to inspect their history and udhaar balance.
            </div>
          )}
        </section>
      </div>

      {/* Add Party Modal */}
      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Add Party"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Add Customer or Supplier</h2>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                aria-label="Close add party dialog"
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddParty} className="p-6 space-y-4 text-sm">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                  {errorMsg}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Party Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Nadeem Battery House"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0300-1234567"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as PartyRole)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="CUSTOMER">Customer</option>
                    <option value="SUPPLIER">Supplier</option>
                    <option value="BOTH">Both</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  City / Area
                </label>
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Hall Road, Lahore"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Opening Udhaar (+ Lene Hain, - Dene Hain)
                </label>
                <input
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
                >
                  Save Party
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Payment Modal */}
      {paymentModalOpen && activeParty && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Record payment for ${activeParty.name}`}
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-bold text-slate-900">Record Payment / Udhaar</h2>
                <div className="text-xs text-slate-500">{activeParty.name}</div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                aria-label="Close payment modal"
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4 text-sm">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                  {errorMsg}
                </div>
              )}

              <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPayDirection('IN')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md ${
                    payDirection === 'IN' ? 'bg-emerald-700 text-white' : 'text-slate-700'
                  }`}
                >
                  Received (Wasooli)
                </button>
                <button
                  type="button"
                  onClick={() => setPayDirection('OUT')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md ${
                    payDirection === 'OUT' ? 'bg-rose-700 text-white' : 'text-slate-700'
                  }`}
                >
                  Paid Out (Adayegi)
                </button>
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
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Account (Kis Mein Aya / Gaya)
                </label>
                <select
                  value={payAccountId}
                  onChange={(e) => setPayAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {db.accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatPKR(acc.balance)})
                    </option>
                  ))}
                </select>
              </div>

              {partyInvoices.some((i) => i.remainingAmount > 0) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Apply to Invoice (Optional)
                  </label>
                  <select
                    value={payInvoiceId}
                    onChange={(e) => setPayInvoiceId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">Auto-adjust oldest open invoice</option>
                    {partyInvoices
                      .filter((i) => i.remainingAmount > 0)
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.invoiceNo} · Baqiya {formatPKR(i.remainingAmount)}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Note</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="e.g. Remaining 90% received via EasyPaisa"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
                >
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
