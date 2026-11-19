import React, { useState } from 'react';
import { PackageMinus, PackagePlus, AlertCircle, CheckCircle2, Loader2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useProductStore } from '../../store/useProductStore';
import type { Product } from '../../types';

type AdjustmentReason =
  | 'stock_correction'
  | 'damage'
  | 'theft'
  | 'return_to_supplier'
  | 'sample_given'
  | 'expired'
  | 'free_issue'
  | 'opening_stock'
  | 'other';

const ADJUSTMENT_REASONS: { id: AdjustmentReason; label: string; icon: string }[] = [
  { id: 'stock_correction', label: 'Stock Correction', icon: '🔧' },
  { id: 'opening_stock',    label: 'Opening Stock',    icon: '📦' },
  { id: 'damage',           label: 'Damaged Goods',    icon: '💔' },
  { id: 'theft',            label: 'Theft / Loss',     icon: '🚨' },
  { id: 'return_to_supplier', label: 'Return to Supplier', icon: '↩️' },
  { id: 'sample_given',     label: 'Sample Given',     icon: '🎁' },
  { id: 'expired',          label: 'Expired / Spoiled', icon: '⏰' },
  { id: 'free_issue',       label: 'Free Issue',        icon: '✨' },
  { id: 'other',            label: 'Other',             icon: '📝' },
];

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  onToast: (type: 'success' | 'error' | 'info', title: string, desc?: string) => void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  product,
  onToast,
}) => {
  const { adjustStock } = useProductStore();

  const [adjustType, setAdjustType] = useState<'add' | 'remove'>('add');
  const [qty, setQty] = useState<number>(1);
  const [reason, setReason] = useState<AdjustmentReason>('stock_correction');
  const [customNote, setCustomNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const currentStock = product?.stockQty ?? 0;
  const previewStock = adjustType === 'add'
    ? currentStock + qty
    : Math.max(0, currentStock - qty);

  const handleConfirm = async () => {
    if (!product) return;
    if (!qty || qty <= 0) {
      onToast('error', 'Invalid Quantity', 'Please enter a valid quantity greater than 0.');
      return;
    }

    const reasonLabel = ADJUSTMENT_REASONS.find(r => r.id === reason)?.label ?? reason;
    const fullReason = `${reasonLabel}${customNote ? ` — ${customNote}` : ''}`;

    setIsSaving(true);
    try {
      const quantityChange = adjustType === 'add' ? qty : -qty;
      await adjustStock(product.id, quantityChange, fullReason);
      onToast(
        'success',
        'Stock Adjusted',
        `${product.name}: ${adjustType === 'add' ? '+' : '-'}${qty} ${product.unit} → New Stock: ${previewStock} ${product.unit}`
      );
      setQty(1);
      setReason('stock_correction');
      setCustomNote('');
      onClose();
    } catch (err) {
      onToast('error', 'Adjustment Failed', String(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (!product) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Stock Adjustment"
      subtitle={`Manually adjust stock for: ${product.name}`}
      maxWidth="lg"
    >
      <div className="space-y-4">

        {/* Product Info Bar */}
        <div className="flex items-center justify-between p-3 bg-[#F5F9FF] border border-[#D8E1EC] rounded-xl">
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-[#172B4D] truncate">{product.name}</div>
            <div className="text-[11px] text-[#64748B] font-mono">SKU: {product.sku} · {product.category}</div>
          </div>
          <div className="text-right shrink-0 ml-3">
            <div className="text-[11px] text-[#64748B] font-bold uppercase">Current Stock</div>
            <div className={`text-xl font-black font-mono ${currentStock <= product.minStockLevel ? 'text-red-600' : 'text-[#15803D]'}`}>
              {currentStock} <span className="text-sm font-bold">{product.unit}</span>
            </div>
          </div>
        </div>

        {/* Add / Remove Toggle */}
        <div>
          <label className="block text-xs font-bold text-[#172B4D] mb-2 uppercase tracking-wider">Adjustment Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAdjustType('add')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black border-2 transition-all cursor-pointer active:scale-95
                ${adjustType === 'add'
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                  : 'bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50'}`}
            >
              <ArrowUpCircle className="w-5 h-5" /> Add Stock (+)
            </button>
            <button
              type="button"
              onClick={() => setAdjustType('remove')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black border-2 transition-all cursor-pointer active:scale-95
                ${adjustType === 'remove'
                  ? 'bg-red-600 border-red-600 text-white shadow-md'
                  : 'bg-white border-red-300 text-red-700 hover:bg-red-50'}`}
            >
              <ArrowDownCircle className="w-5 h-5" /> Remove Stock (-)
            </button>
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-xs font-bold text-[#172B4D] mb-1.5 uppercase tracking-wider">
            Quantity to {adjustType === 'add' ? 'Add' : 'Remove'} ({product.unit})
          </label>
          <input
            type="number"
            min={1}
            value={qty || ''}
            onChange={e => setQty(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-full px-3 py-2.5 bg-white border-2 border-[#D8E1EC] rounded-xl text-2xl font-black font-mono text-[#172B4D] focus:outline-none focus:border-[#2563EB] text-center"
            placeholder="0"
            autoFocus
          />

          {/* Quick Quantity Chips */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {[1, 2, 5, 10, 25, 50].map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setQty(v)}
                className="px-3 py-1 bg-white border border-[#D8E1EC] rounded-lg text-xs font-bold text-[#172B4D] hover:bg-[#DBEAFE] transition-colors cursor-pointer"
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-bold text-[#172B4D] mb-1.5 uppercase tracking-wider">Reason</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {ADJUSTMENT_REASONS.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setReason(r.id)}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer text-left
                  ${reason === r.id
                    ? 'bg-[#2563EB] border-[#2563EB] text-white'
                    : 'bg-white border-[#D8E1EC] text-[#172B4D] hover:bg-[#F5F9FF]'}`}
              >
                <span>{r.icon}</span>
                <span className="truncate">{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Note */}
        <div>
          <label className="block text-xs font-bold text-[#172B4D] mb-1 uppercase tracking-wider">Additional Note (Optional)</label>
          <input
            type="text"
            value={customNote}
            onChange={e => setCustomNote(e.target.value)}
            placeholder="e.g. Broken during transport, batch #A123..."
            className="w-full px-3 py-2 bg-white border border-[#D8E1EC] rounded-lg text-xs font-semibold text-[#172B4D] focus:outline-none focus:border-[#2563EB]"
          />
        </div>

        {/* Preview Banner */}
        <div className={`flex items-center justify-between p-3 rounded-xl border-2 font-mono
          ${adjustType === 'add'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-red-50 border-red-200 text-red-900'}`}
        >
          <div className="text-xs font-bold">
            {adjustType === 'add' ? <PackagePlus className="w-4 h-4 inline mr-1" /> : <PackageMinus className="w-4 h-4 inline mr-1" />}
            Stock after adjustment:
          </div>
          <div className="text-lg font-black">
            {currentStock} {adjustType === 'add' ? '+' : '−'} {qty || 0} = <span className="underline">{previewStock} {product.unit}</span>
          </div>
        </div>

        {/* Warning for over-remove */}
        {adjustType === 'remove' && qty > currentStock && (
          <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-800 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            Removing more than current stock — stock will be set to 0.
          </div>
        )}

        {/* Confirm Button */}
        <button
          type="button"
          disabled={isSaving || qty <= 0}
          onClick={handleConfirm}
          className={`w-full py-3.5 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] shadow-md disabled:opacity-50 disabled:cursor-not-allowed
            ${adjustType === 'add'
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'}`}
        >
          {isSaving
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <CheckCircle2 className="w-5 h-5" />}
          Confirm Adjustment
        </button>

      </div>
    </Modal>
  );
};

