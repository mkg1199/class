import { create } from 'zustand';
import type { Product, StockMovement, UnitType, GstRate, TaxType } from '../types';
import { db } from '../lib/db';
import { getSupabaseClient } from '../lib/supabase';
import type { ValidatedImportRow, ImportMode, ImportSummaryResult } from '../lib/importProcessor';

interface ProductState {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  selectedCategory: string;
  statusFilter: 'all' | 'active' | 'inactive';

  // Actions
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  setStatusFilter: (status: 'all' | 'active' | 'inactive') => void;
  loadProducts: (force?: boolean) => Promise<void>;
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Product>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  toggleProductActiveStatus: (id: string) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  adjustStock: (productId: string, quantityChange: number, reason: string) => Promise<void>;
  updateProductStockInMemory: (productId: string, newStock: number) => void;
  upsertProductFromCloud: (product: Product) => Promise<void>;
  removeProductFromCloud: (id: string) => Promise<void>;
  seedDefaultProducts: () => Promise<number>;
  commitBatchImport: (rowsToCommit: ValidatedImportRow[], mode: ImportMode) => Promise<ImportSummaryResult>;
  syncWithSupabase: (forceAll?: boolean) => Promise<{ success: boolean; message: string }>;
}

const LEGACY_DEMO_SKUS = new Set([
  'CLM-NB-172', 'CLM-NB-A4-200', 'REY-TRM-BLU', 'REY-TRM-BLK',
  'HAU-XO-5PKT', 'PEN-ENG-07', 'JK-A4-75GSM', 'B2B-A4-80GSM',
  'FEV-MR-100G', 'FEV-STK-15G', 'FBC-WCP-24', 'CAM-ACR-12',
  'SOL-COB-A4', 'SOL-DSP-20', 'CAS-MJ12D', 'CAM-MDB-BOX',
  'NAT-621-10PKT', 'APS-PLT-10PKT', 'PST-STK-3X3', 'KNG-STP-10D',
  'KNG-PIN-10BOX', 'WND-CEL-1IN', 'FBC-HLT-4SET', 'LUX-MRK-BLK',
  'CAM-WBM-BLU'
]);

export const isDemoStationeryProduct = (p: Partial<Product>) => {
  if (p.id && p.id.startsWith('prod_seed_')) return true;
  const s = (p.sku || '').toUpperCase().trim();
  if (LEGACY_DEMO_SKUS.has(s)) return true;
  if (
    s.startsWith('CLM-NB-') ||
    s.startsWith('REY-TRM-') ||
    s.startsWith('HAU-XO-') ||
    s.startsWith('FEV-MR-') ||
    s.startsWith('FEV-STK-') ||
    s.startsWith('MIG-NEO-') ||
    s.startsWith('SOL-COB-') ||
    s.startsWith('SOL-DSP-') ||
    s.startsWith('JK-A4-') ||
    s.startsWith('B2B-A4-') ||
    s.startsWith('CAM-ACR-') ||
    s.startsWith('CAM-MDB-') ||
    s.startsWith('CAM-WBM-') ||
    s.startsWith('FBC-WCP-') ||
    s.startsWith('FBC-HLT-') ||
    s.startsWith('KNG-STP-') ||
    s.startsWith('KNG-PIN-') ||
    s.startsWith('WND-CEL-') ||
    s.startsWith('LUX-MRK-') ||
    s.startsWith('CAS-MJ12D') ||
    s.startsWith('NAT-621-') ||
    s.startsWith('APS-PLT-')
  ) {
    return true;
  }
  const n = (p.name || '').toLowerCase().trim();
  return (
    n.includes('highlighter') ||
    n.includes('classmate') ||
    n.includes('reynolds') ||
    n.includes('hauser') ||
    n.includes('pentel') ||
    n.includes('copier a4') ||
    n.includes('fevicol') ||
    n.includes('fevistick') ||
    n.includes('faber-castell') ||
    n.includes('kokuyo') ||
    n.includes('solo cobra') ||
    n.includes('solo display') ||
    n.includes('casio mj') ||
    n.includes('mathematical drawing') ||
    n.includes('nataraj') ||
    n.includes('apsara') ||
    n.includes('post-it') ||
    n.includes('kangaro') ||
    n.includes('cello tape') ||
    n.includes('textliner') ||
    n.includes('marker') ||
    n.includes('eraser')
  );
};

export const MART_CATEGORIES = [
  'All Categories',
  'Grocery & Staples',
  'Packaged Foods & Snacks',
  'Dairy & Bakery',
  'Beverages, Tea & Coffee',
  'Personal Care & Hygiene',
  'Household & Cleaning',
  'Spices, Oils & Masalas',
  'Dry Fruits & Nuts',
  'Biscuits & Confectionery',
  'Baby Care',
  'Pooja Needs & Incense',
  'General Merchandise',
  'Uncategorized'
];

export const CLOTHING_CATEGORIES = MART_CATEGORIES;
export const STATIONERY_CATEGORIES = MART_CATEGORIES;

export const INITIAL_STATIONERY_PRODUCTS: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[] = [];

let productRealtimeSubscribed = false;

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  isLoading: false,
  error: null,
  searchQuery: '',
  selectedCategory: 'All Categories',
  statusFilter: 'all',

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),

  updateProductStockInMemory: (productId: string, newStock: number) => {
    set((state) => ({
      products: state.products.map((p) =>
        p.id === productId ? { ...p, stockQty: newStock, updatedAt: new Date().toISOString() } : p
      )
    }));
  },

  loadProducts: async (force = false) => {
    // 1. Instant 0ms Load from Local Dexie Cache (filter out any legacy demo stationery items)
    let localProducts: Product[] = await db.products.toArray().catch(() => [] as Product[]);
    const demoItems = localProducts.filter(isDemoStationeryProduct);
    if (demoItems.length > 0) {
      await db.products.bulkDelete(demoItems.map(d => d.id)).catch(() => {});
      localProducts = localProducts.filter(p => !isDemoStationeryProduct(p));
    }

    // Auto-Heal: Recover legitimate products inwarded from purchase bills if affected by legacy demo filters
    try {
      const purchaseInvoices = await db.purchaseInvoices.toArray().catch(() => []);
      const movements = await db.stockMovements.where('type').equals('purchase').toArray().catch(() => []);
      if (purchaseInvoices.length > 0 || movements.length > 0) {
        const prodIdSet = new Set(localProducts.map(p => p.id));
        const prodNameSet = new Set(localProducts.map(p => p.name.trim().toLowerCase()));
        let healedAny = false;

        for (const pi of purchaseInvoices) {
          if (Array.isArray(pi.items)) {
            for (const item of pi.items) {
              const nameKey = (item.matchedProductName || item.rawName || '').trim().toLowerCase();
              if (nameKey && (!item.productId || !prodIdSet.has(item.productId)) && !prodNameSet.has(nameKey)) {
                const totalQty = Number(item.qty || 0) + Number(item.freeQty || 0);
                const restoredProd: Product = {
                  id: item.productId || `prod_heal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  sku: `${nameKey.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`,
                  barcode: '',
                  name: item.matchedProductName || item.rawName,
                  category: 'General Supplies',
                  packInfo: '1 Pcs',
                  unit: item.unit || 'Pcs',
                  mrp: item.mrp || (item.purchaseRate ? Math.round(item.purchaseRate * 1.35) : 50),
                  purchaseRate: item.purchaseRate || 0,
                  saleRate: item.saleRate || (item.purchaseRate ? Math.round(item.purchaseRate * 1.25) : 45),
                  hsnCode: item.hsnCode || '4820',
                  gstRate: (item.gstRate as any) || 12,
                  taxType: 'inclusive',
                  stockQty: totalQty,
                  minStockLevel: 10,
                  isActive: true,
                  createdAt: pi.createdAt || new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  synced: false
                };
                await db.products.put(restoredProd);
                localProducts.push(restoredProd);
                prodIdSet.add(restoredProd.id);
                prodNameSet.add(nameKey);
                healedAny = true;
              }
            }
          }
        }

        for (const sm of movements) {
          const nameKey = (sm.productName || '').trim().toLowerCase();
          if (nameKey && !prodIdSet.has(sm.productId) && !prodNameSet.has(nameKey)) {
            const restoredProd: Product = {
              id: sm.productId,
              sku: `PRD-${Date.now().toString().slice(-4)}`,
              barcode: '',
              name: sm.productName,
              category: 'General Supplies',
              packInfo: '1 Pcs',
              unit: 'Pcs',
              mrp: 50,
              purchaseRate: 35,
              saleRate: 45,
              hsnCode: '4820',
              gstRate: 12,
              taxType: 'inclusive',
              stockQty: sm.newStock || sm.quantityChange || 0,
              minStockLevel: 10,
              isActive: true,
              createdAt: sm.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              synced: false
            };
            await db.products.put(restoredProd);
            localProducts.push(restoredProd);
            prodIdSet.add(restoredProd.id);
            prodNameSet.add(nameKey);
            healedAny = true;
          }
        }

        if (healedAny) {
          localProducts = await db.products.toArray().catch(() => []);
        }
      }
    } catch (_) {}
    if (localProducts.length > 0) {
      set({ products: localProducts, isLoading: false, error: null });
    } else {
      set({ products: [], isLoading: true, error: null });
    }

    // 2. Direct Supabase Cloud Fetch (100% Online Cloud Single Source of Truth)
    try {
      const client = getSupabaseClient();
      if (client) {
        let allData: any[] = [];
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await client
            .from('products')
            .select('*')
            .order('name')
            .range(from, from + pageSize - 1);

          if (error || !data || data.length === 0) {
            hasMore = false;
          } else {
            allData = allData.concat(data);
            if (data.length < pageSize) {
              hasMore = false;
            } else {
              from += pageSize;
            }
          }
        }

        if (allData.length > 0) {
          const mappedProducts: Product[] = allData.map((item: any) => ({
            id: item.id || item.sku,
            sku: item.sku || '',
            barcode: item.barcode || '',
            name: item.name || item.product_name || '',
            category: item.category || 'General Supplies',
            packInfo: item.pack_info || item.pack || '1*1',
            unit: (item.unit as UnitType) || 'Pcs',
            mrp: Number(item.mrp ?? item.sale_rate ?? 0),
            purchaseRate: Number(item.purchase_rate ?? item.purchase_price ?? 0),
            saleRate: Number(item.sale_rate ?? item.selling_rate ?? 0),
            hsnCode: item.hsn_code || '4820',
            gstRate: (Number(item.gst_rate ?? 12) as GstRate),
            taxType: (item.tax_type as TaxType) || 'inclusive',
            stockQty: Number(item.stock_qty ?? item.stock_quantity ?? 0),
            minStockLevel: Number(item.min_stock_level ?? item.low_stock_threshold ?? 5),
            isActive: item.is_active !== undefined ? Boolean(item.is_active) : true,
            createdAt: item.created_at || new Date().toISOString(),
            updatedAt: item.updated_at || new Date().toISOString(),
            synced: true
          }));

          // Mirror to local Dexie for test isolation and offline fallback
          await db.products.clear().catch(() => {});
          await db.products.bulkPut(mappedProducts).catch(() => {});

          set({ products: mappedProducts.filter((p) => !isDemoStationeryProduct(p)), isLoading: false });
          return;
        } else {
          // Cloud catalog is empty (clean slate) - Purge legacy demo stationery products
          const staleLocal = localProducts.filter((p: Product) => isDemoStationeryProduct(p));
          if (staleLocal.length > 0) {
            await db.products.bulkDelete(staleLocal.map((p: Product) => p.id)).catch(() => {});
          }
          const remaining = await db.products.toArray().catch(() => []);
          const realRemaining = remaining.filter((p: Product) => !isDemoStationeryProduct(p));
          set({ products: realRemaining, isLoading: false });

          // Auto-heal: If local device has real products but cloud catalog is empty (e.g. freshly created DB), push ALL real products to Supabase
          const toPush = realRemaining;
          if (toPush.length > 0) {
            try {
              const payloads = toPush.map((p) => ({
                id: p.id,
                sku: p.sku,
                barcode: p.barcode || null,
                name: p.name,
                category: p.category || 'General Merchandise',
                pack_info: p.packInfo || '1*1',
                unit: p.unit || 'Pcs',
                mrp: Number(p.mrp) || 0,
                purchase_rate: Number(p.purchaseRate) || 0,
                purchase_price: Number(p.purchaseRate) || 0,
                sale_rate: Number(p.saleRate) || 0,
                selling_rate: Number(p.saleRate) || 0,
                hsn_code: p.hsnCode || '6205',
                gst_rate: Number(p.gstRate) || 12,
                tax_type: p.taxType || 'inclusive',
                stock_qty: Number(p.stockQty) || 0,
                stock_quantity: Number(p.stockQty) || 0,
                min_stock_level: Number(p.minStockLevel) || 5,
                low_stock_threshold: Number(p.minStockLevel) || 5,
                is_active: p.isActive !== false,
                created_at: p.createdAt || new Date().toISOString(),
                updated_at: p.updatedAt || new Date().toISOString()
              }));
              const { error: pushErr } = await client.from('products').upsert(payloads, { onConflict: 'id' });
              if (!pushErr) {
                for (const p of toPush) {
                  await db.products.update(p.id, { synced: true }).catch(() => {});
                }
              }
            } catch (syncErr) {
              console.warn('[loadProducts] Push error:', syncErr);
            }
          }
          return;
        }
      }

      if (localProducts.length === 0) {
        const freshLocal = await db.products.toArray().catch(() => []);
        set({ products: freshLocal, isLoading: false });
      }
    } catch (err: any) {
      if (localProducts.length === 0) {
        const freshLocal = await db.products.toArray().catch(() => []);
        set({ products: freshLocal, isLoading: false });
      }
    }
  },

  addProduct: async (prodData) => {
    const now = new Date().toISOString();
    const cleanBarcode = (prodData.barcode || '').trim().replace(/[\s\r\n\t>]+/g, '');
    const newProduct: Product = {
      ...prodData,
      barcode: cleanBarcode,
      id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: now,
      updatedAt: now,
      synced: false
    };

    // 1. Immediately store in local Dexie IndexedDB
    await db.products.put(newProduct);

    // 2. Immediately update in-memory state so product appears with 0ms lag
    set((state) => ({
      products: [newProduct, ...state.products.filter(p => p.id !== newProduct.id)]
    }));

    // 3. Immediately Push to Supabase Cloud
    const client = getSupabaseClient();
    if (client) {
      try {
        const payload = {
          id: newProduct.id,
          sku: newProduct.sku,
          barcode: newProduct.barcode || null,
          name: newProduct.name,
          category: newProduct.category || 'General Merchandise',
          pack_info: newProduct.packInfo || '1*1',
          unit: newProduct.unit || 'Pcs',
          mrp: Number(newProduct.mrp) || 0,
          purchase_rate: Number(newProduct.purchaseRate) || 0,
          purchase_price: Number(newProduct.purchaseRate) || 0,
          sale_rate: Number(newProduct.saleRate) || 0,
          selling_rate: Number(newProduct.saleRate) || 0,
          hsn_code: newProduct.hsnCode || '6205',
          gst_rate: Number(newProduct.gstRate) || 12,
          tax_type: newProduct.taxType || 'inclusive',
          stock_qty: Number(newProduct.stockQty) || 0,
          stock_quantity: Number(newProduct.stockQty) || 0,
          min_stock_level: Number(newProduct.minStockLevel) || 5,
          low_stock_threshold: Number(newProduct.minStockLevel) || 5,
          is_active: newProduct.isActive !== false,
          created_at: now,
          updated_at: now
        };

        const { error } = await client.from('products').upsert(payload, { onConflict: 'id' });
        if (!error) {
          await db.products.update(newProduct.id, { synced: true }).catch(() => {});
          newProduct.synced = true;
          set((state) => ({
            products: state.products.map(p => p.id === newProduct.id ? { ...p, synced: true } : p)
          }));
        } else {
          console.warn('[addProduct] Supabase insert warning:', error.message);
        }
      } catch (err) {
        console.warn('[addProduct] Supabase connection error:', err);
      }
    }

    return newProduct;
  },

  updateProduct: async (id, updates) => {
    const existing = await db.products.get(id);
    if (!existing) return;

    const cleanBarcode = updates.barcode !== undefined 
      ? (updates.barcode || '').trim().replace(/[\s\r\n\t>]+/g, '')
      : existing.barcode;

    const now = new Date().toISOString();
    const updated: Product = {
      ...existing,
      ...updates,
      barcode: cleanBarcode,
      updatedAt: now,
      synced: false
    };

    await db.products.put(updated);
    set((state) => ({
      products: state.products.map(p => p.id === id ? updated : p)
    }));

    const client = getSupabaseClient();
    if (client) {
      try {
        const payload: Record<string, any> = {
          updated_at: now
        };
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.sku !== undefined) payload.sku = updates.sku;
        if (updates.barcode !== undefined) payload.barcode = cleanBarcode || null;
        if (updates.category !== undefined) payload.category = updates.category;
        if (updates.packInfo !== undefined) payload.pack_info = updates.packInfo;
        if (updates.unit !== undefined) payload.unit = updates.unit;
        if (updates.mrp !== undefined) payload.mrp = Number(updates.mrp);
        if (updates.purchaseRate !== undefined) {
          payload.purchase_rate = Number(updates.purchaseRate);
          payload.purchase_price = Number(updates.purchaseRate);
        }
        if (updates.saleRate !== undefined) {
          payload.sale_rate = Number(updates.saleRate);
          payload.selling_rate = Number(updates.saleRate);
        }
        if (updates.hsnCode !== undefined) payload.hsn_code = updates.hsnCode;
        if (updates.gstRate !== undefined) payload.gst_rate = Number(updates.gstRate);
        if (updates.taxType !== undefined) payload.tax_type = updates.taxType;
        if (updates.stockQty !== undefined) {
          payload.stock_qty = Number(updates.stockQty);
          payload.stock_quantity = Number(updates.stockQty);
        }
        if (updates.minStockLevel !== undefined) {
          payload.min_stock_level = Number(updates.minStockLevel);
          payload.low_stock_threshold = Number(updates.minStockLevel);
        }
        if (updates.isActive !== undefined) payload.is_active = updates.isActive;

        const { error } = await client.from('products').update(payload).eq('id', id);
        if (!error) {
          await db.products.update(id, { synced: true }).catch(() => {});
        }
      } catch (err) {
        console.warn('[updateProduct] Supabase error:', err);
      }
    }
  },

  toggleProductActiveStatus: async (id) => {
    const existing = await db.products.get(id);
    if (!existing) return;

    const newStatus = !existing.isActive;
    const now = new Date().toISOString();
    await db.products.update(id, {
      isActive: newStatus,
      updatedAt: now,
      synced: false
    });
    set((state) => ({
      products: state.products.map(p => p.id === id ? { ...p, isActive: newStatus, updatedAt: now } : p)
    }));

    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('products').update({ is_active: newStatus, updated_at: now }).eq('id', id);
      } catch (_) {}
    }
  },

  deleteProduct: async (id) => {
    await db.products.delete(id);
    set((state) => ({
      products: state.products.filter(p => p.id !== id)
    }));

    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('products').delete().eq('id', id);
      } catch (err) {
        console.warn('[deleteProduct] Supabase error:', err);
      }
    }
  },

  adjustStock: async (productId, quantityChange, reason) => {
    const product = await db.products.get(productId);
    if (!product) return;

    const previousStock = product.stockQty;
    const newStock = Math.max(0, previousStock + quantityChange);
    const now = new Date().toISOString();

    const movement: StockMovement = {
      id: 'sm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      productId,
      productName: product.name,
      type: 'adjustment',
      quantityChange,
      previousStock,
      newStock,
      reason,
      createdAt: now
    };

    await db.transaction('rw', db.products, db.stockMovements, async () => {
      await db.products.update(productId, {
        stockQty: newStock,
        updatedAt: now,
        synced: false
      });
      await db.stockMovements.put(movement);
    });

    set((state) => ({
      products: state.products.map(p => p.id === productId ? { ...p, stockQty: newStock, updatedAt: now } : p)
    }));

    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('products').update({
          stock_qty: newStock,
          stock_quantity: newStock,
          updated_at: now
        }).eq('id', productId);
      } catch (err) {
        console.warn('[adjustStock] Supabase error:', err);
      }
    }

    get().syncWithSupabase().catch(() => {});
  },

  upsertProductFromCloud: async (product: Product) => {
    try {
      await db.products.put(product).catch(() => {});
      set((state) => {
        const existingIdx = state.products.findIndex((p) => p.id === product.id);
        if (existingIdx >= 0) {
          const updated = [...state.products];
          updated[existingIdx] = product;
          return { products: updated };
        }
        return { products: [product, ...state.products] };
      });
    } catch (err) {
      console.warn('[upsertProductFromCloud] error:', err);
    }
  },

  removeProductFromCloud: async (id: string) => {
    try {
      await db.products.delete(id).catch(() => {});
      set((state) => ({
        products: state.products.filter((p) => p.id !== id)
      }));
    } catch (err) {
      console.warn('[removeProductFromCloud] error:', err);
    }
  },

  seedDefaultProducts: async () => {
    const now = new Date().toISOString();
    const productsToInsert: Product[] = INITIAL_STATIONERY_PRODUCTS.map((item, index) => ({
      ...item,
      id: `prod_seed_${index + 100}`,
      createdAt: now,
      updatedAt: now,
      synced: false
    }));

    await db.products.bulkPut(productsToInsert);
    await get().loadProducts(true);
    return productsToInsert.length;
  },

  commitBatchImport: async (rowsToCommit, mode) => {
    const now = new Date().toISOString();
    const existingMap = new Map<string, Product>();
    const currentProducts = await db.products.toArray();
    currentProducts.forEach(p => existingMap.set(p.sku.toLowerCase().trim(), p));

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    const productsToSave: Product[] = [];
    const stockMovements: StockMovement[] = [];

    await db.transaction('rw', db.products, db.stockMovements, async () => {
      for (const row of rowsToCommit) {
        if (row.status === 'error') {
          failedCount++;
          continue;
        }

        const parsed = row.parsedProduct;
        const skuKey = (parsed.sku || '').toLowerCase().trim();
        const existing = existingMap.get(skuKey);

        if (existing) {
          if (mode === 'CREATE_ONLY') {
            skippedCount++;
            continue;
          }

          let updatedProd: Product;
          if (mode === 'UPDATE_PRICES_ONLY') {
            updatedProd = {
              ...existing,
              mrp: parsed.mrp !== undefined ? parsed.mrp : existing.mrp,
              purchaseRate: parsed.purchaseRate !== undefined ? parsed.purchaseRate : existing.purchaseRate,
              saleRate: parsed.saleRate !== undefined ? parsed.saleRate : existing.saleRate,
              gstRate: parsed.gstRate !== undefined ? parsed.gstRate : existing.gstRate,
              updatedAt: now,
              synced: false
            };
          } else {
            updatedProd = {
              ...existing,
              name: parsed.name || existing.name,
              barcode: parsed.barcode !== undefined ? parsed.barcode : existing.barcode,
              category: parsed.category || existing.category,
              packInfo: parsed.packInfo || existing.packInfo,
              unit: parsed.unit || existing.unit,
              mrp: parsed.mrp !== undefined ? parsed.mrp : existing.mrp,
              purchaseRate: parsed.purchaseRate !== undefined ? parsed.purchaseRate : existing.purchaseRate,
              saleRate: parsed.saleRate !== undefined ? parsed.saleRate : existing.saleRate,
              hsnCode: parsed.hsnCode !== undefined ? parsed.hsnCode : existing.hsnCode,
              gstRate: parsed.gstRate !== undefined ? parsed.gstRate : existing.gstRate,
              taxType: parsed.taxType || existing.taxType,
              stockQty: parsed.stockQty !== undefined ? parsed.stockQty : existing.stockQty,
              minStockLevel: parsed.minStockLevel !== undefined ? parsed.minStockLevel : existing.minStockLevel,
              isActive: parsed.isActive !== undefined ? parsed.isActive : existing.isActive,
              updatedAt: now,
              synced: false
            };
          }

          productsToSave.push(updatedProd);
          updatedCount++;
        } else {
          if (mode === 'UPDATE_PRICES_ONLY') {
            skippedCount++;
            continue;
          }

          const newProd: Product = {
            id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            sku: parsed.sku || `SKU-${Date.now()}`,
            barcode: parsed.barcode || '',
            name: parsed.name || 'New Product',
            category: parsed.category || 'General Supplies',
            packInfo: parsed.packInfo || '1 Pcs',
            unit: parsed.unit || 'Pcs',
            mrp: parsed.mrp || 0,
            purchaseRate: parsed.purchaseRate || 0,
            saleRate: parsed.saleRate || 0,
            hsnCode: parsed.hsnCode || '',
            gstRate: parsed.gstRate || 12,
            taxType: parsed.taxType || 'inclusive',
            stockQty: parsed.stockQty || 0,
            minStockLevel: parsed.minStockLevel || 10,
            isActive: parsed.isActive !== undefined ? parsed.isActive : true,
            createdAt: now,
            updatedAt: now,
            synced: false
          };

          productsToSave.push(newProd);
          createdCount++;

          if (newProd.stockQty > 0) {
            stockMovements.push({
              id: 'sm_imp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
              productId: newProd.id,
              productName: newProd.name,
              type: 'purchase',
              quantityChange: newProd.stockQty,
              previousStock: 0,
              newStock: newProd.stockQty,
              reason: 'Bulk Import Initial Stock',
              createdAt: now
            });
          }
        }
      }

      if (productsToSave.length > 0) {
        await db.products.bulkPut(productsToSave);
      }
      if (stockMovements.length > 0) {
        await db.stockMovements.bulkPut(stockMovements);
      }
    });

    await get().loadProducts(true);

    return {
      totalRows: rowsToCommit.length,
      createdCount,
      updatedCount,
      skippedCount,
      failedCount,
      errors: []
    };
  },

  syncWithSupabase: async (forceAll: boolean = false) => {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, message: 'Supabase is not configured. Go to Settings to set URL and Key.' };
    }

    try {
      const allLocal = await db.products.toArray().catch(() => []);
      const realLocal = allLocal.filter(p => !isDemoStationeryProduct(p));
      const unSynced = forceAll ? realLocal : realLocal.filter(p => !p.synced);
      if (unSynced.length === 0) {
        return { success: true, message: 'All products are already in sync with Supabase.' };
      }

      const payload = unSynced.map((p) => ({
        id: p.id,
        sku: p.sku,
        barcode: p.barcode || null,
        name: p.name,
        category: p.category || 'General Supplies',
        category_id: p.categoryId || null,
        pack_info: p.packInfo || '1*1',
        unit: p.unit || 'Pcs',
        mrp: Number(p.mrp || 0),
        purchase_rate: Number(p.purchaseRate || 0),
        purchase_price: Number(p.purchaseRate || 0),
        sale_rate: Number(p.saleRate || 0),
        selling_rate: Number(p.saleRate || 0),
        hsn_code: p.hsnCode || '4820',
        gst_rate: Number(p.gstRate || 12),
        tax_type: p.taxType || 'inclusive',
        stock_qty: Number(p.stockQty || 0),
        stock_quantity: Number(p.stockQty || 0),
        min_stock_level: Number(p.minStockLevel || 5),
        low_stock_threshold: Number(p.minStockLevel || 5),
        is_active: p.isActive !== false,
        created_at: p.createdAt || new Date().toISOString(),
        updated_at: p.updatedAt || new Date().toISOString()
      }));

      const { error } = await client.from('products').upsert(payload, { onConflict: 'id' });

      if (error) {
        return { success: false, message: `Supabase Sync Error: ${error.message}` };
      }

      await db.transaction('rw', db.products, async () => {
        for (const p of unSynced) {
          await db.products.update(p.id, { synced: true });
        }
      });

      await get().loadProducts(true);
      return { success: true, message: `Successfully synced ${unSynced.length} products to Supabase!` };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Sync failed.' };
    }
  }
}));
