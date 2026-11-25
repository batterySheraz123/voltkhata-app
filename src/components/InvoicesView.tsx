import { useEffect, useMemo, useState } from 'react';
import { Eye, Plus, Printer, Trash2, UserPlus, X } from 'lucide-react';
import type { CreateInvoiceInput, ErpDatabase, Invoice, InvoiceType, PartyRole } from '../types/erp';
import { getTodayDateString } from '../data/seedData';
import { computePaymentBreakdown, formatPKR } from '../utils/erpLogic';

interface InvoicesViewProps {
  db: ErpDatabase;
  onCreateInvoice: (input: CreateInvoiceInput) => Promise<Invoice>;
  onCreateParty: (party: {
    name: string;
    phone: string;
    area: string;
    role: PartyRole;
  }) => Promise<string>;
  initialComposeType?: InvoiceType | null;
  onClearComposeTrigger?: () => void;
}

interface DraftLine {
  productId: string;
  qty: number;
  unitPrice: number;
}

export function InvoicesView({
  db,
  onCreateInvoice,
  onCreateParty,
  initialComposeType,
  onClearComposeTrigger,
}: InvoicesViewProps) {
  const [filterType, setFilterType] = useState<'ALL' | InvoiceType | 'PARTIAL'>('ALL');
  const [search, setSearch] = useState('');
  const [composerOpen, setComposerOpen] = useState(Boolean(initialComposeType));
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  // Composer form state
  const [invType, setInvType] = useState<InvoiceType>(initialComposeType || 'SALE_OUT');
  const [date, setDate] = useState(getTodayDateString());
  const [partyId, setPartyId] = useState(() => {
    const firstMatch = db.parties.find((p) =>
      (initialComposeType || 'SALE_OUT') === 'SALE_OUT'
        ? p.role !== 'SUPPLIER'
        : p.role !== 'CUSTOMER'
    );
    return firstMatch?.id || db.parties[0]?.id || '';
  });
  const [lines, setLines] = useState<DraftLine[]>(() => {
    const firstProd = db.products[0];
    return firstProd
      ? [
          {
            productId: firstProd.id,
            qty: 1,
            unitPrice:
              (initialComposeType || 'SALE_OUT') === 'SALE_OUT'
                ? firstProd.salePrice
                : firstProd.purchasePrice,
          },
        ]
      : [];
  });
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [accountId, setAccountId] = useState(db.accounts[0]?.id || 'acc-cash');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Quick-add party inline
  const [showQuickParty, setShowQuickParty] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [newPartyArea, setNewPartyArea] = useState('');

  const openComposer = (type: InvoiceType) => {
    setInvType(type);
    setDate(getTodayDateString());
    const matchingParty = db.parties.find((p) =>
      type === 'SALE_OUT' ? p.role !== 'SUPPLIER' : p.role !== 'CUSTOMER'
    );
    setPartyId(matchingParty?.id || db.parties[0]?.id || '');
    const firstProd = db.products[0];
    if (firstProd) {
      const price = type === 'SALE_OUT' ? firstProd.salePrice : firstProd.purchasePrice;
      setLines([{ productId: firstProd.id, qty: 1, unitPrice: price }]);
      setPaidAmount(price);
    }
    setDiscount(0);
    setDueDate('');
    setNotes('');
    setErrorMsg('');
    setComposerOpen(true);
  };

  useEffect(() => {
    if (initialComposeType) {
      openComposer(initialComposeType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialComposeType]);

  // Switch invoice type inside composer
  const handleSwitchType = (nextType: InvoiceType) => {
    setInvType(nextType);
    const matchingParty = db.parties.find((p) =>
      nextType === 'SALE_OUT' ? p.role !== 'SUPPLIER' : p.role !== 'CUSTOMER'
    );
    if (matchingParty) setPartyId(matchingParty.id);
    setLines((prev) =>
      prev.map((l) => {
        const prod = db.products.find((p) => p.id === l.productId);
        if (!prod) return l;
        return {
          ...l,
          unitPrice: nextType === 'SALE_OUT' ? prod.salePrice : prod.purchasePrice,
        };
      })
    );
  };

  const subtotal = lines.reduce(
    (sum, l) => sum + Math.round((Number(l.qty) || 0) * (Number(l.unitPrice) || 0)),
    0
  );
  const cleanDiscount = Math.max(0, Math.min(subtotal, Math.round(Number(discount) || 0)));
  const totalAmount = Math.max(0, subtotal - cleanDiscount);
  const breakdown = computePaymentBreakdown(totalAmount, Number(paidAmount) || 0);

  const selectedParty = db.parties.find((p) => p.id === partyId);
  const selectedPartyInvoices = useMemo(() => {
    if (!partyId) return [];
    return db.invoices.filter((i) => i.partyId === partyId);
  }, [db.invoices, partyId]);

  const handlePercentPreset = (pct: number) => {
    const amt = Math.round((totalAmount * pct) / 100);
    setPaidAmount(amt);
    if (pct === 10) {
      setNotes((prev) =>
        prev.trim() ? prev : '10% advance payment received, remaining 90% due later.'
      );
    }
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);
    try {
      const created = await onCreateInvoice({
        type: invType,
        date,
        partyId,
        items: lines.map((l) => ({
          productId: l.productId,
          qty: Number(l.qty),
          unitPrice: Number(l.unitPrice),
        })),
        discount: cleanDiscount,
        paidAmount: breakdown.paidAmount,
        accountId: breakdown.paidAmount > 0 ? accountId : undefined,
        dueDate: dueDate || undefined,
        notes,
      });
      setComposerOpen(false);
      onClearComposeTrigger?.();
      setPreviewInvoice(created);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save invoice.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAddParty = async () => {
    if (!newPartyName.trim()) return;
    try {
      const newId = await onCreateParty({
        name: newPartyName.trim(),
        phone: newPartyPhone.trim(),
        area: newPartyArea.trim(),
        role: invType === 'SALE_OUT' ? 'CUSTOMER' : 'SUPPLIER',
      });
      setPartyId(newId);
      setNewPartyName('');
      setNewPartyPhone('');
      setNewPartyArea('');
      setShowQuickParty(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create party.');
    }
  };

  const filteredInvoices = db.invoices.filter((inv) => {
    if (filterType === 'SALE_OUT' && inv.type !== 'SALE_OUT') return false;
    if (filterType === 'PURCHASE_IN' && inv.type !== 'PURCHASE_IN') return false;
    if (filterType === 'PARTIAL' && inv.remainingAmount <= 0) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        inv.invoiceNo.toLowerCase().includes(q) ||
        inv.partyName.toLowerCase().includes(q) ||
        inv.items.some((it) => it.productName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            {(
              [
                { id: 'ALL', label: 'All Invoices' },
                { id: 'SALE_OUT', label: 'Sales (Stock Out)' },
                { id: 'PURCHASE_IN', label: 'Purchases (Stock In)' },
                { id: 'PARTIAL', label: 'Pending / Partial' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  filterType === tab.id
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
            placeholder="Search invoice #, party, or battery..."
            aria-label="Search invoices"
            className="w-64 px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openComposer('PURCHASE_IN')}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            + Purchase Bill (In)
          </button>
          <button
            type="button"
            onClick={() => openComposer('SALE_OUT')}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap"
          >
            + Sale Invoice (Out)
          </button>
        </div>
      </div>

      {/* Invoice Composer Drawer/Panel */}
      {composerOpen && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/60">
            <div className="flex items-center gap-4">
              <h2 className="text-base font-bold text-slate-900">
                {invType === 'SALE_OUT'
                  ? 'Create Sale Invoice (Auto Stock OUT)'
                  : 'Create Purchase Bill (Auto Stock IN)'}
              </h2>
              <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg">
                <button
                  type="button"
                  onClick={() => handleSwitchType('SALE_OUT')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md whitespace-nowrap ${
                    invType === 'SALE_OUT'
                      ? 'bg-blue-700 text-white'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Sale (Out)
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchType('PURCHASE_IN')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md whitespace-nowrap ${
                    invType === 'PURCHASE_IN'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Purchase (In)
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setComposerOpen(false);
                onClearComposeTrigger?.();
              }}
              aria-label="Close invoice builder"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveInvoice} className="grid grid-cols-1 xl:grid-cols-12">
            {/* Left 8 cols: Invoice fields, items, payment */}
            <div className="xl:col-span-8 p-6 space-y-5 border-b xl:border-b-0 xl:border-r border-slate-200">
              {errorMsg && (
                <div
                  role="alert"
                  className="px-4 py-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800"
                >
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="invoice-party-select"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      {invType === 'SALE_OUT' ? 'Customer / Buyer' : 'Supplier / Distributor'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowQuickParty((v) => !v)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>New Party</span>
                    </button>
                  </div>
                  <select
                    id="invoice-party-select"
                    value={partyId}
                    onChange={(e) => setPartyId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  >
                    {db.parties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="invoice-date-input"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Invoice Date
                  </label>
                  <input
                    id="invoice-date-input"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
              </div>

              {showQuickParty && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Party Name
                    </label>
                    <input
                      type="text"
                      value={newPartyName}
                      onChange={(e) => setNewPartyName(e.target.value)}
                      placeholder="e.g. Hamza Autos"
                      className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                    <input
                      type="text"
                      value={newPartyPhone}
                      onChange={(e) => setNewPartyPhone(e.target.value)}
                      placeholder="0300-1234567"
                      className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Area</label>
                    <input
                      type="text"
                      value={newPartyArea}
                      onChange={(e) => setNewPartyArea(e.target.value)}
                      placeholder="Hall Road"
                      className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-300 rounded-md"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleQuickAddParty}
                    className="py-1.5 px-3 bg-slate-900 text-white text-xs font-semibold rounded-md hover:bg-slate-800"
                  >
                    Add Party
                  </button>
                </div>
              )}

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">
                    Battery Line Items (Quantity auto-updates inventory)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const prod = db.products[0];
                      if (!prod) return;
                      setLines((prev) => [
                        ...prev,
                        {
                          productId: prod.id,
                          qty: 1,
                          unitPrice: invType === 'SALE_OUT' ? prod.salePrice : prod.purchasePrice,
                        },
                      ]);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Battery Row</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
                        <th className="py-2 px-3">Battery Model (Available Stock)</th>
                        <th className="py-2 px-3 w-24 text-right">Qty</th>
                        <th className="py-2 px-3 w-32 text-right">Rate (Rs.)</th>
                        <th className="py-2 px-3 w-32 text-right">Line Total</th>
                        <th className="py-2 px-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {lines.map((line, idx) => {
                        const prod = db.products.find((p) => p.id === line.productId);
                        const rowTotal = Math.round(
                          (Number(line.qty) || 0) * (Number(line.unitPrice) || 0)
                        );
                        return (
                          <tr key={idx}>
                            <td className="py-2 px-3">
                              <select
                                aria-label={`Battery item ${idx + 1}`}
                                value={line.productId}
                                onChange={(e) => {
                                  const picked = db.products.find((p) => p.id === e.target.value);
                                  setLines((prev) =>
                                    prev.map((row, rIdx) =>
                                      rIdx === idx && picked
                                        ? {
                                            ...row,
                                            productId: picked.id,
                                            unitPrice:
                                              invType === 'SALE_OUT'
                                                ? picked.salePrice
                                                : picked.purchasePrice,
                                          }
                                        : row
                                    )
                                  );
                                }}
                                className="w-full px-2 py-1.5 text-sm bg-white border border-slate-300 rounded-md"
                              >
                                {db.products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.stockQty} in stock)
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min={1}
                                max={invType === 'SALE_OUT' && prod ? prod.stockQty : undefined}
                                aria-label={`Quantity row ${idx + 1}`}
                                value={line.qty}
                                onChange={(e) =>
                                  setLines((prev) =>
                                    prev.map((row, rIdx) =>
                                      rIdx === idx ? { ...row, qty: Number(e.target.value) } : row
                                    )
                                  )
                                }
                                className="w-full px-2 py-1.5 text-sm font-mono tabular-nums text-right border border-slate-300 rounded-md"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min={0}
                                aria-label={`Unit rate row ${idx + 1}`}
                                value={line.unitPrice}
                                onChange={(e) =>
                                  setLines((prev) =>
                                    prev.map((row, rIdx) =>
                                      rIdx === idx
                                        ? { ...row, unitPrice: Number(e.target.value) }
                                        : row
                                    )
                                  )
                                }
                                className="w-full px-2 py-1.5 text-sm font-mono tabular-nums text-right border border-slate-300 rounded-md"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                              {formatPKR(rowTotal)}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {lines.length > 1 && (
                                <button
                                  type="button"
                                  aria-label={`Remove line ${idx + 1}`}
                                  onClick={() =>
                                    setLines((prev) => prev.filter((_, rIdx) => rIdx !== idx))
                                  }
                                  className="p-1 text-slate-400 hover:text-rose-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment & Partial Udhaar Section */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800">
                    Payment &amp; Baqiya (Partial Payment e.g. 10% Jama, 90% Udhaar)
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { label: '0% Udhaar', pct: 0 },
                      { label: '10% Jama', pct: 10 },
                      { label: '25%', pct: 25 },
                      { label: '50%', pct: 50 },
                      { label: '100% Full', pct: 100 },
                    ].map((preset) => (
                      <button
                        key={preset.pct}
                        type="button"
                        onClick={() => handlePercentPreset(preset.pct)}
                        className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 rounded-md text-slate-700 hover:border-blue-600 hover:text-blue-700 transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label
                      htmlFor="inv-discount"
                      className="block text-xs font-medium text-slate-600 mb-1 whitespace-nowrap"
                    >
                      Discount (Rs.)
                    </label>
                    <input
                      id="inv-discount"
                      type="number"
                      min={0}
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="inv-paid"
                      className="block text-xs font-medium text-slate-600 mb-1 whitespace-nowrap"
                    >
                      {invType === 'SALE_OUT' ? 'Amount Jama' : 'Paid to Supplier'}
                    </label>
                    <input
                      id="inv-paid"
                      type="number"
                      min={0}
                      max={totalAmount}
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="inv-account"
                      className="block text-xs font-medium text-slate-600 mb-1 whitespace-nowrap"
                    >
                      Account
                    </label>
                    <select
                      id="inv-account"
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      disabled={breakdown.paidAmount === 0}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg disabled:opacity-50"
                    >
                      {db.accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({formatPKR(acc.balance)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="inv-duedate"
                      className="block text-xs font-medium text-slate-600 mb-1 whitespace-nowrap"
                    >
                      Promise Date
                    </label>
                    <input
                      id="inv-duedate"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="inv-notes"
                    className="block text-xs font-medium text-slate-600 mb-1"
                  >
                    Note / Baqiya Commitment
                  </label>
                  <input
                    id="inv-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. 10% jama karwaya hai, baqiya 15 din baad dene ka bola hai"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-slate-500 text-xs block">Grand Total</span>
                      <span className="font-mono tabular-nums font-bold text-slate-900 text-base">
                        {formatPKR(totalAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs block">
                        Paid ({breakdown.paymentPercent}%)
                      </span>
                      <span className="font-mono tabular-nums font-bold text-emerald-700 text-base">
                        {formatPKR(breakdown.paidAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs block">
                        {invType === 'SALE_OUT' ? 'Baqiya Udhaar' : 'Payable Remaining'}
                      </span>
                      <span className="font-mono tabular-nums font-bold text-amber-700 text-base">
                        {formatPKR(breakdown.remainingAmount)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap"
                  >
                    {saving
                      ? 'Saving...'
                      : invType === 'SALE_OUT'
                        ? 'Save Sale Invoice & Update Stock'
                        : 'Save Purchase Bill & Add Stock'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right 4 cols: Live Party Buying History & Udhaar Context */}
            <aside className="xl:col-span-4 p-6 bg-slate-50/50 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Party Buying History &amp; Udhaar
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Instant credit &amp; previous transactions for the selected party
                </p>
              </div>

              {selectedParty ? (
                <div className="space-y-4">
                  <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-2">
                    <div className="font-semibold text-slate-900">{selectedParty.name}</div>
                    <div className="text-xs text-slate-500">
                      {selectedParty.phone} · {selectedParty.area}
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-sm">
                      <span className="text-slate-600">Current Balance:</span>
                      {selectedParty.balance > 0 ? (
                        <span className="font-mono tabular-nums font-bold text-emerald-700">
                          {formatPKR(selectedParty.balance)} Lene Hain
                        </span>
                      ) : selectedParty.balance < 0 ? (
                        <span className="font-mono tabular-nums font-bold text-rose-700">
                          {formatPKR(Math.abs(selectedParty.balance))} Dene Hain
                        </span>
                      ) : (
                        <span className="font-mono tabular-nums font-medium text-slate-600">
                          Rs. 0 (Clear)
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-2">
                      Previous Invoices ({selectedPartyInvoices.length})
                    </div>
                    {selectedPartyInvoices.length === 0 ? (
                      <div className="p-4 bg-white border border-slate-200 rounded-lg text-xs text-slate-500">
                        No prior invoices with this party yet.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                        {selectedPartyInvoices.map((hist) => (
                          <div
                            key={hist.id}
                            className="p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-semibold text-slate-900">
                                {hist.invoiceNo}
                              </span>
                              <span className="text-slate-500 font-mono">{hist.date}</span>
                            </div>
                            <div className="text-slate-600 truncate">
                              {hist.items.map((it) => `${it.qty}x ${it.productName}`).join(', ')}
                            </div>
                            <div className="flex items-center justify-between gap-2 pt-1 whitespace-nowrap">
                              <span className="font-mono tabular-nums text-slate-800 font-medium">
                                {formatPKR(hist.totalAmount)}
                              </span>
                              {hist.remainingAmount > 0 ? (
                                <span className="font-mono tabular-nums font-semibold text-amber-700">
                                  Baqi: {formatPKR(hist.remainingAmount)} ({hist.paymentPercent}%)
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-semibold">Paid 100%</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500">Select a party to see history.</div>
              )}
            </aside>
          </form>
        </section>
      )}

      {/* Invoices Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                <th className="py-3 px-5">Invoice #</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Party</th>
                <th className="py-3 px-4">Items &amp; Qty</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Paid (%)</th>
                <th className="py-3 px-4 text-right">Baqiya Due</th>
                <th className="py-3 px-5 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    No matching invoices found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-5 whitespace-nowrap">
                      <div className="font-mono font-semibold text-slate-900">{inv.invoiceNo}</div>
                      <div className="text-xs text-slate-500 font-mono">{inv.date}</div>
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold whitespace-nowrap">
                      {inv.type === 'SALE_OUT' ? (
                        <span className="text-blue-700">Sale OUT</span>
                      ) : (
                        <span className="text-slate-700">Purchase IN</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{inv.partyName}</td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
                      {inv.items.map((it) => `${it.qty}x ${it.productName}`).join(', ')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {formatPKR(inv.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                      <span className="text-emerald-700 font-medium">
                        {formatPKR(inv.paidAmount)}
                      </span>
                      <span className="text-slate-400 ml-1">({inv.paymentPercent}%)</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap">
                      {inv.remainingAmount > 0 ? (
                        <span className="text-amber-700">{formatPKR(inv.remainingAmount)}</span>
                      ) : (
                        <span className="text-emerald-700 text-xs">Cleared</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setPreviewInvoice(inv)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-100"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Printable Invoice Receipt Modal */}
      {previewInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Invoice ${previewInvoice.invoiceNo}`}
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 no-print">
              <span className="text-sm font-semibold text-slate-900">
                Invoice Receipt · {previewInvoice.invoiceNo}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-700 text-white rounded-lg hover:bg-blue-800"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewInvoice(null)}
                  aria-label="Close invoice preview"
                  className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5 text-sm">
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div>
                  <div className="text-lg font-bold text-slate-900">{db.shopName}</div>
                  <div className="text-xs text-slate-500">{db.shopAddress}</div>
                  <div className="text-xs text-slate-500 font-mono">{db.shopPhone}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-base text-slate-900">
                    {previewInvoice.invoiceNo}
                  </div>
                  <div className="text-xs text-slate-500">
                    {previewInvoice.type === 'SALE_OUT' ? 'SALE INVOICE (OUT)' : 'PURCHASE BILL (IN)'}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">Date: {previewInvoice.date}</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500">Party: </span>
                  <span className="font-semibold text-slate-900">{previewInvoice.partyName}</span>
                </div>
                {previewInvoice.dueDate && (
                  <div className="font-mono text-amber-700 font-medium">
                    Due Date: {previewInvoice.dueDate}
                  </div>
                )}
              </div>

              <table className="w-full text-left border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-2 px-3">Item</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3 text-right">Rate</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {previewInvoice.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-medium text-slate-900">{it.productName}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{it.qty}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">
                        {formatPKR(it.unitPrice)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">
                        {formatPKR(it.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end">
                <dl className="w-64 space-y-1.5 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <dt>Subtotal</dt>
                    <dd className="font-mono tabular-nums">{formatPKR(previewInvoice.subtotal)}</dd>
                  </div>
                  {previewInvoice.discount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <dt>Discount</dt>
                      <dd className="font-mono tabular-nums">-{formatPKR(previewInvoice.discount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                    <dt>Total Amount</dt>
                    <dd className="font-mono tabular-nums">{formatPKR(previewInvoice.totalAmount)}</dd>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <dt>Paid ({previewInvoice.paymentPercent}%)</dt>
                    <dd className="font-mono tabular-nums">{formatPKR(previewInvoice.paidAmount)}</dd>
                  </div>
                  <div className="flex justify-between text-amber-700 font-bold">
                    <dt>Baqiya Remaining</dt>
                    <dd className="font-mono tabular-nums">
                      {formatPKR(previewInvoice.remainingAmount)}
                    </dd>
                  </div>
                </dl>
              </div>

              {previewInvoice.notes && (
                <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  Note: {previewInvoice.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
