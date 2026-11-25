import { useState } from 'react';
import { Plus, SlidersHorizontal, X } from 'lucide-react';
import type { BatteryBrand, BatteryCategory, ErpDatabase, Product } from '../types/erp';
import { getTodayDateString } from '../data/seedData';
import { formatPKR } from '../utils/erpLogic';

interface InventoryViewProps {
  db: ErpDatabase;
  onAddProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  onAdjustStock: (payload: {
    productId: string;
    deltaQty: number;
    date: string;
    note: string;
  }) => Promise<void>;
}

const BRANDS: BatteryBrand[] = ['Exide', 'AGS', 'Phoenix', 'Osaka', 'Daewoo', 'Volta', 'Other'];
const CATEGORIES: BatteryCategory[] = [
  'Tubular',
  'Dry / MF',
  'Lead-Acid Auto',
  'Solar Deep Cycle',
  'UPS / Inverter',
];

export function InventoryView({ db, onAddProduct, onAdjustStock }: InventoryViewProps) {
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('ALL');
  const [tab, setTab] = useState<'STOCK' | 'MOVEMENTS'>('STOCK');
  const [addOpen, setAddOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Add form
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState<BatteryBrand>('Exide');
  const [category, setCategory] = useState<BatteryCategory>('Tubular');
  const [voltage, setVoltage] = useState('12V');
  const [capacityAh, setCapacityAh] = useState(180);
  const [purchasePrice, setPurchasePrice] = useState(35000);
  const [salePrice, setSalePrice] = useState(40000);
  const [stockQty, setStockQty] = useState(5);
  const [minStockAlert, setMinStockAlert] = useState(4);
  const [location, setLocation] = useState('Rack A-1');
  const [warrantyMonths, setWarrantyMonths] = useState(12);

  // Adjust form
  const [adjustMode, setAdjustMode] = useState<'IN' | 'OUT'>('IN');
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustNote, setAdjustNote] = useState('');

  const filteredProducts = db.products.filter((p) => {
    if (brandFilter !== 'ALL' && p.brand !== brandFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      await onAddProduct({
        sku,
        name,
        brand,
        category,
        voltage,
        capacityAh: Number(capacityAh),
        purchasePrice: Number(purchasePrice),
        salePrice: Number(salePrice),
        stockQty: Number(stockQty),
        minStockAlert: Number(minStockAlert),
        location,
        warrantyMonths: Number(warrantyMonths),
      });
      setAddOpen(false);
      setSku('');
      setName('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add battery.');
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    setErrorMsg('');
    try {
      const delta = adjustMode === 'IN' ? Math.abs(adjustQty) : -Math.abs(adjustQty);
      await onAdjustStock({
        productId: adjustTarget.id,
        deltaQty: delta,
        date: getTodayDateString(),
        note: adjustNote || (adjustMode === 'IN' ? 'Manual stock in' : 'Manual stock out'),
      });
      setAdjustTarget(null);
      setAdjustQty(1);
      setAdjustNote('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to adjust stock.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('STOCK')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                tab === 'STOCK'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Battery Stock ({db.products.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('MOVEMENTS')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                tab === 'MOVEMENTS'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              In / Out Log ({db.stockMovements.length})
            </button>
          </div>

          {tab === 'STOCK' && (
            <>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search battery model or SKU..."
                aria-label="Search battery inventory"
                className="w-60 px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg"
              />
              <select
                aria-label="Filter by brand"
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg"
              >
                <option value="ALL">All Brands</option>
                {BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </>
          )}
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
          <span>Add Battery Model</span>
        </button>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="px-4 py-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800"
        >
          {errorMsg}
        </div>
      )}

      {tab === 'STOCK' ? (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-5">Battery Model &amp; SKU</th>
                  <th className="py-3 px-4">Specs</th>
                  <th className="py-3 px-4 text-right">Purchase Rate</th>
                  <th className="py-3 px-4 text-right">Sale Rate</th>
                  <th className="py-3 px-4 text-right">Stock Qty</th>
                  <th className="py-3 px-4 text-right">Stock Value</th>
                  <th className="py-3 px-5 text-right">Adjust</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredProducts.map((p) => {
                  const isLow = p.stockQty <= p.minStockAlert;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-5">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          {p.sku} · {p.brand} · {p.location}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {p.category} · {p.voltage} / {p.capacityAh}Ah · {p.warrantyMonths}m
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {formatPKR(p.purchasePrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                        {formatPKR(p.salePrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <span
                          className={`font-bold ${
                            p.stockQty === 0
                              ? 'text-rose-700'
                              : isLow
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                          }`}
                        >
                          {p.stockQty}
                        </span>
                        {isLow && (
                          <span className="block text-[11px] text-amber-700">
                            Low (min {p.minStockAlert})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {formatPKR(p.stockQty * p.purchasePrice)}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustTarget(p);
                            setAdjustMode('IN');
                            setAdjustQty(1);
                            setAdjustNote('');
                            setErrorMsg('');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-100"
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                          <span>In / Out</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-4">Battery Model</th>
                  <th className="py-3 px-4">Movement</th>
                  <th className="py-3 px-4 text-right">Qty Change</th>
                  <th className="py-3 px-4 text-right">New Balance</th>
                  <th className="py-3 px-5">Reference / Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {db.stockMovements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-5 font-mono text-xs text-slate-600">{mov.date}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{mov.productName}</td>
                    <td className="py-3 px-4 text-xs font-semibold">
                      {mov.qtyChange > 0 ? (
                        <span className="text-emerald-700">Stock IN</span>
                      ) : (
                        <span className="text-rose-700">Stock OUT</span>
                      )}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-bold ${
                        mov.qtyChange > 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {mov.qtyChange > 0 ? `+${mov.qtyChange}` : mov.qtyChange}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                      {mov.resultingQty}
                    </td>
                    <td className="py-3 px-5 text-xs text-slate-600">{mov.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Add Battery Modal */}
      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Add Battery Model"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-xl w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Add Battery Model</h2>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                aria-label="Close add battery dialog"
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SKU Code</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="EX-TR2000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Battery Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Exide TR-2000 Heavy Tubular"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
                  <select
                    value={brand}
                    onChange={(e) => setBrand(e.target.value as BatteryBrand)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {BRANDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as BatteryCategory)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Voltage</label>
                  <input
                    type="text"
                    value={voltage}
                    onChange={(e) => setVoltage(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Capacity (Ah)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={capacityAh}
                    onChange={(e) => setCapacityAh(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Purchase Rate
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sale Rate
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={salePrice}
                    onChange={(e) => setSalePrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Opening Qty
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={stockQty}
                    onChange={(e) => setStockQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Min Alert Qty
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minStockAlert}
                    onChange={(e) => setMinStockAlert(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rack / Shelf
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Warranty (Months)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={warrantyMonths}
                    onChange={(e) => setWarrantyMonths(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
                >
                  Save Battery Model
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Adjust stock for ${adjustTarget.name}`}
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-bold text-slate-900">Adjust Stock Quantity</h2>
                <div className="text-xs text-slate-500">
                  {adjustTarget.name} · Current: {adjustTarget.stockQty} units
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                aria-label="Close adjust stock dialog"
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAdjustSubmit} className="p-6 space-y-4 text-sm">
              <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setAdjustMode('IN')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md ${
                    adjustMode === 'IN' ? 'bg-emerald-700 text-white' : 'text-slate-700'
                  }`}
                >
                  Stock IN (+)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustMode('OUT')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md ${
                    adjustMode === 'OUT' ? 'bg-rose-700 text-white' : 'text-slate-700'
                  }`}
                >
                  Stock OUT (-)
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason / Note
                </label>
                <input
                  type="text"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="e.g. Warranty replacement / Physical recount"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
                >
                  Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
