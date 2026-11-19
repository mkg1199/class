import { db } from './db';
import { getSupabaseClient } from './supabase';
import { useProductStore } from '../store/useProductStore';
import type { StockMovement } from '../types';

export interface AuditResult {
  totalAudited: number;
  mismatchesFound: number;
  fixedItems: Array<{
    productId: string;
    productName: string;
    oldStock: number;
    auditedStock: number;
  }>;
}

/**
 * Universal Stock Reconciliation Engine:
 * Single Source of Truth: Audited Stock = SUM(All Movements for product)
 * Reconciles In-Memory Zustand, Dexie IndexedDB, and Supabase PostgreSQL.
 */
export async function auditAndReconcileAllStock(): Promise<AuditResult> {
  const products = await db.products.toArray().catch(() => []);
  const localMovements = await db.stockMovements.toArray().catch(() => [] as StockMovement[]);
  const client = getSupabaseClient();

  // If cloud connected, also fetch remote movements so no devices are missing logs
  let allMovements = [...localMovements];
  if (client) {
    try {
      const { data: cloudMovements } = await client
        .from('stock_movements')
        .select('*');

      if (cloudMovements && cloudMovements.length > 0) {
        const localIdSet = new Set(localMovements.map((m) => m.id));
        for (const cm of cloudMovements) {
          if (!localIdSet.has(cm.id)) {
            const mapped: StockMovement = {
              id: cm.id,
              productId: cm.product_id,
              productName: cm.product_name,
              type: cm.type,
              quantityChange: Number(cm.quantity_change),
              previousStock: Number(cm.previous_stock),
              newStock: Number(cm.new_stock),
              reason: cm.reason,
              referenceId: cm.reference_id,
              createdAt: cm.created_at
            };
            allMovements.push(mapped);
            await db.stockMovements.put(mapped).catch(() => {});
          }
        }
      }
    } catch (_) {}
  }

  // De-duplicate movements by ID and signature
  const dedupedMovements = new Map<string, StockMovement>();
  for (const m of allMovements) {
    const sig = `${m.productName}_${m.quantityChange}_${m.reason}_${m.referenceId || ''}_${(m.createdAt || '').slice(0, 16)}`;
    if (!dedupedMovements.has(m.id) && !dedupedMovements.has(sig)) {
      dedupedMovements.set(m.id, m);
      dedupedMovements.set(sig, m);
    }
  }
  const cleanMovements = Array.from(new Set(dedupedMovements.values()));

  const fixedItems: AuditResult['fixedItems'] = [];

  for (const prod of products) {
    // Find all movements matching this product by ID or Name
    const prodMovements = cleanMovements.filter(
      (m) => m.productId === prod.id || m.productName.trim().toLowerCase() === prod.name.trim().toLowerCase()
    );

    if (prodMovements.length > 0) {
      // Sum all changes: +inward, -sale, +return, ±adjust
      const netMovementSum = prodMovements.reduce((acc, m) => acc + (Number(m.quantityChange) || 0), 0);
      const calculatedStock = Math.max(0, Math.round(netMovementSum * 100) / 100);

      if (Math.abs(prod.stockQty - calculatedStock) > 0.001) {
        const oldStock = prod.stockQty;

        // 1. Update local Dexie DB
        await db.products.update(prod.id, {
          stockQty: calculatedStock,
          updatedAt: new Date().toISOString(),
          synced: false
        });

        // 2. Update React Zustand Store in Memory
        useProductStore.getState().updateProductStockInMemory(prod.id, calculatedStock);

        // 3. Update Supabase PostgreSQL DB (both dual columns)
        if (client) {
          try {
            await client.from('products').update({
              stock_qty: calculatedStock,
              stock_quantity: calculatedStock,
              updated_at: new Date().toISOString()
            }).eq('id', prod.id);
          } catch (_) {}
        }

        fixedItems.push({
          productId: prod.id,
          productName: prod.name,
          oldStock,
          auditedStock: calculatedStock
        });
      }
    }
  }

  // Refresh products in memory
  if (fixedItems.length > 0) {
    await useProductStore.getState().loadProducts(true);
  }

  return {
    totalAudited: products.length,
    mismatchesFound: fixedItems.length,
    fixedItems
  };
}

