import { Menu, Plus, Scale } from 'lucide-react';
import type { NavSection } from './Sidebar';

interface TopBarProps {
  activeSection: NavSection;
  onOpenNewInvoice: () => void;
  onOpenScrapEntry: () => void;
  onOpenMobileMenu: () => void;
}

const SECTION_TITLES: Record<NavSection, string> = {
  overview: 'Desktop Overview',
  invoices: 'Invoicing (Sale Out & Purchase In)',
  inventory: 'Battery Inventory',
  parties: 'Parties & Udhaar Khata',
  accounts: 'Accounts & Cash Flow',
  scrap: 'Scrap Purchase (KG Log)',
  dayend: 'Day-End Hisaab',
};

export function TopBar({
  activeSection,
  onOpenNewInvoice,
  onOpenScrapEntry,
  onOpenMobileMenu,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-6 bg-white border-b border-slate-200 px-4 lg:px-8 py-3.5 no-print">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-400 font-medium whitespace-nowrap">VoltKhata</span>
          <span className="text-slate-300" aria-hidden="true">/</span>
          <h1 className="font-semibold text-slate-900 truncate">
            {SECTION_TITLES[activeSection]}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onOpenScrapEntry}
          className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
        >
          <Scale className="w-3.5 h-3.5" />
          <span>Log Scrap (kg)</span>
        </button>
        <button
          type="button"
          onClick={onOpenNewInvoice}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Invoice</span>
        </button>
      </div>
    </header>
  );
}
