import {
  ArrowLeftRight,
  BatteryCharging,
  CalendarCheck,
  FileText,
  LayoutDashboard,
  RotateCcw,
  Scale,
  Users,
  X,
} from 'lucide-react';
import type { ErpDatabase } from '../types/erp';
import { formatPKR } from '../utils/erpLogic';

export type NavSection =
  | 'overview'
  | 'invoices'
  | 'inventory'
  | 'parties'
  | 'accounts'
  | 'scrap'
  | 'dayend';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  db: ErpDatabase;
  onResetDemo: () => void;
  isResetting: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: NavSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Desktop Overview', icon: LayoutDashboard },
  { id: 'invoices', label: 'Invoicing (In / Out)', icon: FileText },
  { id: 'inventory', label: 'Battery Inventory', icon: BatteryCharging },
  { id: 'parties', label: 'Parties & Khata', icon: Users },
  { id: 'accounts', label: 'Accounts & Cash Flow', icon: ArrowLeftRight },
  { id: 'scrap', label: 'Scrap Purchase (kg)', icon: Scale },
  { id: 'dayend', label: 'Day-End Hisaab', icon: CalendarCheck },
];

export function Sidebar({
  activeSection,
  onSelectSection,
  db,
  onResetDemo,
  isResetting,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const totalLiquidity = db.accounts.reduce((sum, a) => sum + a.balance, 0);
  const totalReceivable = db.parties
    .filter((p) => p.balance > 0)
    .reduce((sum, p) => sum + p.balance, 0);
  const totalPayable = db.parties
    .filter((p) => p.balance < 0)
    .reduce((sum, p) => sum + Math.abs(p.balance), 0);

  const sidebarContent = (
    <div className="flex h-full w-[252px] flex-col bg-slate-900 text-slate-100 select-none">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <div>
          <div className="text-base font-bold tracking-tight text-white">VoltKhata</div>
          <div className="text-xs text-slate-400 truncate max-w-[180px]">{db.shopName}</div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main Navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectSection(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap text-left ${
                isActive
                  ? 'bg-blue-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-slate-800 space-y-3">
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span>Total Cash & Bank</span>
            <span className="font-mono tabular-nums font-semibold text-slate-100">
              {formatPKR(totalLiquidity)}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Lene Hain (Udhaar)</span>
            <span className="font-mono tabular-nums font-semibold text-emerald-400">
              {formatPKR(totalReceivable)}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Dene Hain (Payable)</span>
            <span className="font-mono tabular-nums font-semibold text-rose-400">
              {formatPKR(totalPayable)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onResetDemo}
          disabled={isResetting}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{isResetting ? 'Resetting...' : 'Reset Demo Data'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 no-print">{sidebarContent}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden no-print">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
