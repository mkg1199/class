import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  User,
  CreditCard,
  QrCode,
  DollarSign,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  Share2,
  Calendar,
  Phone,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { useStudentStore } from '../../store/useStudentStore';
import { useFeeStore } from '../../store/useFeeStore';
import { useCourseStore } from '../../store/useCourseStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { Student, FeePlan, FeeReceipt, FeePaymentMode } from '../../types';
import { FeeReceiptModal } from './FeeReceiptModal';

export function FeeCounterSection() {
  const { students, searchStudents, loadStudents } = useStudentStore();
  const { feePlans, feeReceipts, loadFeeData, collectFee, createFeePlanForStudent } = useFeeStore();
  const { courses, loadCoursesAndBatches } = useCourseStore();
  const { shopProfile } = useSettingsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedInstallmentIds, setSelectedInstallmentIds] = useState<string[]>([]);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [lateFine, setLateFine] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<FeePaymentMode>('upi');
  const [transactionRef, setTransactionRef] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<FeeReceipt | null>(null);

  // Initialize data
  useEffect(() => {
    loadStudents();
    loadFeeData();
    loadCoursesAndBatches();
  }, []);

  // Filter students based on search query
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchStudents(searchQuery).slice(0, 6);
  }, [searchQuery, students]);

  // Current student's fee plan
  const studentFeePlan = useMemo(() => {
    if (!selectedStudent) return null;
    return feePlans.find((p) => p.studentId === selectedStudent.id) || null;
  }, [selectedStudent, feePlans]);

  // Whenever a student is selected, pre-select their first pending/overdue installment
  useEffect(() => {
    if (selectedStudent && studentFeePlan) {
      const firstPending = studentFeePlan.installments.find((i) => i.status !== 'paid');
      if (firstPending) {
        setSelectedInstallmentIds([firstPending.id]);
        setCustomAmount(String(firstPending.balanceAmount));
      } else {
        setSelectedInstallmentIds([]);
        setCustomAmount('0');
      }
    } else {
      setSelectedInstallmentIds([]);
      setCustomAmount('');
    }
  }, [selectedStudent, studentFeePlan]);

  // Calculate total base payable from selected installments
  const basePayableAmount = useMemo(() => {
    if (customAmount && Number(customAmount) > 0) {
      return Number(customAmount);
    }
    if (!studentFeePlan) return 0;
    return studentFeePlan.installments
      .filter((i) => selectedInstallmentIds.includes(i.id))
      .reduce((sum, i) => sum + i.balanceAmount, 0);
  }, [selectedInstallmentIds, studentFeePlan, customAmount]);

  const netPayable = Math.max(0, basePayableAmount + lateFine - discountAmount);

  // Generate UPI payment QR URL (standard UPI specification)
  const upiQrUrl = useMemo(() => {
    const upiId = shopProfile.upiId || 'webrajyatuition@upi';
    const payeeName = encodeURIComponent(
      shopProfile.shopName && !shopProfile.shopName.toLowerCase().includes('retail')
        ? shopProfile.shopName
        : 'WebRajya Tuition'
    );
    const note = encodeURIComponent(`Fee-${selectedStudent?.enrollmentNo || 'Receipt'}`);
    const upiUri = `upi://pay?pa=${upiId}&pn=${payeeName}&am=${netPayable}&cu=INR&tn=${note}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiUri)}`;
  }, [shopProfile, netPayable, selectedStudent]);

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setSearchQuery('');
  };

  const handleToggleInstallment = (id: string, balance: number) => {
    setSelectedInstallmentIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      // update custom amount to sum of selected
      if (studentFeePlan) {
        const total = studentFeePlan.installments
          .filter((i) => next.includes(i.id))
          .reduce((sum, i) => sum + i.balanceAmount, 0);
        setCustomAmount(String(total));
      }
      return next;
    });
  };

  const handleCreateDefaultPlan = async () => {
    if (!selectedStudent || courses.length === 0) return;
    const course = courses[0];
    await createFeePlanForStudent(selectedStudent, course);
  };

  const handleCollectFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || netPayable <= 0) return;

    setIsSubmitting(true);
    try {
      const titles = studentFeePlan
        ? studentFeePlan.installments
            .filter((i) => selectedInstallmentIds.includes(i.id))
            .map((i) => i.title)
        : ['Fee Payment'];

      const receipt = await collectFee({
        studentId: selectedStudent.id,
        installmentIds: selectedInstallmentIds,
        installmentTitles: titles.length > 0 ? titles : ['Custom Fee Payment'],
        amountPaid: Number(customAmount) || basePayableAmount,
        lateFine,
        discountAmount,
        paymentMode,
        transactionRef,
        notes,
        collectedBy: 'Fee Counter Staff'
      });

      setActiveReceipt(receipt);

      // Reset selection
      setTransactionRef('');
      setNotes('');
      setLateFine(0);
      setDiscountAmount(0);
    } catch (err: any) {
      alert('Error collecting fee: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Student Finder */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-stone-900 flex items-center gap-2">
              <Receipt className="w-6 h-6 text-[#C88A35]" />
              Fee Collection Counter
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Rapid student search, installment settlement, UPI scan-to-pay & receipt generation
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-96">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search student by Name, Roll No, Phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#C88A35]/25 focus:border-[#C88A35] transition-all"
              />
            </div>

            {/* Autocomplete Dropdown */}
            {filteredStudents.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-stone-200 shadow-xl z-30 divide-y divide-stone-100 overflow-hidden">
                {filteredStudents.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => handleSelectStudent(student)}
                    className="w-full px-4 py-3 text-left hover:bg-[#FAF7F0] flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                        <span>{student.name}</span>
                        <span className="text-xs font-mono font-normal bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">
                          {student.enrollmentNo}
                        </span>
                      </div>
                      <div className="text-xs text-stone-500 flex items-center gap-3 mt-0.5">
                        <span>{student.standard}</span>
                        <span>•</span>
                        <span>Parent: {student.parentMobile}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-stone-400 block">Due Balance</span>
                      <span className="font-mono font-bold text-xs text-red-600">
                        ₹{(student.feeBalanceDue || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedStudent ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Student Details Card (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#14213D] to-[#253966] text-[#E0A96D] flex items-center justify-center font-bold text-lg shadow-sm border border-[#C88A35]/30">
                    {selectedStudent.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-900 text-base">{selectedStudent.name}</h3>
                    <p className="text-xs font-mono text-[#C88A35] font-semibold">{selectedStudent.enrollmentNo}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="text-xs text-stone-400 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded-md transition-colors"
                >
                  Change
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100 text-xs">
                <div className="p-2.5 bg-stone-50 rounded-lg">
                  <span className="text-stone-400 block text-[10px]">CLASS / STREAM</span>
                  <span className="font-medium text-stone-800">{selectedStudent.standard}</span>
                </div>
                <div className="p-2.5 bg-stone-50 rounded-lg">
                  <span className="text-stone-400 block text-[10px]">ROLL NUMBER</span>
                  <span className="font-mono font-medium text-stone-800">{selectedStudent.rollNo || 'N/A'}</span>
                </div>
                <div className="p-2.5 bg-stone-50 rounded-lg">
                  <span className="text-stone-400 block text-[10px]">PARENT PHONE</span>
                  <span className="font-mono font-medium text-stone-800">{selectedStudent.parentMobile}</span>
                </div>
                <div className="p-2.5 bg-stone-50 rounded-lg">
                  <span className="text-stone-400 block text-[10px]">SCHOOL</span>
                  <span className="font-medium text-stone-800 truncate block">{selectedStudent.schoolName || 'N/A'}</span>
                </div>
              </div>

              {/* Fee Financial Summary Card */}
              <div className="p-4 bg-gradient-to-br from-[#14213D] to-[#1C2C4E] rounded-xl text-white space-y-3 border border-[#0A1220]">
                <div className="flex justify-between items-center text-xs text-stone-300">
                  <span>Assigned Total Fee</span>
                  <span className="font-mono font-bold text-white">
                    ₹{(selectedStudent.totalFeeAssigned || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-stone-300">
                  <span>Total Paid So Far</span>
                  <span className="font-mono font-semibold text-emerald-400">
                    ₹{(selectedStudent.totalFeePaid || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="pt-2 border-t border-stone-700/80 flex justify-between items-center">
                  <span className="text-xs font-semibold text-[#E0A96D]">Remaining Balance</span>
                  <span className="font-mono text-lg font-bold text-[#F3C58B]">
                    ₹{(selectedStudent.feeBalanceDue || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Receipts For This Student */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                Previous Receipts
              </h4>
              {feeReceipts.filter((r) => r.studentId === selectedStudent.id).length === 0 ? (
                <p className="text-xs text-gray-400 italic py-2">No previous receipts recorded yet.</p>
              ) : (
                <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
                  {feeReceipts
                    .filter((r) => r.studentId === selectedStudent.id)
                    .map((receipt) => (
                      <div key={receipt.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-mono font-semibold text-gray-800">{receipt.receiptNumber}</span>
                          <span className="text-gray-400 block text-[10px]">{receipt.paymentDate}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-emerald-700">
                            ₹{receipt.netReceived.toLocaleString('en-IN')}
                          </span>
                          <button
                            onClick={() => setActiveReceipt(receipt)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-900"
                            title="View & Print"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Fee Installment Selector & Settlement Form (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs">
              <h3 className="font-bold text-gray-900 text-base mb-4 flex items-center justify-between">
                <span>Select Fee Installments to Clear</span>
                {studentFeePlan && (
                  <span className="text-xs font-normal text-gray-500">
                    Plan: <strong className="text-gray-800">{studentFeePlan.courseName}</strong>
                  </span>
                )}
              </h3>

              {!studentFeePlan ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl p-6">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <h4 className="font-semibold text-gray-800 text-sm">No Fee Structure Assigned Yet</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                    This student does not have an active fee plan. You can assign the standard course fee structure.
                  </p>
                  <button
                    onClick={handleCreateDefaultPlan}
                    className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium transition-all"
                  >
                    Assign Standard Fee Plan
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Installments Table */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                    {studentFeePlan.installments.map((inst) => {
                      const isSelected = selectedInstallmentIds.includes(inst.id);
                      const isPaid = inst.status === 'paid';
                      const isOverdue =
                        !isPaid && inst.dueDate < new Date().toISOString().split('T')[0];

                      return (
                        <label
                          key={inst.id}
                          className={`flex items-center justify-between p-3.5 transition-colors cursor-pointer select-none ${
                            isPaid
                              ? 'bg-stone-50/60 opacity-60 cursor-not-allowed'
                              : isSelected
                              ? 'bg-[#FAF7F0] border-l-4 border-l-[#C88A35]'
                              : 'hover:bg-stone-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              disabled={isPaid}
                              checked={isSelected}
                              onChange={() => handleToggleInstallment(inst.id, inst.balanceAmount)}
                              className="rounded border-stone-300 text-[#C88A35] focus:ring-[#C88A35] w-4 h-4"
                            />
                            <div>
                              <div className="font-semibold text-stone-800 text-sm flex items-center gap-2">
                                <span>{inst.title}</span>
                                {isPaid ? (
                                  <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                                    PAID
                                  </span>
                                ) : isOverdue ? (
                                  <span className="text-[10px] font-semibold bg-red-100 text-red-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <ShieldAlert className="w-2.5 h-2.5" /> OVERDUE
                                  </span>
                                ) : null}
                              </div>
                              <span className="text-xs text-stone-400 block mt-0.5">
                                Due Date: {inst.dueDate} {inst.paidAmount > 0 && `(Paid ₹${inst.paidAmount})`}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-xs text-stone-400 block">Balance</span>
                            <span className="font-mono font-bold text-sm text-stone-900">
                              ₹{inst.balanceAmount.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Payment Details Form */}
                  <form onSubmit={handleCollectFee} className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Amount to Pay (₹)
                        </label>
                        <input
                          type="number"
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono font-bold text-[#C88A35] focus:outline-hidden focus:ring-2 focus:ring-[#C88A35]/25 focus:border-[#C88A35] text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Late Fine / Extra (₹)
                        </label>
                        <input
                          type="number"
                          value={lateFine || ''}
                          onChange={(e) => setLateFine(Number(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-[#C88A35]/25"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Scholarship / Concession (₹)
                        </label>
                        <input
                          type="number"
                          value={discountAmount || ''}
                          onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-stone-300 rounded-xl font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-[#C88A35]/25"
                        />
                      </div>
                    </div>

                    {/* Payment Mode Selector */}
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1.5">
                        Payment Mode
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {(['upi', 'cash', 'card', 'cheque', 'netbanking'] as FeePaymentMode[]).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setPaymentMode(mode)}
                            className={`py-2 px-3 rounded-xl border text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                              paymentMode === mode
                                ? 'bg-[#14213D] text-[#E0A96D] border-[#14213D] shadow-xs'
                                : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dynamic UPI QR Code Display if UPI is selected */}
                    {paymentMode === 'upi' && netPayable > 0 && (
                      <div className="p-4 bg-[#FAF7F0] border border-[#E5E1DA] rounded-xl flex flex-col sm:flex-row items-center gap-4">
                        <div className="bg-white p-2 rounded-lg shadow-xs border border-stone-200">
                          <img
                            src={upiQrUrl}
                            alt="UPI QR Code"
                            className="w-28 h-28 object-contain"
                          />
                        </div>
                        <div className="space-y-1 text-center sm:text-left">
                          <span className="text-xs font-bold text-[#14213D] flex items-center gap-1.5 justify-center sm:justify-start">
                            <QrCode className="w-4 h-4 text-[#C88A35]" />
                            Scan with GPay, PhonePe, Paytm, BHIM
                          </span>
                          <p className="text-xs text-stone-600">
                            UPI ID: <strong className="font-mono text-[#14213D]">{shopProfile.upiId || 'apexacademy@upi'}</strong>
                          </p>
                          <p className="text-[11px] text-stone-500">
                            Exact amount ₹{netPayable.toLocaleString('en-IN')} will be pre-filled on parent's phone.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Transaction Ref / UPI UTR / Cheque No
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. UTR-30491823901 or Cheque #00412"
                          value={transactionRef}
                          onChange={(e) => setTransactionRef(e.target.value)}
                          className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-[#C88A35]/25"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Remarks / Note
                        </label>
                        <input
                          type="text"
                          placeholder="Optional remark on receipt"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-[#C88A35]/25"
                        />
                      </div>
                    </div>

                    {/* Total Net Settlement Summary & Submit */}
                    <div className="pt-4 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <span className="text-xs text-stone-500 block">Total Net Collection</span>
                        <span className="font-mono text-2xl font-black text-[#14213D]">
                          ₹{netPayable.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting || netPayable <= 0}
                        className="w-full sm:w-auto px-8 py-3 bg-[#C88A35] hover:bg-[#B37929] active:scale-98 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-[#C88A35]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <Receipt className="w-5 h-5" />
                        {isSubmitting ? 'Recording Payment...' : 'Collect Fee & Print Receipt'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Empty State: Prompt to select a student */
        <div className="bg-white rounded-2xl border border-gray-200/80 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Select a Student to Begin Fee Collection</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Use the search bar above or choose from recent students below to collect installments, issue fee receipts, or view payment history.
          </p>

          {/* Quick pick chips */}
          <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-xl mx-auto">
            {students.slice(0, 5).map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedStudent(s)}
                className="px-3.5 py-2 bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-300 rounded-xl text-xs font-medium text-gray-700 hover:text-emerald-900 transition-all flex items-center gap-2"
              >
                <span>{s.name}</span>
                <span className="text-[10px] font-mono text-gray-400">({s.enrollmentNo})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fee Receipt Preview & Print Modal */}
      {activeReceipt && (
        <FeeReceiptModal
          receipt={activeReceipt}
          profile={shopProfile}
          onClose={() => setActiveReceipt(null)}
        />
      )}
    </div>
  );
}
