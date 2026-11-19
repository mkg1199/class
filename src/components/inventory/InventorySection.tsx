import React, { useState, useEffect } from 'react';
import { 
  Boxes, AlertTriangle, TrendingUp, IndianRupee, 
  RefreshCw, PackageCheck, Camera, FileText, SlidersHorizontal, Trash2, ShieldCheck
} from 'lucide-react';
import { useProductStore } from '../../store/useProductStore';
import { db } from '../../lib/db';
import { getSupabaseClient } from '../../lib/supabase';
import { auditAndReconcileAllStock } from '../../lib/stockAuditEngine';
import { StockMovement } from '../../types';
import type { Product } from '../../types';
import { Badge } from '../common/Badge';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { PurchaseBillScannerModal } from './PurchaseBillScannerModal';
import { PurchaseInvoicesModal } from './PurchaseInvoicesModal';
import { ReorderAssistantModal } from './ReorderAssistantModal';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { StockTakeModal } from './StockTakeModal';
import { useSettingsStore } from '../../store/useSettingsStore';

interface InventorySectionProps {
  onToast: (type: 'success' | 'error' | 'info', title: string, desc?: string) => void;
}

export const InventorySection: React.FC<InventorySectionProps> = ({ onToast }) => {
  const { products, loadProducts } = useProductStore();
  const { shopProfile, loadSettings } = useSettingsStore();
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isInvoicesModalOpen, setIsInvoicesModalOpen] = useState(false);
  const [isReorderOpen, setIsReorderOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [isStockTakeOpen, setIsStockTakeOpen] = useState(false);
  const [inventoryTab, setInventoryTab] = useState<'stock' | 'valuation'>('stock');
  const [isAuditing, setIsAuditing] = useState(false);

  useEffect(() => {
    loadProducts(true);
    loadMovements();
    loadSettings();
    // Auto-heal any potential drift between stock balances and movements logs
    auditAndReconcileAllStock().then((res) => {
      if (res.mismatchesFound > 0) {
        loadProducts(true);
        loadMovements();
      }
    }).catch(() => {});

    const handleOpenModal = (e: any) => {
      const type = e.detail;
      if (type === 'bill_scanner') setIsScannerOpen(true);
      if (type === 'stock_take') setIsStockTakeOpen(true);
      if (type === 'reorder_assistant') setIsReorderOpen(true);
    };
    window.addEventListener('open-inventory-modal', handleOpenModal);
    return () => window.removeEventListener('open-inventory-modal', handleOpenModal);
  }, []);

  const loadMovements = async () => {
    // 1. Instant local load
    let logs = await db.stockMovements.orderBy('createdAt').reverse().limit(50).toArray().catch(() => []);

    // 2. Cross-check with purchase invoices: ensure all inwarded items appear in the audit movements
    try {
      const purchases = await db.purchaseInvoices.toArray().catch(() => []);
      if (purchases.length > 0) {
        const existingRefReasons = new Set(logs.map(l => `${l.productName}_${l.reason}`));
        let addedAny = false;

        for (const p of purchases) {
          if (Array.isArray(p.items)) {
            for (const item of p.items) {
              const pName = item.matchedProductName || item.rawName;
              const reason = `Purchase Inward: Bill #${p.invoiceNumber} from ${p.supplierName}${item.freeQty ? ` (${item.qty} + ${item.freeQty} Free)` : ''}`;
              const key = `${pName}_${reason}`;

              if (!existingRefReasons.has(key)) {
                const totalQty = Number(item.qty || 0) + Number(item.freeQty || 0);
                const movement: StockMovement = {
                  id: `sm_pur_${p.id}_${item.productId || Math.random().toString(36).substring(2, 6)}`,
                  productId: item.productId || 'unknown',
                  productName: pName,
                  type: 'purchase',
                  quantityChange: totalQty,
                  previousStock: 0,
                  newStock: totalQty,
                  reason,
                  referenceId: p.id,
                  createdAt: p.createdAt || p.invoiceDate || new Date().toISOString()
                };
                await db.stockMovements.put(movement).catch(() => {});
                existingRefReasons.add(key);
                addedAny = true;
              }
            }
          }
        }
        if (addedAny) {
          logs = await db.stockMovements.orderBy('createdAt').reverse().limit(50).toArray().catch(() => []);
        }
      }
    } catch (_) {}

    // 3. Supabase Cloud Sync: Fetch recent cloud movements
    try {
      const client = getSupabaseClient();
      if (client) {
        const { data: cloudLogs } = await client
          .from('stock_movements')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (cloudLogs && cloudLogs.length > 0) {
          for (const row of cloudLogs) {
            const m: StockMovement = {
              id: row.id,
              productId: row.product_id,
              productName: row.product_name,
              type: row.type,
              quantityChange: Number(row.quantity_change),
              previousStock: Number(row.previous_stock),
              newStock: Number(row.new_stock),
              reason: row.reason,
              referenceId: row.reference_id,
              createdAt: row.created_at
            };
            await db.stockMovements.put(m).catch(() => {});
          }
          logs = await db.stockMovements.orderBy('createdAt').reverse().limit(50).toArray().catch(() => []);
        } else if (logs.length > 0) {
          // Cloud has 0 movements, push local movements up so deployed/remote counters see history
          const toPush = logs.slice(0, 50).map(m => ({
            id: m.id,
            product_id: m.productId,
            product_name: m.productName,
            type: m.type,
            quantity_change: Number(m.quantityChange),
            previous_stock: Number(m.previousStock || 0),
            new_stock: Number(m.newStock || 0),
            reason: m.reason,
            reference_id: m.referenceId || null,
            created_at: m.createdAt
          }));
          await client.from('stock_movements').upsert(toPush, { onConflict: 'id' });
        }
      }
    } catch (_) {}

    // 4. Clean up any duplicate movements by unique key (product + change + reason + reference)
    const uniqueMap = new Map<string, StockMovement>();
    const duplicateIdsToDelete: string[] = [];

    for (const log of logs) {
      const dedupKey = `${log.productName}_${log.quantityChange}_${log.reason}_${log.referenceId || ''}_${log.createdAt.slice(0, 16)}`;
      if (uniqueMap.has(dedupKey)) {
        duplicateIdsToDelete.push(log.id);
      } else {
        uniqueMap.set(dedupKey, log);
      }
    }

    if (duplicateIdsToDelete.length > 0) {
      await db.stockMovements.bulkDelete(duplicateIdsToDelete).catch(() => {});
    }

    setMovements(Array.from(uniqueMap.values()));
  };

  const handleClearMovements = async () => {
    if (window.confirm('Clear all stock movement logs?')) {
      await db.stockMovements.clear();
      const client = getSupabaseClient();
      if (client) {
        try {
          await client.from('stock_movements').delete().neq('id', 'all_rows_delete');
        } catch (_) {}
      }
      setMovements([]);
      onToast('success', 'Logs cleared', 'All stock movement logs have been deleted.');
    }
  };

  const handleAuditAndReconcile = async () => {
    setIsAuditing(true);
    try {
      const res = await auditAndReconcileAllStock();
      await loadProducts(true);
      await loadMovements();
      if (res.mismatchesFound > 0) {
        onToast(
          'success',
          'Stock Reconciled!',
          `Fixed ${res.mismatchesFound} product mismatch(es). All stocks now 100% align with audit logs.`
        );
      } else {
        onToast(
          'success',
          'Audit Passed (100% Match)',
          `All ${res.totalAudited} product stocks perfectly match inward and outward movement logs.`
        );
      }
    } catch (err: any) {
      onToast('error', 'Audit Failed', err.message || 'Unable to reconcile stocks');
    } finally {
      setIsAuditing(false);
    }
  };

  const lowStockItems = products.filter(p => p.stockQty > 0 && p.stockQty <= p.minStockLevel);
  const outOfStockItems = products.filter(p => p.stockQty <= 0);

  const totalCostValuation = products.reduce((acc, p) => acc + (p.purchaseRate * p.stockQty), 0);
  const totalMrpValuation = products.reduce((acc, p) => acc + (p.mrp * p.stockQty), 0);

  const filteredProducts = products.filter(p => {
    if (stockFilter === 'low') return p.stockQty > 0 && p.stockQty <= p.minStockLevel;
    if (stockFilter === 'out') return p.stockQty <= 0;
    return true;
  });

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] gap-3 font-sans text-[#172B4D] pb-28 md:pb-4">
      {/* Header Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-white border border-[#D8E1EC] rounded-xl p-3 sm:p-4 shadow-xs shrink-0 gap-2.5 sm:gap-3">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-[#172B4D] flex items-center gap-2">
            <Boxes className="w-4 h-4 sm:w-5 sm:h-5 text-[#2563EB]" /> Retail Inventory & Valuation
          </h2>
          <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5">
            Monitor real-time stock balances, valuations, and supplier purchase bills
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setIsReorderOpen(true)}
            className="flex-1 sm:flex-initial px-3 py-2 sm:py-1.5 bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#B45309] border border-[#FCD34D] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 transition-all"
            title="Open Smart Low-Stock Reorder PO Assistant"
          >
            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#B45309]" />
            <span>Reorder PO</span>
            {lowStockItems.length + outOfStockItems.length > 0 && (
              <span className="px-1.5 py-0.2 bg-[#B45309] text-white text-[10px] font-black rounded-full">
                {lowStockItems.length + outOfStockItems.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsInvoicesModalOpen(true)}
            className="flex-1 sm:flex-initial px-3 py-2 sm:py-1.5 bg-white hover:bg-[#F5F9FF] text-[#172B4D] border border-[#D8E1EC] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 transition-all"
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#64748B]" /> Inward Bills
          </button>

          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="flex-1 sm:flex-initial px-3.5 py-2 sm:py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
          >
            <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Scan Purchase Bill
          </button>

          <button
            type="button"
            onClick={() => setAdjustTarget(filteredProducts[0] ?? null)}
            className="flex-1 sm:flex-initial px-3 py-2 sm:py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
            title="Manually add or remove stock"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Adjust Stock
          </button>

          <button
            type="button"
            onClick={() => setIsStockTakeOpen(true)}
            className="flex-1 sm:flex-initial px-3 py-2 sm:py-1.5 bg-[#0F766E] hover:bg-[#0D6960] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
            title="Physical count sheet and audit"
          >
            <PackageCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Stock Take
          </button>

          <button
            type="button"
            onClick={handleAuditAndReconcile}
            disabled={isAuditing}
            className="flex-1 sm:flex-initial px-3 py-2 sm:py-1.5 bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all disabled:opacity-50"
            title="Auto-verify and reconcile all stock quantities with movements log"
          >
            <ShieldCheck className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isAuditing ? 'animate-spin' : ''}`} />
            {isAuditing ? 'Auditing...' : 'Reconcile Stock'}
          </button>
        </div>
      </div>

      {/* Metrics Row - Perfectly Aligned 2x2 on Mobile, 4 Cols on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 shrink-0">
        <div className="p-3 sm:p-4 bg-white border border-[#D8E1EC] rounded-xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-[#64748B] uppercase tracking-wider">Total Items</span>
            <div className="p-1.5 sm:p-2 bg-[#DBEAFE] text-[#2563EB] rounded-lg shrink-0">
              <Boxes className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-1">
            <div className="text-lg sm:text-2xl font-black text-[#172B4D] font-mono tracking-tight flex items-baseline gap-1">
              <span>{products.length.toLocaleString('en-IN')}</span>
              <span className="text-xs sm:text-sm font-semibold text-[#64748B] font-sans">SKUs</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#64748B] mt-0.5 truncate">Active product catalog</p>
          </div>
        </div>

        <div className="p-3 sm:p-4 bg-white border border-[#D8E1EC] rounded-xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-[#64748B] uppercase tracking-wider">Low Stock</span>
            <div className="p-1.5 sm:p-2 bg-[#FEF3C7] text-[#B45309] rounded-lg shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-1">
            <div className="text-lg sm:text-2xl font-black text-[#B45309] font-mono tracking-tight flex items-baseline gap-1">
              <span>{lowStockItems.length.toLocaleString('en-IN')}</span>
              <span className="text-xs sm:text-sm font-semibold text-[#B45309]/80 font-sans">Items</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#64748B] mt-0.5 truncate">Below reorder minimum</p>
          </div>
        </div>

        <div className="p-3 sm:p-4 bg-white border border-[#D8E1EC] rounded-xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-[#64748B] uppercase tracking-wider">Out of Stock</span>
            <div className="p-1.5 sm:p-2 bg-[#FEE2E2] text-[#B91C1C] rounded-lg shrink-0">
              <PackageCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-1">
            <div className="text-lg sm:text-2xl font-black text-[#B91C1C] font-mono tracking-tight flex items-baseline gap-1">
              <span>{outOfStockItems.length.toLocaleString('en-IN')}</span>
              <span className="text-xs sm:text-sm font-semibold text-[#B91C1C]/80 font-sans">Items</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#64748B] mt-0.5 truncate">Requires replenishment</p>
          </div>
        </div>

        <div className="p-3 sm:p-4 bg-white border border-[#D8E1EC] rounded-xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-[#64748B] uppercase tracking-wider truncate">Stock Valuation</span>
            <div className="p-1.5 sm:p-2 bg-[#DCFCE7] text-[#15803D] rounded-lg shrink-0">
              <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-1 min-w-0">
            <div 
              className="text-base sm:text-xl lg:text-2xl font-black text-[#15803D] font-mono tracking-tight truncate leading-tight"
              title={`Cost Valuation: ${formatCurrency(totalCostValuation, true)}`}
            >
              {formatCurrency(totalCostValuation, false)}
            </div>
            <p 
              className="text-[10px] sm:text-[11px] text-[#64748B] mt-0.5 font-mono truncate"
              title={`Retail MRP: ${formatCurrency(totalMrpValuation, true)}`}
            >
              MRP: {formatCurrency(totalMrpValuation, false)}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Split: Stock List & Movement Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Stock Status Table & Valuation Tab */}
        <div className="col-span-1 lg:col-span-7 bg-white border border-[#D8E1EC] rounded-xl overflow-hidden flex flex-col shadow-xs">
          <div className="p-3 bg-[#F5F9FF] border-b border-[#D8E1EC] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-[#D8E1EC] text-xs">
              <button
                type="button"
                onClick={() => setInventoryTab('stock')}
                className={`px-3 py-1 rounded font-black transition-all cursor-pointer ${
                  inventoryTab === 'stock'
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#172B4D]'
                }`}
              >
                📦 Stock Balances
              </button>
              <button
                type="button"
                onClick={() => setInventoryTab('valuation')}
                className={`px-3 py-1 rounded font-black transition-all cursor-pointer ${
                  inventoryTab === 'valuation'
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#172B4D]'
                }`}
              >
                💰 Valuation Report
              </button>
            </div>

            {inventoryTab === 'stock' && (
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-[#D8E1EC] text-[11px] self-stretch sm:self-auto justify-between">
                <button
                  onClick={() => setStockFilter('all')}
                  className={`px-2 py-1 rounded transition-colors font-bold cursor-pointer text-center flex-1 sm:flex-initial ${stockFilter === 'all' ? 'bg-[#2563EB] text-white' : 'text-[#64748B] hover:text-[#172B4D]'}`}
                >
                  All ({products.length})
                </button>
                <button
                  onClick={() => setStockFilter('low')}
                  className={`px-2 py-1 rounded transition-colors font-bold cursor-pointer text-center flex-1 sm:flex-initial ${stockFilter === 'low' ? 'bg-[#B45309] text-white' : 'text-[#64748B] hover:text-[#172B4D]'}`}
                >
                  Low ({lowStockItems.length})
                </button>
                <button
                  onClick={() => setStockFilter('out')}
                  className={`px-2 py-1 rounded transition-colors font-bold cursor-pointer text-center flex-1 sm:flex-initial ${stockFilter === 'out' ? 'bg-[#B91C1C] text-white' : 'text-[#64748B] hover:text-[#172B4D]'}`}
                >
                  Out ({outOfStockItems.length})
                </button>
              </div>
            )}
          </div>

          {inventoryTab === 'stock' ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block flex-1 overflow-y-auto max-h-[500px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#F1F5F9] text-[#172B4D] uppercase font-bold sticky top-0 border-b border-[#D8E1EC] text-[11px]">
                    <tr>
                      <th className="p-2.5">Item Name</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5 text-right">Current Stock</th>
                      <th className="p-2.5 text-right">Min Level</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 text-center">Adjust</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredProducts.map((p) => {
                      const isOut = p.stockQty <= 0;
                      const isLow = p.stockQty > 0 && p.stockQty <= p.minStockLevel;
                      return (
                        <tr key={p.id} className="hover:bg-[#F0F6FF] transition-colors">
                          <td className="p-2.5 font-semibold text-[#172B4D]">{p.name}</td>
                          <td className="p-2.5 text-[#64748B] text-[11px]">{p.category}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-[#172B4D]">{p.stockQty} {p.unit}</td>
                          <td className="p-2.5 text-right font-mono text-[#64748B]">{p.minStockLevel} {p.unit}</td>
                          <td className="p-2.5 text-center font-mono">
                            {isOut ? (
                              <Badge variant="rose">OUT OF STOCK</Badge>
                            ) : isLow ? (
                              <Badge variant="amber">LOW STOCK</Badge>
                            ) : (
                              <Badge variant="emerald">HEALTHY</Badge>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => setAdjustTarget(p)}
                              className="px-2.5 py-1 bg-[#EDE9FE] hover:bg-[#DDD6FE] text-[#7C3AED] border border-[#C4B5FD] rounded-lg text-[11px] font-bold cursor-pointer transition-colors active:scale-95"
                              title={`Adjust stock for ${p.name}`}
                            >
                              ± Adjust
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="block md:hidden p-2.5 space-y-2 overflow-y-auto max-h-[calc(100vh-22rem)] min-h-[220px]">
                {filteredProducts.map((p) => {
                  const isOut = p.stockQty <= 0;
                  const isLow = p.stockQty > 0 && p.stockQty <= p.minStockLevel;
                  return (
                    <div key={p.id} className="p-2.5 bg-[#F8FAFC] border border-[#D8E1EC] rounded-xl flex items-center justify-between gap-2 shadow-2xs hover:bg-white transition-colors">
                      <div className="min-w-0 flex-1 pr-1">
                        <div className="text-xs font-bold text-[#172B4D] truncate">{p.name}</div>
                        <div className="text-[10px] text-[#64748B] mt-0.5 truncate">
                          {p.category} • <span className="font-mono">Min: {p.minStockLevel} {p.unit}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <div className="text-xs font-mono font-black text-[#172B4D]">
                          {p.stockQty} <span className="font-sans font-medium text-[10px] text-[#64748B]">{p.unit}</span>
                        </div>
                        {isOut ? (
                          <span className="text-[9px] min-w-[36px] text-center px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold border border-red-200">OUT</span>
                        ) : isLow ? (
                          <span className="text-[9px] min-w-[36px] text-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200">LOW</span>
                        ) : (
                          <span className="text-[9px] min-w-[36px] text-center px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">OK</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setAdjustTarget(p)}
                          className="mt-0.5 px-2 py-0.5 bg-[#EDE9FE] text-[#7C3AED] border border-[#C4B5FD] rounded-md text-[9px] font-bold cursor-pointer active:scale-95"
                        >
                          ± Adjust
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Valuation Report View */
            <div className="flex-1 overflow-y-auto max-h-[500px] p-3 space-y-3">
              {/* Valuation Summary Header */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-blue-600 uppercase">Purchase Cost</div>
                  <div className="text-sm sm:text-base font-black text-blue-900 font-mono mt-0.5">
                    {formatCurrency(totalCostValuation)}
                  </div>
                </div>
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase">Retail MRP</div>
                  <div className="text-sm sm:text-base font-black text-emerald-900 font-mono mt-0.5">
                    {formatCurrency(totalMrpValuation)}
                  </div>
                </div>
                <div className="p-2.5 bg-violet-50 border border-violet-200 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-violet-600 uppercase">Potential Profit</div>
                  <div className="text-sm sm:text-base font-black text-violet-900 font-mono mt-0.5">
                    {formatCurrency(Math.max(0, totalMrpValuation - totalCostValuation))}
                  </div>
                </div>
              </div>

              {/* Valuation Detailed Table */}
              <div className="hidden md:block border border-[#D8E1EC] rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#F1F5F9] text-[#172B4D] uppercase font-bold sticky top-0 border-b border-[#D8E1EC] text-[10px]">
                    <tr>
                      <th className="p-2">Item</th>
                      <th className="p-2 text-right">In Stock</th>
                      <th className="p-2 text-right">Cost Rate</th>
                      <th className="p-2 text-right">Sale Rate</th>
                      <th className="p-2 text-right">Total Cost</th>
                      <th className="p-2 text-right">Total MRP</th>
                      <th className="p-2 text-right">Est. Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {products
                      .filter(p => p.stockQty > 0)
                      .sort((a, b) => (b.purchaseRate * b.stockQty) - (a.purchaseRate * a.stockQty))
                      .map((p) => {
                        const cost = p.purchaseRate * p.stockQty;
                        const mrp = p.mrp * p.stockQty;
                        const profit = mrp - cost;
                        return (
                          <tr key={p.id} className="hover:bg-[#F0F6FF] transition-colors">
                            <td className="p-2">
                              <div className="font-bold text-[#172B4D] truncate max-w-[160px]">{p.name}</div>
                              <div className="text-[10px] text-[#64748B] font-mono">{p.sku}</div>
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-[#172B4D]">{p.stockQty} {p.unit}</td>
                            <td className="p-2 text-right font-mono text-[#64748B]">₹{p.purchaseRate.toFixed(2)}</td>
                            <td className="p-2 text-right font-mono text-[#64748B]">₹{p.saleRate.toFixed(2)}</td>
                            <td className="p-2 text-right font-mono font-bold text-blue-700">₹{cost.toFixed(0)}</td>
                            <td className="p-2 text-right font-mono font-bold text-emerald-700">₹{mrp.toFixed(0)}</td>
                            <td className="p-2 text-right font-mono font-black text-violet-700">
                              +₹{profit.toFixed(0)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Valuation Cards */}
              <div className="block md:hidden space-y-2">
                {products
                  .filter(p => p.stockQty > 0)
                  .sort((a, b) => (b.purchaseRate * b.stockQty) - (a.purchaseRate * a.stockQty))
                  .map((p) => {
                    const cost = p.purchaseRate * p.stockQty;
                    const mrp = p.mrp * p.stockQty;
                    return (
                      <div key={p.id} className="p-2.5 bg-[#F8FAFC] border border-[#D8E1EC] rounded-xl text-xs space-y-1">
                        <div className="font-bold text-[#172B4D] truncate">{p.name}</div>
                        <div className="flex items-center justify-between font-mono text-[11px] text-[#64748B]">
                          <span>Stock: <strong>{p.stockQty} {p.unit}</strong></span>
                          <span>Cost: <strong className="text-blue-700">₹{cost.toFixed(0)}</strong></span>
                          <span>MRP: <strong className="text-emerald-700">₹{mrp.toFixed(0)}</strong></span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Stock Movement History Log */}
        <div className="col-span-1 lg:col-span-5 bg-white border border-[#D8E1EC] rounded-xl overflow-hidden flex flex-col shadow-xs">
          <div className="p-3 bg-[#F5F9FF] border-b border-[#D8E1EC] flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-[#172B4D] uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#15803D]" /> Recent Stock Movements Log
            </h3>
            <div className="flex items-center gap-1">
              {movements.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearMovements}
                  className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 border border-transparent hover:border-red-200 cursor-pointer transition-colors"
                  title="Clear all stock movement logs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={loadMovements}
                className="text-[#64748B] hover:text-[#172B4D] p-1 rounded hover:bg-white border border-transparent hover:border-[#D8E1EC] cursor-pointer"
                title="Refresh logs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
            {movements.length === 0 ? (
              <div className="py-12 text-center text-[#64748B] text-xs">
                No stock movement logs recorded yet.
              </div>
            ) : (
              movements.map((m) => (
                <div key={m.id} className="p-2.5 bg-[#F5F9FF] border border-[#D8E1EC] rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#172B4D] truncate">{m.productName}</span>
                    <span className={`font-mono font-bold ${m.quantityChange > 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'}`}>
                      {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#64748B]">
                    <span>Reason: {m.reason}</span>
                    <span className="font-mono">{formatDate(m.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* AI Purchase Bill Scanner Modal */}
      <PurchaseBillScannerModal
        isOpen={isScannerOpen}
        onClose={() => {
          setIsScannerOpen(false);
          loadProducts(true);
          loadMovements();
        }}
        onToast={onToast}
      />

      {/* Past Purchase Invoices History Modal */}
      <PurchaseInvoicesModal
        isOpen={isInvoicesModalOpen}
        onClose={() => setIsInvoicesModalOpen(false)}
      />

      {/* Smart Low-Stock Reorder PO Assistant Modal */}
      <ReorderAssistantModal
        isOpen={isReorderOpen}
        onClose={() => setIsReorderOpen(false)}
        products={products}
        shopProfile={shopProfile}
        onToast={onToast}
      />

      {/* Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={!!adjustTarget}
        onClose={() => {
          setAdjustTarget(null);
          loadProducts(true);
          loadMovements();
        }}
        product={adjustTarget}
        onToast={onToast}
      />

      {/* Stock Take Modal */}
      <StockTakeModal
        isOpen={isStockTakeOpen}
        onClose={() => {
          setIsStockTakeOpen(false);
          loadProducts(true);
          loadMovements();
        }}
        onToast={onToast}
      />
    </div>
  );
};
