import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createSeedDatabase } from './src/data/seedData';
import type {
  CreateInvoiceInput,
  CreateScrapInput,
  ErpDatabase,
  Party,
  Product,
  RecordPaymentInput,
  TransferFundsInput,
} from './src/types/erp';
import {
  applyAccountTransfer,
  applyInvoice,
  applyPartyPayment,
  applyProductCreateOrAdjust,
  applyScrapPurchase,
} from './src/utils/erpLogic';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'volt_khata_db.json');

function ensureDb(): ErpDatabase {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const seed = createSeedDatabase();
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw) as ErpDatabase;
  } catch {
    const seed = createSeedDatabase();
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
}

function saveDb(db: ErpDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpPath, DB_PATH);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/state', (_req, res) => {
    const db = ensureDb();
    res.json(db);
  });

  app.post('/api/invoices', (req, res) => {
    try {
      const db = ensureDb();
      const input = req.body as CreateInvoiceInput;
      const { db: nextDb, invoice } = applyInvoice(db, input);
      saveDb(nextDb);
      res.status(201).json({ db: nextDb, invoice });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save invoice.' });
    }
  });

  app.post('/api/parties', (req, res) => {
    try {
      const db = ensureDb();
      const body = req.body as Omit<Party, 'id' | 'createdAt' | 'balance'> & {
        openingBalance?: number;
      };
      if (!body.name || !body.name.trim()) {
        res.status(400).json({ error: 'Party name is required.' });
        return;
      }
      const newParty: Party = {
        id: `party-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: body.name.trim(),
        phone: (body.phone || '').trim(),
        area: (body.area || '').trim(),
        role: body.role || 'CUSTOMER',
        balance: Math.round(Number(body.openingBalance || 0)),
        notes: body.notes?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      const nextDb: ErpDatabase = {
        ...db,
        parties: [newParty, ...db.parties],
      };
      saveDb(nextDb);
      res.status(201).json({ db: nextDb, party: newParty });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create party.' });
    }
  });

  app.post('/api/payments', (req, res) => {
    try {
      const db = ensureDb();
      const input = req.body as RecordPaymentInput;
      const nextDb = applyPartyPayment(db, input);
      saveDb(nextDb);
      res.status(201).json({ db: nextDb });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to record payment.' });
    }
  });

  app.post('/api/transfers', (req, res) => {
    try {
      const db = ensureDb();
      const input = req.body as TransferFundsInput;
      const nextDb = applyAccountTransfer(db, input);
      saveDb(nextDb);
      res.status(201).json({ db: nextDb });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to transfer funds.' });
    }
  });

  app.post('/api/products', (req, res) => {
    try {
      const db = ensureDb();
      const body = req.body as
        | { mode: 'CREATE'; product: Omit<Product, 'id'> }
        | { mode: 'ADJUST'; productId: string; deltaQty: number; date: string; note: string };
      const nextDb = applyProductCreateOrAdjust(db, body);
      saveDb(nextDb);
      res.status(201).json({ db: nextDb });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update inventory.' });
    }
  });

  app.post('/api/scrap', (req, res) => {
    try {
      const db = ensureDb();
      const input = req.body as CreateScrapInput;
      const { db: nextDb, scrap } = applyScrapPurchase(db, input);
      saveDb(nextDb);
      res.status(201).json({ db: nextDb, scrap });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to log scrap purchase.' });
    }
  });

  app.post('/api/reset', (_req, res) => {
    const seed = createSeedDatabase();
    saveDb(seed);
    res.json({ db: seed });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VoltKhata Desktop ERP running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
