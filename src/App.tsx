import { useCallback, useEffect, useState } from 'react';
import type {
  CreateInvoiceInput,
  CreateScrapInput,
  ErpDatabase,
  Invoice,
  InvoiceType,
  PartyRole,
  Product,
  RecordPaymentInput,
  TransferFundsInput,
} from './types/erp';
import { AccountsView } from './components/AccountsView';
import { DashboardView } from './components/DashboardView';
import { DayEndView } from './components/DayEndView';
import { InventoryView } from './components/InventoryView';
import { InvoicesView } from './components/InvoicesView';
import { PartiesView } from './components/PartiesView';
import { ScrapView } from './components/ScrapView';
import { Sidebar, type NavSection } from './components/Sidebar';
import { TopBar } from './components/TopBar';

async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data as T;
}

export default function App() {
  const [db, setDb] = useState<ErpDatabase | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [composeInvoiceType, setComposeInvoiceType] = useState<InvoiceType | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loadState = useCallback(async () => {
    try {
      setLoadError('');
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error('Failed to load VoltKhata database');
      const data = (await res.json()) as ErpDatabase;
      setDb(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to reach server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const handleCreateInvoice = async (input: CreateInvoiceInput): Promise<Invoice> => {
    const res = await apiPost<{ db: ErpDatabase; invoice: Invoice }>('/api/invoices', input);
    setDb(res.db);
    return res.invoice;
  };

  const handleCreateParty = async (party: {
    name: string;
    phone: string;
    area: string;
    role: PartyRole;
    openingBalance?: number;
  }): Promise<string> => {
    const res = await apiPost<{ db: ErpDatabase; party: { id: string } }>('/api/parties', party);
    setDb(res.db);
    return res.party.id;
  };

  const handleRecordPayment = async (input: RecordPaymentInput): Promise<void> => {
    const res = await apiPost<{ db: ErpDatabase }>('/api/payments', input);
    setDb(res.db);
  };

  const handleTransferFunds = async (input: TransferFundsInput): Promise<void> => {
    const res = await apiPost<{ db: ErpDatabase }>('/api/transfers', input);
    setDb(res.db);
  };

  const handleAddProduct = async (product: Omit<Product, 'id'>): Promise<void> => {
    const res = await apiPost<{ db: ErpDatabase }>('/api/products', {
      mode: 'CREATE',
      product,
    });
    setDb(res.db);
  };

  const handleAdjustStock = async (payload: {
    productId: string;
    deltaQty: number;
    date: string;
    note: string;
  }): Promise<void> => {
    const res = await apiPost<{ db: ErpDatabase }>('/api/products', {
      mode: 'ADJUST',
      ...payload,
    });
    setDb(res.db);
  };

  const handleCreateScrap = async (input: CreateScrapInput): Promise<void> => {
    const res = await apiPost<{ db: ErpDatabase }>('/api/scrap', input);
    setDb(res.db);
  };

  const handleResetDemo = async () => {
    setIsResetting(true);
    try {
      const res = await apiPost<{ db: ErpDatabase }>('/api/reset');
      setDb(res.db);
    } finally {
      setIsResetting(false);
    }
  };

  const handleStartInvoice = (type: InvoiceType) => {
    setComposeInvoiceType(type);
    setActiveSection('invoices');
  };

  const handleInspectParty = (partyId: string) => {
    setSelectedPartyId(partyId);
    setActiveSection('parties');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm">
        Loading VoltKhata Desktop Workspace...
      </div>
    );
  }

  if (loadError || !db) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center space-y-3">
        <div className="text-sm font-semibold text-rose-700">{loadError || 'Database error'}</div>
        <button
          type="button"
          onClick={loadState}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={(sec) => {
          setComposeInvoiceType(null);
          setActiveSection(sec);
        }}
        db={db}
        onResetDemo={handleResetDemo}
        isResetting={isResetting}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeSection={activeSection}
          onOpenNewInvoice={() => handleStartInvoice('SALE_OUT')}
          onOpenScrapEntry={() => setActiveSection('scrap')}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 p-4 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeSection === 'overview' && (
            <DashboardView
              db={db}
              onNavigate={setActiveSection}
              onInspectParty={handleInspectParty}
              onStartInvoice={handleStartInvoice}
            />
          )}

          {activeSection === 'invoices' && (
            <InvoicesView
              db={db}
              onCreateInvoice={handleCreateInvoice}
              onCreateParty={handleCreateParty}
              initialComposeType={composeInvoiceType}
              onClearComposeTrigger={() => setComposeInvoiceType(null)}
            />
          )}

          {activeSection === 'inventory' && (
            <InventoryView
              db={db}
              onAddProduct={handleAddProduct}
              onAdjustStock={handleAdjustStock}
            />
          )}

          {activeSection === 'parties' && (
            <PartiesView
              db={db}
              selectedPartyId={selectedPartyId}
              onSelectParty={setSelectedPartyId}
              onCreateParty={handleCreateParty}
              onRecordPayment={handleRecordPayment}
            />
          )}

          {activeSection === 'accounts' && (
            <AccountsView db={db} onTransferFunds={handleTransferFunds} />
          )}

          {activeSection === 'scrap' && (
            <ScrapView db={db} onCreateScrap={handleCreateScrap} />
          )}

          {activeSection === 'dayend' && (
            <DayEndView db={db} onInspectParty={handleInspectParty} />
          )}
        </main>
      </div>
    </div>
  );
}
