import React, { useState, useRef } from 'react';
import { X, Printer, Share2, CheckCircle2, Download, Smartphone } from 'lucide-react';
import { FeeReceipt, ShopProfile } from '../../types';
import { sendFeeReceiptWhatsApp } from '../../lib/coachingWhatsApp';

interface FeeReceiptModalProps {
  receipt: FeeReceipt;
  profile: ShopProfile;
  onClose: () => void;
}

export function FeeReceiptModal({ receipt, profile, onClose }: FeeReceiptModalProps) {
  const [printFormat, setPrintFormat] = useState<'a5' | 'thermal'>('a5');
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    sendFeeReceiptWhatsApp(receipt, profile);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-[#0A1220] flex items-center justify-between bg-[#14213D] text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C88A35]/25 text-[#E0A96D] flex items-center justify-center font-bold border border-[#C88A35]/40 text-lg">
              ₹
            </div>
            <div>
              <h3 className="font-bold text-lg">Fee Payment Receipt</h3>
              <p className="text-xs text-stone-300">Receipt No: {receipt.receiptNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-[#0A1220] p-1 rounded-lg flex text-xs">
              <button
                onClick={() => setPrintFormat('a5')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  printFormat === 'a5' ? 'bg-[#C88A35] text-[#14213D] font-bold shadow-xs' : 'text-stone-400 hover:text-white'
                }`}
              >
                A4 / A5
              </button>
              <button
                onClick={() => setPrintFormat('thermal')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  printFormat === 'thermal' ? 'bg-[#C88A35] text-[#14213D] font-bold shadow-xs' : 'text-stone-400 hover:text-white'
                }`}
              >
                80mm Thermal
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable View Area */}
        <div className="p-6 overflow-y-auto flex-1 bg-[#F5F2EB] flex justify-center">
          {printFormat === 'a5' ? (
            /* A4/A5 Official Receipt Format */
            <div
              ref={printRef}
              className="bg-white border border-[#E5E1DA] rounded-xl p-8 max-w-xl w-full shadow-sm text-stone-800 printable-receipt"
            >
              {/* Institute Header */}
              <div className="text-center pb-4 border-b-2 border-[#C88A35]">
                <h1 className="text-2xl font-black tracking-tight text-[#14213D] uppercase">
                  {profile.shopName && !profile.shopName.toLowerCase().includes('retail') ? profile.shopName : 'WebRajya Tuition'}
                </h1>
                <p className="text-xs text-[#C88A35] font-semibold tracking-wide uppercase mt-0.5">
                  {profile.tagline || 'Excellence in Coaching & Board Preparations'}
                </p>
                <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">{profile.address}</p>
                <div className="flex justify-center items-center gap-4 text-xs text-stone-500 mt-1 font-mono">
                  <span>Phone: {profile.phone}</span>
                  {profile.registrationNo && <span>Reg: {profile.registrationNo}</span>}
                </div>
              </div>

              {/* Receipt Title & Meta */}
              <div className="flex justify-between items-center my-4 bg-[#FAF7F0] px-4 py-2.5 rounded-lg border border-[#E5E1DA]">
                <div>
                  <span className="text-xs text-[#14213D] font-bold uppercase tracking-wider block">Official Fee Receipt</span>
                  <span className="font-mono font-bold text-sm text-[#C88A35]">{receipt.receiptNumber}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-stone-500 block">Date & Time</span>
                  <span className="text-xs font-semibold text-stone-800">
                    {receipt.paymentDate} • {receipt.paymentTime}
                  </span>
                </div>
              </div>

              {/* Student Details Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50/80 p-3.5 rounded-lg border border-gray-200/80 mb-4">
                <div>
                  <span className="text-gray-500 block">Student Name:</span>
                  <span className="font-bold text-gray-900 text-sm">{receipt.studentName}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Enrollment No / ID:</span>
                  <span className="font-mono font-bold text-gray-900 text-sm">{receipt.enrollmentNo}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Class / Standard:</span>
                  <span className="font-medium text-gray-800">{receipt.standard}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Father / Guardian:</span>
                  <span className="font-medium text-gray-800">{receipt.parentName || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Parent Phone:</span>
                  <span className="font-mono text-gray-800">{receipt.parentMobile}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Roll Number:</span>
                  <span className="font-mono text-gray-800">{receipt.rollNo || 'N/A'}</span>
                </div>
              </div>

              {/* Fee Breakdown Table */}
              <table className="w-full text-xs mb-4">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 font-semibold text-left">
                    <th className="py-2">Particulars / Installment</th>
                    <th className="py-2 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {receipt.installmentTitles.map((title, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 font-medium text-gray-800">{title}</td>
                      <td className="py-2.5 text-right font-mono text-gray-700">
                        ₹{(receipt.baseAmount / (receipt.installmentTitles.length || 1)).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                  {receipt.lateFine > 0 && (
                    <tr className="text-red-600">
                      <td className="py-1.5 font-medium">+ Late Fine / Fee</td>
                      <td className="py-1.5 text-right font-mono">₹{receipt.lateFine.toLocaleString('en-IN')}</td>
                    </tr>
                  )}
                  {receipt.discountAmount > 0 && (
                    <tr className="text-emerald-600">
                      <td className="py-1.5 font-medium">- Scholarship / Fee Concession</td>
                      <td className="py-1.5 text-right font-mono">₹{receipt.discountAmount.toLocaleString('en-IN')}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-gray-300 font-bold text-gray-900 bg-slate-50">
                    <td className="py-2.5 px-2 text-sm">TOTAL AMOUNT RECEIVED</td>
                    <td className="py-2.5 px-2 text-right font-mono text-base text-emerald-700">
                      ₹{receipt.netReceived.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Payment Info & Dues */}
              <div className="flex justify-between items-center text-xs p-3 bg-amber-50/70 border border-amber-200/60 rounded-lg mb-6">
                <div>
                  <span className="text-gray-600">Payment Mode: </span>
                  <span className="font-bold uppercase text-gray-900">{receipt.paymentMode}</span>
                  {receipt.transactionRef && (
                    <span className="text-gray-500 ml-2 font-mono">Ref: {receipt.transactionRef}</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-gray-600">Remaining Balance Due: </span>
                  <span className="font-mono font-bold text-amber-900">
                    ₹{receipt.balanceRemaining.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Terms & Signature footer */}
              <div className="pt-4 border-t border-gray-200 flex justify-between items-end text-[11px] text-gray-500">
                <div className="max-w-[65%] space-y-1">
                  <p className="font-medium text-gray-600">Terms & Conditions:</p>
                  <p className="whitespace-pre-line text-[10px] leading-tight text-gray-400">
                    {profile.termsAndConditions || '1. Fees once paid is strictly non-refundable.\n2. Keep this receipt for exam entry.'}
                  </p>
                </div>
                <div className="text-center w-36">
                  <div className="h-10 border-b border-dashed border-gray-400 mb-1"></div>
                  <span className="block font-semibold text-gray-700 text-xs">Authorized Signatory</span>
                  <span className="text-[10px] text-gray-400">Cashier / Director</span>
                </div>
              </div>
            </div>
          ) : (
            /* 80mm Thermal Receipt Format */
            <div className="bg-white border border-gray-300 rounded-lg p-4 w-72 shadow-sm font-mono text-xs text-black printable-thermal">
              <div className="text-center pb-2 border-b border-dashed border-black">
                <h2 className="font-bold text-sm uppercase">
                  {profile.shopName && !profile.shopName.toLowerCase().includes('retail') ? profile.shopName : 'WebRajya Tuition'}
                </h2>
                <p className="text-[10px]">{profile.phone}</p>
                <p className="text-[10px] uppercase font-bold mt-1">FEE PAYMENT RECEIPT</p>
              </div>

              <div className="py-2 border-b border-dashed border-black text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span>Rec No:</span>
                  <span className="font-bold">{receipt.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{receipt.paymentDate}</span>
                </div>
                <div className="flex justify-between">
                  <span>Student:</span>
                  <span className="font-bold truncate max-w-[150px]">{receipt.studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span>ID No:</span>
                  <span>{receipt.enrollmentNo}</span>
                </div>
                <div className="flex justify-between">
                  <span>Class:</span>
                  <span>{receipt.standard}</span>
                </div>
              </div>

              <div className="py-2 border-b border-dashed border-black space-y-1">
                <div className="font-bold text-[10px]">INSTALLMENTS PAID:</div>
                {receipt.installmentTitles.map((t, i) => (
                  <div key={i} className="text-[10px] flex justify-between">
                    <span className="truncate max-w-[160px]">• {t}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1 border-t border-dotted border-black font-bold text-sm">
                  <span>PAID:</span>
                  <span>₹{receipt.netReceived.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Mode:</span>
                  <span className="uppercase">{receipt.paymentMode}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Balance Due:</span>
                  <span>₹{receipt.balanceRemaining.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="text-center pt-3 text-[10px] text-gray-600">
                <p>Fees once paid is non-refundable.</p>
                <p className="mt-1">*** THANK YOU ***</p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div className="p-3 sm:p-4 bg-white border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <button
            onClick={handleWhatsAppShare}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-xs transition-all text-xs sm:text-sm active:scale-98 cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            Send to Parent WhatsApp
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold shadow-sm transition-all text-xs sm:text-sm active:scale-98 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print Receipt
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all text-xs sm:text-sm active:scale-98 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
