import { create } from 'zustand';
import { FeePlan, FeeReceipt, FeeInstallmentSchedule, Student, Course } from '../types';
import { db } from '../lib/db';
import { INITIAL_FEE_PLANS } from '../lib/seedData';
import { useStudentStore } from './useStudentStore';

interface CollectFeeParams {
  studentId: string;
  installmentIds: string[];
  installmentTitles: string[];
  amountPaid: number;
  lateFine?: number;
  discountAmount?: number;
  paymentMode: 'cash' | 'upi' | 'card' | 'cheque' | 'netbanking';
  transactionRef?: string;
  bankName?: string;
  chequeDate?: string;
  notes?: string;
  collectedBy?: string;
}

interface FeeState {
  feePlans: FeePlan[];
  feeReceipts: FeeReceipt[];
  isLoading: boolean;
  error: string | null;

  loadFeeData: () => Promise<void>;
  createFeePlanForStudent: (
    student: Student,
    course: Course,
    scholarshipPct?: number,
    scholarshipReason?: string,
    customInstallments?: { title: string; dueDate: string; amount: number }[]
  ) => Promise<FeePlan>;
  updateFeePlan: (id: string, updates: Partial<FeePlan>) => Promise<void>;
  collectFee: (params: CollectFeeParams) => Promise<FeeReceipt>;
  getFeePlanByStudentId: (studentId: string) => FeePlan | undefined;
  getReceiptsByStudentId: (studentId: string) => FeeReceipt[];
  getDefaultersList: () => { student: Student; plan?: FeePlan; overdueAmount: number }[];
  generateNextReceiptNumber: () => Promise<string>;
}

export const useFeeStore = create<FeeState>((set, get) => ({
  feePlans: [],
  feeReceipts: [],
  isLoading: false,
  error: null,

  loadFeeData: async () => {
    set({ isLoading: true, error: null });
    try {
      let localPlans = await db.feePlans.toArray();
      let localReceipts = await db.feeReceipts.toArray();

      if (localPlans.length === 0) {
        await db.feePlans.bulkPut(INITIAL_FEE_PLANS);
        localPlans = INITIAL_FEE_PLANS;
      }

      set({
        feePlans: localPlans,
        feeReceipts: localReceipts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        isLoading: false
      });
    } catch (err: any) {
      console.error('Failed to load fee plans/receipts from Dexie:', err);
      set({ error: err?.message || 'Failed to load fee data', isLoading: false });
    }
  },

  generateNextReceiptNumber: async () => {
    const receipts = get().feeReceipts;
    const year = new Date().getFullYear();
    const count = receipts.length + 1;
    const padded = String(count).padStart(4, '0');
    return `REC-${year}-${padded}`;
  },

  createFeePlanForStudent: async (student, course, scholarshipPct = 0, scholarshipReason = '', customInstallments) => {
    const totalBaseFee = course.totalFee;
    const discountAmount = Math.round((totalBaseFee * scholarshipPct) / 100);
    const netFeePayable = totalBaseFee - discountAmount;
    const planId = 'plan-' + Date.now();

    let installments: FeeInstallmentSchedule[] = [];

    if (customInstallments && customInstallments.length > 0) {
      installments = customInstallments.map((ci, index) => ({
        id: `inst-${planId}-${index + 1}`,
        studentId: student.id,
        courseId: course.id,
        installmentNumber: index + 1,
        title: ci.title,
        dueDate: ci.dueDate,
        amount: ci.amount,
        paidAmount: 0,
        balanceAmount: ci.amount,
        status: 'pending'
      }));
    } else {
      // Auto split across course.installmentCount
      const count = Math.max(course.installmentCount || 1, 1);
      const splitAmount = Math.floor(netFeePayable / count);
      const remainder = netFeePayable - splitAmount * count;

      const today = new Date();
      for (let i = 0; i < count; i++) {
        const dueDate = new Date(today);
        dueDate.setMonth(today.getMonth() + i * 2); // Every 2 months

        const amount = i === 0 ? splitAmount + remainder : splitAmount;
        installments.push({
          id: `inst-${planId}-${i + 1}`,
          studentId: student.id,
          courseId: course.id,
          installmentNumber: i + 1,
          title: i === 0 ? 'Admission & 1st Installment' : `Installment ${i + 1}`,
          dueDate: dueDate.toISOString().split('T')[0],
          amount,
          paidAmount: 0,
          balanceAmount: amount,
          status: 'pending'
        });
      }
    }

    const newPlan: FeePlan = {
      id: planId,
      studentId: student.id,
      studentName: student.name,
      enrollmentNo: student.enrollmentNo,
      courseId: course.id,
      courseName: course.name,
      standard: student.standard,
      totalBaseFee,
      scholarshipDiscountAmount: discountAmount,
      scholarshipReason,
      netFeePayable,
      admissionFee: course.admissionFee || 0,
      installments,
      totalPaid: 0,
      balanceDue: netFeePayable,
      status: 'pending',
      academicYear: '2026-2027',
      createdAt: new Date().toISOString()
    };

    await db.feePlans.put(newPlan);
    set((state) => ({
      feePlans: [...state.feePlans, newPlan]
    }));

    // Update student's fee summary
    await useStudentStore.getState().updateStudent(student.id, {
      totalFeeAssigned: netFeePayable,
      totalFeePaid: 0,
      feeBalanceDue: netFeePayable,
      discountScholarshipPct: scholarshipPct
    });

    return newPlan;
  },

  updateFeePlan: async (id, updates) => {
    const existing = get().feePlans.find((p) => p.id === id);
    if (!existing) return;
    const updated: FeePlan = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await db.feePlans.put(updated);
    set((state) => ({
      feePlans: state.feePlans.map((p) => (p.id === id ? updated : p))
    }));
  },

  collectFee: async (params) => {
    const student = useStudentStore.getState().getStudentById(params.studentId);
    if (!student) throw new Error('Student not found');

    const plan = get().feePlans.find((p) => p.studentId === params.studentId);
    const receiptNumber = await get().generateNextReceiptNumber();
    const now = new Date();
    const paymentDate = now.toISOString().split('T')[0];
    const paymentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let remainingPayment = params.amountPaid;
    let updatedInstallments = plan ? [...plan.installments] : [];

    if (plan && updatedInstallments.length > 0) {
      for (const inst of updatedInstallments) {
        if (params.installmentIds.includes(inst.id) && remainingPayment > 0) {
          const dueInThis = inst.balanceAmount;
          const payTowardsThis = Math.min(remainingPayment, dueInThis);

          inst.paidAmount += payTowardsThis;
          inst.balanceAmount = Math.max(0, inst.amount - inst.paidAmount);
          inst.status = inst.balanceAmount === 0 ? 'paid' : 'partial';
          inst.lastPaymentDate = paymentDate;

          remainingPayment -= payTowardsThis;
        }
      }

      const totalPaid = updatedInstallments.reduce((acc, curr) => acc + curr.paidAmount, 0);
      const balanceDue = Math.max(0, plan.netFeePayable - totalPaid);
      const planStatus = balanceDue === 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'pending';

      const updatedPlan: FeePlan = {
        ...plan,
        installments: updatedInstallments,
        totalPaid,
        balanceDue,
        status: planStatus,
        updatedAt: now.toISOString()
      };

      await db.feePlans.put(updatedPlan);
      set((state) => ({
        feePlans: state.feePlans.map((p) => (p.id === plan.id ? updatedPlan : p))
      }));

      // Update student record balance
      await useStudentStore.getState().updateStudent(student.id, {
        totalFeePaid: totalPaid,
        feeBalanceDue: balanceDue
      });
    }

    const currentBalanceRemaining = (student.feeBalanceDue || 0) - params.amountPaid;

    const receipt: FeeReceipt = {
      id: 'receipt-' + Date.now(),
      receiptNumber,
      studentId: student.id,
      enrollmentNo: student.enrollmentNo,
      rollNo: student.rollNo,
      studentName: student.name,
      standard: student.standard,
      batchNames: student.batchIds,
      parentName: student.fatherName || 'Parent / Guardian',
      parentMobile: student.parentMobile,
      paymentDate,
      paymentTime,
      installmentIds: params.installmentIds,
      installmentTitles: params.installmentTitles,
      baseAmount: params.amountPaid,
      lateFine: params.lateFine || 0,
      discountAmount: params.discountAmount || 0,
      netReceived: params.amountPaid + (params.lateFine || 0) - (params.discountAmount || 0),
      balanceRemaining: Math.max(0, currentBalanceRemaining),
      paymentMode: params.paymentMode,
      transactionRef: params.transactionRef,
      bankName: params.bankName,
      chequeDate: params.chequeDate,
      notes: params.notes,
      collectedBy: params.collectedBy || 'Accounts Counter',
      createdAt: now.toISOString()
    };

    await db.feeReceipts.put(receipt);
    set((state) => ({
      feeReceipts: [receipt, ...state.feeReceipts]
    }));

    return receipt;
  },

  getFeePlanByStudentId: (studentId) => get().feePlans.find((p) => p.studentId === studentId),

  getReceiptsByStudentId: (studentId) => get().feeReceipts.filter((r) => r.studentId === studentId),

  getDefaultersList: () => {
    const students = useStudentStore.getState().students;
    const plans = get().feePlans;
    const today = new Date().toISOString().split('T')[0];

    const defaulters: { student: Student; plan?: FeePlan; overdueAmount: number }[] = [];

    for (const student of students) {
      if (student.status !== 'active') continue;
      const plan = plans.find((p) => p.studentId === student.id);

      if (plan) {
        // Calculate overdue installments
        const overdueAmount = plan.installments
          .filter((inst) => inst.status !== 'paid' && inst.dueDate < today)
          .reduce((sum, inst) => sum + inst.balanceAmount, 0);

        if (overdueAmount > 0 || (plan.balanceDue > 0 && student.feeBalanceDue && student.feeBalanceDue > 0)) {
          defaulters.push({
            student,
            plan,
            overdueAmount: overdueAmount > 0 ? overdueAmount : plan.balanceDue
          });
        }
      } else if (student.feeBalanceDue && student.feeBalanceDue > 0) {
        defaulters.push({
          student,
          overdueAmount: student.feeBalanceDue
        });
      }
    }

    return defaulters.sort((a, b) => b.overdueAmount - a.overdueAmount);
  }
}));
