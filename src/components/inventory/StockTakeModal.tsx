import React, { useState, useMemo } from 'react';
import { ClipboardList, CheckCircle2, Loader2, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useProductStore } from '../../store/useProductStore';
import type { Product } from '../../types';

interface StockTakeRow {
  product: Product;
  physicalCount: number | '';
}

interface StockTakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (type: 'success' | 'error' | 'info', title: string, desc?: string) => void;
}

export const StockTakeModal: React.FC<StockTakeModalProps> = ({ isOpen, onClose, onToast }) => {
  const { products, adjustStock } = useProductStore();
  const activeProducts = useMemo(() => products.filter(p => p.isActive !== false), [products]);

  const [rows, setRows] = useState<StockTakeRow[]>([]);
  const [step, setStep] = useState<'count' | 'review'>('count');
  const [isPosting, setIsPosting] = useState(false);
  const [search, setSearch] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setRows(activeProducts.map(p => ({ product: p, physicalCount: '' })));
      setStep('count');
      setSearch('');
    }
  }, [isOpen, activeProducts.length]);

  const filteredRows = rows.filter(r =>
    !search ||
    r.product.name.toLowerCase().includes(search.toLowerCase()) ||
    r.product.sku.toLowerCase().includes(search.toLowerCase())
  );

  const enteredRows = rows.filter(r => r.physicalCount !== '');
  const varianceRows = enteredRows.filter(r => Number(r.physicalCount) !== r.product.stockQty);

  const updateCount = (productId: string, val: string) => {
    setRows(prev => prev.map(r =>
      r.product.id === productId
        ? { ...r, physicalCount: val === '' ? '' : Math.max(0, parseInt(val) || 0) }
        : r
    ));
  };

  const handlePostAdjustments = async () => {
    if (varianceRows.length === 0) {
      onToast('info', 'No Variances', 'All counted items match book stock. Nothing to adjust.');
      onClose();
      return;
    }
    setIsPosting(true);
    try {
      for (const row of varianceRows) {
        const physical = Number(row.physicalCount);
        const diff = physical - row.product.stockQty;
        await adjustStock(row.product.id, diff, 'Physical Stock Take — Count Sheet Variance');
      }
      onToast('success', 'Stock Take Posted', `${varianceRows.length} item(s) adjusted to match physical count.`);
      onClose();
    } catch (err) {
      onToast('error', 'Post Failed', String(err));
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Physical Stock Take"
      subtitle="Enter actual shelf count — system will auto-post adjustments for variances"
      maxWidth="3xl"
    >
      <div className="space-y-4">

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="text-lg font-black text-blue-800 font-mono">{activeProducts.length}</div>
            <div className="text-[11px] font-bold text-blue-600">Total Items</div>
          </div>
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="text-lg font-black text-emerald-800 font-mono">{enteredRows.length}</div>
            <div className="text-[11px] font-bold text-emerald-600">Counted</div>
          </div>
          <div className={`p-2.5 ${varianceRows.length > 0 ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'} border rounded-xl`}>
            <div className={`text-lg font-black ${varianceRows.length > 0 ? 'text-amber-800' : 'text-gray-500'} font-mono`}>{varianceRows.length}</div>
            <div className={`text-[11px] font-bold ${varianceRows.length > 0 ? 'text-amber-600' : 'text-gray-500'}`}>Variances</div>
          </div>
        </div>

        {step === 'count' && (
          <>
            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search product name or SKU..."
              className="w-full px-3 py-2 bg-white border border-[#D8E1EC] rounded-xl text-xs font-semibold text-[#172B4D] focus:outline-none focus:border-[#2563EB]"
            />

            {/* Count Sheet Table */}
            <div className="border border-[#D8E1EC] rounded-xl overflow-hidden">
              <div className="bg-[#F1F5F9] border-b border-[#D8E1EC] px-3 py-2 grid grid-cols-12 gap-2 text-[11px] font-black text-[#172B4D] uppercase tracking-wider">
                <div className="col-span-5">Product</div>
                <div className="col-span-2 text-right">Book Stock</div>
                <div className="col-span-3 text-center">Physical Count</div>
                <div className="col-span-2 text-right">Variance</div>
              </div>
              <div className="divide-y divide-[#E2E8F0] max-h-[380px] overflow-y-auto">
                {filteredRows.map(row => {
                  const physical = row.physicalCount === '' ? null : Number(row.physicalCount);
                  const variance = physical !== null ? physical - row.product.stockQty : null;
                  return (
                    <div key={row.product.id} className="px-3 py-2 grid grid-cols-12 gap-2 items-center hover:bg-[#F8FAFF] transition-colors">
                      <div className="col-span-5 min-w-0">
                        <div className="text-xs font-bold text-[#172B4D] truncate">{row.product.name}</div>
                        <div className="text-[10px] text-[#64748B] font-mono">{row.product.sku}</div>
                      </div>
                      <div className="col-span-2 text-right font-mono text-xs font-bold text-[#172B4D]">
                        {row.product.stockQty} <span className="text-[10px] text-[#94A3B8]">{row.product.unit}</span>
                      </div>
                      <div className="col-span-3 flex justify-center">
                        <input
                          type="number"
                          min={0}
                          value={row.physicalCount}
                          onChange={e => updateCount(row.product.id, e.target.value)}
                          placeholder="—"
                          className="w-full max-w-[80px] px-2 py-1 text-center bg-white border-2 border-[#D8E1EC] rounded-lg text-sm font-black font-mono text-[#172B4D] focus:outline-none focus:border-[#2563EB]"
                        />
                      </div>
                      <div className="col-span-2 text-right font-mono text-xs font-black">
                        {variance === null ? (
                          <span className="text-[#CBD5E1]">—</span>
                        ) : variance === 0 ? (
                          <span className="text-emerald-600 flex items-center justify-end gap-0.5">
                            <Minus className="w-3 h-3" />0
                          </span>
                        ) : variance > 0 ? (
                          <span className="text-blue-600 flex items-center justify-end gap-0.5">
                            <TrendingUp className="w-3 h-3" />+{variance}
                          </span>
                        ) : (
                          <span className="text-red-600 flex items-center justify-end gap-0.5">
                            <TrendingDown className="w-3 h-3" />{variance}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-white border border-[#D8E1EC] rounded-xl text-xs font-bold text-[#172B4D] hover:bg-[#F5F9FF] cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep('review')}
                disabled={enteredRows.length === 0}
                className="flex-1 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-black cursor-pointer transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                <ClipboardList className="w-4 h-4" /> Review Variances →
              </button>
            </div>
          </>
        )}

        {step === 'review' && (
          <>
            {varianceRows.length === 0 ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="font-black text-emerald-800">No Variances Found!</div>
                <div className="text-xs text-emerald-700">All counted items match book stock perfectly.</div>
              </div>
            ) : (
              <>
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-2 text-xs text-amber-900 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  {varianceRows.length} item(s) will be adjusted to match physical count. This cannot be undone.
                </div>
                <div className="border border-[#D8E1EC] rounded-xl overflow-hidden">
                  <div className="bg-[#F1F5F9] border-b border-[#D8E1EC] px-3 py-2 grid grid-cols-12 gap-2 text-[11px] font-black text-[#172B4D] uppercase tracking-wider">
                    <div className="col-span-5">Product</div>
                    <div className="col-span-2 text-right">Book</div>
                    <div className="col-span-2 text-right">Physical</div>
                    <div className="col-span-3 text-right">Adjustment</div>
                  </div>
                  <div className="divide-y divide-[#E2E8F0] max-h-[300px] overflow-y-auto">
                    {varianceRows.map(row => {
                      const physical = Number(row.physicalCount);
                      const diff = physical - row.product.stockQty;
                      return (
                        <div key={row.product.id} className="px-3 py-2 grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-5 text-xs font-bold text-[#172B4D] truncate">{row.product.name}</div>
                          <div className="col-span-2 text-right font-mono text-xs text-[#64748B]">{row.product.stockQty}</div>
                          <div className="col-span-2 text-right font-mono text-xs font-bold text-[#172B4D]">{physical}</div>
                          <div className="col-span-3 text-right font-mono text-xs font-black">
                            <span className={diff > 0 ? 'text-blue-600' : 'text-red-600'}>
                              {diff > 0 ? '+' : ''}{diff} {row.product.unit}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={() => setStep('count')}
                className="flex-1 py-2.5 bg-white border border-[#D8E1EC] rounded-xl text-xs font-bold text-[#172B4D] hover:bg-[#F5F9FF] cursor-pointer">
                ← Back to Count
              </button>
              <button type="button" onClick={handlePostAdjustments} disabled={isPosting}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5">
                {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Post Adjustments
              </button>
            </div>
          </>
        )}

      </div>
    </Modal>
  );
};

