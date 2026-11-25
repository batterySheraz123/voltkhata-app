import { useMemo, useState } from 'react';
import { Scale } from 'lucide-react';
import type { CreateScrapInput, ErpDatabase } from '../types/erp';
import { getTodayDateString } from '../data/seedData';
import { formatKg, formatPKR } from '../utils/erpLogic';

interface ScrapViewProps {
  db: ErpDatabase;
  onCreateScrap: (input: CreateScrapInput) => Promise<void>;
}

const SCRAP_PRESETS = [
  'Dead Car Lead-Acid Battery Scrap',
  'Old Tubular Plate Scrap',
  'Dry UPS Battery Scrap',
  'Pure Lead Ingot (Sikka)',
  'Motorcycle Old Battery Scrap',
  'Plastic Battery Casing Scrap',
];

export function ScrapView({ db, onCreateScrap }: ScrapViewProps) {
  const [date, setDate] = useState(getTodayDateString());
  const [scrapName, setScrapName] = useState('Dead Car Lead-Acid Battery Scrap');
  const [weightKg, setWeightKg] = useState(50);
  const [pieceCount, setPieceCount] = useState<string>('4');
  const [ratePerKg, setRatePerKg] = useState(410);
  const [sellerMode, setSellerMode] = useState<'WALKIN' | 'PARTY'>('WALKIN');
  const [sellerName, setSellerName] = useState('Walk-in Customer / Mechanic');
  const [partyId, setPartyId] = useState(
    db.parties.find((p) => p.role !== 'CUSTOMER')?.id || db.parties[0]?.id || ''
  );
  const [paidPercentMode, setPaidPercentMode] = useState<'FULL' | 'CUSTOM'>('FULL');
  const [customPaidAmount, setCustomPaidAmount] = useState(0);
  const [accountId, setAccountId] = useState(db.accounts[0]?.id || 'acc-cash');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const computedTotal = Math.round((Number(weightKg) || 0) * (Number(ratePerKg) || 0));
  const actualPaid =
    paidPercentMode === 'FULL'
      ? computedTotal
      : Math.min(computedTotal, Math.max(0, Math.round(Number(customPaidAmount) || 0)));

  const totalScrapKg = db.scrapPurchases.reduce((sum, s) => sum + s.weightKg, 0);
  const totalScrapSpend = db.scrapPurchases.reduce((sum, s) => sum + s.totalAmount, 0);
  const avgRatePerKg = totalScrapKg > 0 ? Math.round(totalScrapSpend / totalScrapKg) : 0;

  const summaryByName = useMemo(() => {
    const map = new Map<string, { weightKg: number; totalAmount: number; entries: number }>();
    for (const s of db.scrapPurchases) {
      const existing = map.get(s.scrapName) || { weightKg: 0, totalAmount: 0, entries: 0 };
      existing.weightKg += s.weightKg;
      existing.totalAmount += s.totalAmount;
      existing.entries += 1;
      map.set(s.scrapName, existing);
    }
    return Array.from(map.entries()).map(([name, stats]) => ({ name, ...stats }));
  }, [db.scrapPurchases]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);
    try {
      await onCreateScrap({
        date,
        scrapName,
        weightKg: Number(weightKg),
        pieceCount: pieceCount ? Number(pieceCount) : undefined,
        ratePerKg: Number(ratePerKg),
        paidAmount: actualPaid,
        partyId: sellerMode === 'PARTY' ? partyId : undefined,
        sellerName: sellerMode === 'WALKIN' ? sellerName : '',
        accountId: actualPaid > 0 ? accountId : undefined,
        notes,
      });
      setNotes('');
      setCustomPaidAmount(0);
      setPaidPercentMode('FULL');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save scrap entry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Scrap Metrics */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Total Scrap Purchased (Weight)</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatKg(totalScrapKg)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Across {db.scrapPurchases.length} weighed lots
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Total Scrap Purchase Value</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatPKR(totalScrapSpend)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Auto-deducted from selected accounts</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Average Rate per KG</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatPKR(avgRatePerKg)} / kg
          </div>
          <div className="mt-1 text-xs text-slate-500">Blended lead &amp; casing average</div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Scrap Entry Form */}
        <section className="xl:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
            <Scale className="w-4 h-4 text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              Buy Scrap by Name &amp; Weight (KG)
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4 text-sm">
            {errorMsg && (
              <div
                role="alert"
                className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800"
              >
                {errorMsg}
              </div>
            )}

            <div>
              <label
                htmlFor="scrap-name-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Scrap Name / Material Type
              </label>
              <input
                id="scrap-name-input"
                type="text"
                required
                value={scrapName}
                onChange={(e) => setScrapName(e.target.value)}
                placeholder="e.g. Old Tubular Battery Scrap"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SCRAP_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setScrapName(preset)}
                    className="px-2 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="scrap-weight-kg"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Weight (kg)
                </label>
                <input
                  id="scrap-weight-kg"
                  type="number"
                  step="0.5"
                  min={0.5}
                  required
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
              <div>
                <label
                  htmlFor="scrap-rate-kg"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Rate / kg (Rs.)
                </label>
                <input
                  id="scrap-rate-kg"
                  type="number"
                  min={1}
                  required
                  value={ratePerKg}
                  onChange={(e) => setRatePerKg(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
              <div>
                <label
                  htmlFor="scrap-pieces"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Pieces (Opt)
                </label>
                <input
                  id="scrap-pieces"
                  type="number"
                  min={0}
                  value={pieceCount}
                  onChange={(e) => setPieceCount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="scrap-date"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Purchase Date
                </label>
                <input
                  id="scrap-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Seller Type</label>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSellerMode('WALKIN')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md ${
                      sellerMode === 'WALKIN' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Walk-in
                  </button>
                  <button
                    type="button"
                    onClick={() => setSellerMode('PARTY')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md ${
                      sellerMode === 'PARTY' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Saved Party
                  </button>
                </div>
              </div>
            </div>

            {sellerMode === 'WALKIN' ? (
              <div>
                <label
                  htmlFor="scrap-seller-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Seller Name (Kabaria / Customer)
                </label>
                <input
                  id="scrap-seller-name"
                  type="text"
                  required
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            ) : (
              <div>
                <label
                  htmlFor="scrap-party-select"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Select Party
                </label>
                <select
                  id="scrap-party-select"
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {db.parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Total Scrap Bill</span>
                <span className="font-mono tabular-nums text-base font-bold text-slate-900">
                  {formatPKR(computedTotal)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paidPercentMode}
                    onChange={(e) => {
                      const val = e.target.value as 'FULL' | 'CUSTOM';
                      setPaidPercentMode(val);
                      if (val === 'CUSTOM') setCustomPaidAmount(Math.round(computedTotal * 0.5));
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                  >
                    <option value="FULL">100% Cash Paid</option>
                    <option value="CUSTOM">Partial / Udhaar</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Paid From Account
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    disabled={actualPaid === 0}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md disabled:opacity-50"
                  >
                    {db.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatPKR(a.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {paidPercentMode === 'CUSTOM' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Paid Now (Rs.) — Remaining becomes Payable
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={computedTotal}
                    value={customPaidAmount}
                    onChange={(e) => setCustomPaidAmount(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md"
                  />
                </div>
              )}
            </div>

            <div>
              <label htmlFor="scrap-notes" className="block text-xs font-semibold text-slate-700 mb-1">
                Notes
              </label>
              <input
                id="scrap-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Digital scale slip #42"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 px-4 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-50"
            >
              {saving ? 'Saving Scrap Entry...' : 'Save Scrap Purchase'}
            </button>
          </form>
        </section>

        {/* Right: Scrap Breakdown by Name & Full Purchase History */}
        <div className="xl:col-span-7 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">
                Scrap Stock Summary by Material Name
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-semibold text-slate-500">
                    <th className="py-2.5 px-5">Scrap Name</th>
                    <th className="py-2.5 px-4 text-right">Lots</th>
                    <th className="py-2.5 px-4 text-right">Total Weight (kg)</th>
                    <th className="py-2.5 px-5 text-right">Total Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaryByName.map((row) => (
                    <tr key={row.name}>
                      <td className="py-3 px-5 font-medium text-slate-900">{row.name}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                        {row.entries}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatKg(row.weightKg)}
                      </td>
                      <td className="py-3 px-5 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatPKR(row.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">
                Scrap Purchase Register ({db.scrapPurchases.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-semibold text-slate-500">
                    <th className="py-2.5 px-5">Receipt &amp; Date</th>
                    <th className="py-2.5 px-4">Scrap Name &amp; Seller</th>
                    <th className="py-2.5 px-4 text-right">Weight (kg)</th>
                    <th className="py-2.5 px-4 text-right">Rate/kg</th>
                    <th className="py-2.5 px-5 text-right">Total / Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {db.scrapPurchases.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-5 whitespace-nowrap">
                        <div className="font-mono font-semibold text-slate-900">{s.receiptNo}</div>
                        <div className="text-xs text-slate-500 font-mono">{s.date}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{s.scrapName}</div>
                        <div className="text-xs text-slate-500">
                          {s.sellerName}
                          {s.pieceCount ? ` · ${s.pieceCount} pcs` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {formatKg(s.weightKg)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatPKR(s.ratePerKg)}
                      </td>
                      <td className="py-3 px-5 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {formatPKR(s.totalAmount)}
                        </div>
                        {s.remainingAmount > 0 ? (
                          <div className="text-xs text-rose-700">
                            Baqi: {formatPKR(s.remainingAmount)}
                          </div>
                        ) : (
                          <div className="text-xs text-emerald-700">Paid 100%</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
