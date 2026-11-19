import { create } from 'zustand';
import { getSupabaseClient } from './supabase';
import { db } from './db';
import { useProductStore } from '../store/useProductStore';
import { useSalesStore, mapRemoteInvoiceToLocal } from '../store/useSalesStore';
import { useCustomerStore, mapRemoteCustomerToLocal, toSupabaseCustomerPayload } from '../store/useCustomerStore';
import { usePurchaseStore } from '../store/usePurchaseStore';
import type { Product, Customer, Invoice, UnitType, GstRate, TaxType, StockMovement, PurchaseInvoice } from '../types';

export type RealtimeStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

interface RealtimeStoreState {
  status: RealtimeStatus;
  isOnline: boolean;
  connectedDevices: number;
  lastSyncTime: string | null;
  latencyMs: number | null;
  errorMessage: string | null;
  pendingOfflineCount: number;

  // Actions
  setStatus: (status: RealtimeStatus) => void;
  setConnectedDevices: (count: number) => void;
  setLastSyncTime: (time: string) => void;
  setLatency: (ms: number) => void;
  setError: (msg: string | null) => void;
  setPendingOfflineCount: (count: number) => void;
}

export const useRealtimeStore = create<RealtimeStoreState>((set) => ({
  status: 'disconnected',
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  connectedDevices: 1,
  lastSyncTime: null,
  latencyMs: null,
  errorMessage: null,
  pendingOfflineCount: 0,

  setStatus: (status) => set({ status, isOnline: status === 'connected' }),
  setConnectedDevices: (connectedDevices) => set({ connectedDevices: Math.max(1, connectedDevices) }),
  setLastSyncTime: (lastSyncTime) => set({ lastSyncTime }),
  setLatency: (latencyMs) => set({ latencyMs }),
  setError: (errorMessage) => set({ errorMessage }),
  setPendingOfflineCount: (pendingOfflineCount) => set({ pendingOfflineCount })
}));

let activeChannel: any = null;
let isInitializing = false;
let heartbeatInterval: any = null;
let isFlushingBuffer = false;

/**
 * Maps a Supabase products row to local Product format
 */
export function mapSupabaseRowToProduct(row: any): Product {
  return {
    id: String(row.id),
    sku: String(row.sku || ''),
    barcode: String(row.barcode || ''),
    name: String(row.name || 'Untitled Item'),
    category: String(row.category || 'General'),
    categoryId: row.category_id ? String(row.category_id) : undefined,
    packInfo: String(row.pack_info || '1*1'),
    unit: (row.unit || 'Pcs') as UnitType,
    mrp: Number(row.mrp || 0),
    purchaseRate: Number(row.purchase_rate ?? row.purchase_price ?? 0),
    saleRate: Number(row.sale_rate ?? row.selling_rate ?? row.selling_price ?? row.mrp ?? 0),
    hsnCode: String(row.hsn_code || '6205'),
    gstRate: (Number(row.gst_rate) || 12) as GstRate,
    taxType: (row.tax_type || 'inclusive') as TaxType,
    stockQty: Number(row.stock_qty ?? row.stock_quantity ?? 0),
    minStockLevel: Number(row.min_stock_level ?? row.low_stock_threshold ?? 5),
    isActive: row.is_active !== false,
    synced: true,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  };
}

/**
 * Flushes any pending offline transactions buffered in Dexie up to Supabase.
 * Triggered automatically upon WebSocket connect/reconnect.
 */
export async function flushOfflineBuffer() {
  if (isFlushingBuffer) return;
  const client = getSupabaseClient();
  if (!client) return;

  isFlushingBuffer = true;
  try {
    // 1. Check unsynced invoices
    const unsyncedInvoices = await db.invoices.filter((i) => !i.synced).toArray().catch(() => []);
    useRealtimeStore.getState().setPendingOfflineCount(unsyncedInvoices.length);

    for (const inv of unsyncedInvoices) {
      try {
        const cleanNotes = (inv.notes || '').replace(/\[\[meta:[^\]]+\]\]/g, '').trim();
        const metaParts = [`pm=${inv.paymentMode}`, `type=${inv.invoiceType}`, `status=${inv.status}`];
        if (inv.originalInvoiceNumber) metaParts.push(`origNum=${inv.originalInvoiceNumber}`);
        if (inv.originalInvoiceDate) metaParts.push(`origDate=${inv.originalInvoiceDate}`);
        if (inv.returnReason) metaParts.push(`retReason=${encodeURIComponent(inv.returnReason)}`);
        const taggedNotes = `[[meta:${metaParts.join('|')}]] ${cleanNotes}`.trim();

        const invoiceRow = {
          id: inv.id,
          invoice_number: inv.invoiceNumber,
          invoice_date: inv.date,
          invoice_time: inv.time,
          customer_name: inv.customerName || 'Cash Customer',
          customer_mobile: inv.customerMobile || null,
          customer_gstin: inv.customerGstin || null,
          customer_address: inv.customerAddress || null,
          subtotal: inv.subtotal,
          total_discount: inv.totalDiscount,
          total_gst: inv.totalGst,
          cgst_total: inv.cgstTotal,
          sgst_total: inv.sgstTotal,
          igst_total: inv.igstTotal,
          freight_amount: inv.freightAmount,
          round_off: inv.roundOff,
          net_payable: inv.netPayable,
          paid_amount: inv.paidAmount,
          balance_amount: inv.balanceAmount,
          is_interstate: inv.isInterstate || false,
          idempotency_key: inv.idempotencyKey || null,
          transaction_ref: inv.transactionRef || inv.upiReference || null,
          notes: taggedNotes,
          created_at: inv.createdAt
        };

        const itemRows = (inv.items || []).map((it, idx) => ({
          id: `item_${inv.id}_${idx}_${it.productId}`,
          invoice_id: inv.id,
          product_id: it.productId,
          product_name: it.productName,
          sku: it.sku || '',
          barcode: it.barcode || null,
          pack_info: it.pack || null,
          remark: it.remark || null,
          unit: it.unit || 'Pcs',
          qty: it.qty,
          free_qty: it.freeQty || 0,
          unit_rate: it.unitRate,
          mrp: it.mrp || 0,
          scheme_discount_pct: it.schemeDiscountPct || 0,
          addl_discount_pct: it.addlDiscountPct || 0,
          discount_pct: it.discountPct || 0,
          discount_amount: it.discountAmount || 0,
          hsn_code: it.hsnCode || null,
          gst_rate: it.gstRate || 12,
          gst_amount: ((it.cgstAmount || 0) + (it.sgstAmount || 0) + (it.igstAmount || 0)) || 0,
          total_amount: it.totalAmount,
          created_at: inv.createdAt
        }));

        const { error: invErr } = await client.from('invoices').upsert(invoiceRow, { onConflict: 'id' });
        if (!invErr) {
          if (itemRows.length > 0) {
            let { error: itemErr } = await client.from('invoice_items').upsert(itemRows, { onConflict: 'id' });
            if (itemErr && (itemErr.message?.includes('remark') || itemErr.code === 'PGRST204')) {
              const fallbackRows = itemRows.map(({ remark, ...rest }: any) => rest);
              await client.from('invoice_items').upsert(fallbackRows, { onConflict: 'id' });
            }
          }
          await db.invoices.update(inv.id, { synced: true });
        }
      } catch (err) {
        console.warn('[flushOfflineBuffer] Invoice flush notice:', err);
      }
    }

    // 2. Check unsynced products
    const unsyncedProducts = await db.products.filter((p) => p.synced === false).toArray().catch(() => []);
    for (const prod of unsyncedProducts) {
      try {
        await client.from('products').upsert({
          id: prod.id,
          sku: prod.sku,
          barcode: prod.barcode || null,
          name: prod.name,
          category: prod.category || 'General Supplies',
          unit: prod.unit || 'Pcs',
          mrp: Number(prod.mrp) || 0,
          purchase_rate: Number(prod.purchaseRate) || 0,
          sale_rate: Number(prod.saleRate) || 0,
          hsn_code: prod.hsnCode || '4820',
          gst_rate: Number(prod.gstRate) || 12,
          stock_qty: Number(prod.stockQty) || 0,
          stock_quantity: Number(prod.stockQty) || 0,
          min_stock_level: Number(prod.minStockLevel) || 5,
          is_active: prod.isActive !== false,
          updated_at: prod.updatedAt
        }, { onConflict: 'id' });
        await db.products.update(prod.id, { synced: true });
      } catch (prodErr) {
        console.warn('[flushOfflineBuffer] Product flush notice:', prodErr);
      }
    }

    const remainingUnsynced = await db.invoices.filter((i) => !i.synced).count().catch(() => 0);
    useRealtimeStore.getState().setPendingOfflineCount(remainingUnsynced);
  } finally {
    isFlushingBuffer = false;
  }
}

/**
 * Measures real-time round-trip latency to Supabase
 */
export async function measureRealtimeLatency() {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const start = performance.now();
    await client.from('store_settings').select('id').limit(1).maybeSingle();
    const elapsed = Math.round(performance.now() - start);
    if (elapsed > 0 && elapsed < 2000) {
      useRealtimeStore.getState().setLatency(elapsed);
    }
  } catch (_) {
    // Silent suppression
  }
}

/**
 * Initializes the unified multi-device Supabase Realtime WebSocket subscription.
 * Runs on app start and reconnects automatically.
 */
export function initializeRealtimeLiveSync() {
  if (typeof window === 'undefined') return;
  if (isInitializing) return;

  const client = getSupabaseClient();
  if (!client) {
    useRealtimeStore.getState().setStatus('disconnected');
    return;
  }

  isInitializing = true;
  useRealtimeStore.getState().setStatus('connecting');

  // Tear down existing channel if any
  if (activeChannel) {
    try {
      client.removeChannel(activeChannel);
    } catch (_) {}
    activeChannel = null;
  }

  try {
    const channelName = 'store-realtime-channel';
    const channel = client.channel(channelName, {
      config: {
        presence: { key: `device-${Math.random().toString(36).substring(2, 7)}` }
      }
    });

    // 1. PRODUCTS LIVE SYNC (Stock deductions, price updates, new products)
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      async (payload: any) => {
        try {
          const startTime = performance.now();
          if (payload.eventType === 'DELETE') {
            const oldId = String(payload.old?.id);
            if (oldId) {
              await useProductStore.getState().removeProductFromCloud(oldId);
            }
          } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new;
            if (row && row.id) {
              const mapped = mapSupabaseRowToProduct(row);
              await useProductStore.getState().upsertProductFromCloud(mapped);
            }
          }

          const latency = Math.round(performance.now() - startTime);
          if (latency > 0) useRealtimeStore.getState().setLatency(latency);
          useRealtimeStore.getState().setLastSyncTime(new Date().toLocaleTimeString('en-IN'));
        } catch (err) {
          console.error('[Realtime Products Error]:', err);
        }
      }
    );

    // 2. INVOICES LIVE SYNC (New bills completed on other counters appear live)
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'invoices' },
      async (payload: any) => {
        try {
          if (payload.eventType === 'DELETE') {
            const oldId = payload.old?.id;
            if (oldId) {
              await useSalesStore.getState().removeInvoiceFromCloud(oldId);
            }
          } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new;
            if (row && row.id) {
              // Fetch complete invoice including items from Supabase
              const { data: fullInvoice } = await client
                .from('invoices')
                .select('*, invoice_items(*)')
                .eq('id', row.id)
                .maybeSingle();

              if (fullInvoice) {
                const mapped = mapRemoteInvoiceToLocal(fullInvoice);
                await useSalesStore.getState().addInvoiceFromCloud(mapped);
                useRealtimeStore.getState().setLastSyncTime(new Date().toLocaleTimeString('en-IN'));
              }
            }
          }
        } catch (err) {
          console.error('[Realtime Invoices Error]:', err);
        }
      }
    );

    // 3. CUSTOMERS LIVE SYNC (Khata balance payments reflected across devices)
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'customers' },
      async (payload: any) => {
        try {
          if (payload.eventType === 'DELETE') {
            const oldId = String(payload.old?.id);
            if (oldId) {
              await useCustomerStore.getState().removeCustomerFromCloud(oldId);
            }
          } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new;
            if (row && row.id) {
              const customer = mapRemoteCustomerToLocal(row);
              await useCustomerStore.getState().upsertCustomerFromCloud(customer);
            }
          }
          useRealtimeStore.getState().setLastSyncTime(new Date().toLocaleTimeString('en-IN'));
        } catch (err) {
          console.error('[Realtime Customers Error]:', err);
        }
      }
    );

    // 4. STOCK MOVEMENTS LIVE AUDIT
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'stock_movements' },
      async (payload: any) => {
        try {
          const row = payload.new;
          if (row && row.id) {
            const movement: StockMovement = {
              id: String(row.id),
              productId: String(row.product_id),
              productName: String(row.product_name || ''),
              type: (row.type || 'sale') as any,
              quantityChange: Number(row.quantity_change || 0),
              previousStock: Number(row.previous_stock || 0),
              newStock: Number(row.new_stock || 0),
              reason: row.reason || '',
              referenceId: row.reference_id || undefined,
              createdAt: row.created_at || new Date().toISOString()
            };
            await db.stockMovements.put(movement).catch(() => {});
          }
        } catch (err) {
          console.error('[Realtime Stock Movement Error]:', err);
        }
      }
    );

    // 5. PURCHASE INVOICES LIVE SYNC (Instant inwarding updates across counters)
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'purchase_invoices' },
      async (payload: any) => {
        try {
          if (payload.eventType === 'DELETE') {
            if (payload.old?.id) {
              await db.purchaseInvoices.delete(payload.old.id).catch(() => {});
              usePurchaseStore.setState((s) => ({
                purchaseInvoices: s.purchaseInvoices.filter((p) => p.id !== payload.old.id)
              }));
            }
          } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new;
            if (row && row.id) {
              const purchase: PurchaseInvoice = {
                id: String(row.id),
                supplierName: row.supplier_name || '',
                supplierGstin: row.supplier_gstin || undefined,
                invoiceNumber: row.invoice_number || '',
                invoiceDate: row.invoice_date || '',
                totalItems: Number(row.total_items || 0),
                subtotal: Number(row.subtotal || 0),
                totalGst: Number(row.total_gst || 0),
                grandTotal: Number(row.grand_total || 0),
                billImageUrl: row.bill_image_url || undefined,
                status: (row.status || 'completed') as any,
                items: [],
                createdAt: row.created_at || new Date().toISOString(),
                synced: true
              };
              await usePurchaseStore.getState().addPurchaseFromCloud(purchase);
            }
          }
          useRealtimeStore.getState().setLastSyncTime(new Date().toLocaleTimeString('en-IN'));
        } catch (err) {
          console.error('[Realtime Purchase Invoices Error]:', err);
        }
      }
    );

    // 6. MULTI-DEVICE PRESENCE (Tracks number of active counter devices)
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const count = Object.keys(state).length;
      useRealtimeStore.getState().setConnectedDevices(count);
    });

    // 7. SUBSCRIBE & CHANNEL STATUS
    channel.subscribe(async (status: string) => {
      isInitializing = false;
      if (status === 'SUBSCRIBED') {
        useRealtimeStore.getState().setStatus('connected');
        useRealtimeStore.getState().setError(null);
        useRealtimeStore.getState().setLastSyncTime(new Date().toLocaleTimeString('en-IN'));

        // Track self in presence
        await channel.track({
          onlineAt: new Date().toISOString(),
          deviceType: typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'counter_pc'
        });

        // Flush any pending offline transactions buffered locally
        flushOfflineBuffer().catch(() => {});

        // Measure initial latency
        measureRealtimeLatency().catch(() => {});
      } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
        useRealtimeStore.getState().setStatus('reconnecting');
      } else if (status === 'CHANNEL_ERROR') {
        useRealtimeStore.getState().setStatus('error');
        useRealtimeStore.getState().setError('Realtime channel error');
      }
    });

    activeChannel = channel;

    // Periodic heartbeat for latency & presence
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (useRealtimeStore.getState().status === 'connected') {
        measureRealtimeLatency().catch(() => {});
      }
    }, 20000);

    // Listen to browser online/offline events
    window.addEventListener('online', () => {
      initializeRealtimeLiveSync();
      flushOfflineBuffer().catch(() => {});
    });
    window.addEventListener('offline', () => {
      useRealtimeStore.getState().setStatus('disconnected');
    });

  } catch (err: any) {
    isInitializing = false;
    useRealtimeStore.getState().setStatus('error');
    useRealtimeStore.getState().setError(err?.message || 'Failed to connect to Supabase Realtime');
  }
}
