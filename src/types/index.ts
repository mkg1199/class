export type UnitType = 'Pcs' | 'Pkt' | 'Box' | 'Dozen' | 'Ream' | 'Set' | 'Roll' | 'Pad';
export type TaxType = 'inclusive' | 'exclusive';
export type GstRate = 0 | 5 | 12 | 18 | 28;
export type PaymentMode = 'cash' | 'upi' | 'card' | 'credit';
export type InvoiceStatus = 'completed' | 'draft' | 'cancelled';
export type InvoiceType = 'gst' | 'bill_of_supply' | 'delivery_challan' | 'credit_note' | 'quotation' | 'simple';
export type StockMovementType = 'sale' | 'purchase' | 'adjustment' | 'return';
export type PrintCopyType = 'original' | 'duplicate' | 'triplicate';

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  categoryId?: string;
  packInfo: string;
  unit: UnitType;
  mrp: number;
  purchaseRate: number;
  saleRate: number;
  hsnCode: string;
  gstRate: GstRate;
  taxType: TaxType;
  stockQty: number;
  minStockLevel: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
  hasSerialTracking?: boolean;
  alternateBarcodes?: string[];
  serialNumbers?: string[];
}

export type ProductSerialStatus = 'in_stock' | 'sold' | 'damaged' | 'returned';

export interface ProductSerial {
  id: string;
  productId: string;
  serialNumber: string;
  status: ProductSerialStatus;
  invoiceId?: string;
  costPrice?: number;
  soldAt?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  serialNumber?: string;
  hsnCode: string;
  pack: string;
  remark?: string;
  unit: UnitType;
  qty: number;
  freeQty: number;
  mrp: number;
  unitRate: number;
  schemeDiscountPct: number;
  schemeDiscountAmount: number;
  addlDiscountPct: number;
  addlDiscountAmount: number;
  discountPct: number;
  discountAmount: number;
  gstRate: GstRate;
  taxType: TaxType;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  availableStock: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  date: string;
  time: string;
  customerName: string;
  customerMobile: string;
  customerGstin?: string;
  customerAddress?: string;
  items: InvoiceItem[];
  subtotal: number;
  totalDiscount: number;
  totalGst: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  freightAmount: number;
  roundOff: number;
  netPayable: number;
  paymentMode: PaymentMode;
  paidAmount: number;
  balanceAmount: number;
  status: InvoiceStatus;
  isInterstate: boolean;
  copyType?: PrintCopyType;
  reverseCharge?: boolean;
  placeOfSupply?: string;
  placeOfSupplyCode?: string;
  challanPurpose?: 'job_work' | 'godown_transfer' | 'approval' | 'others';
  originalInvoiceId?: string;
  originalInvoiceNumber?: string;
  originalInvoiceDate?: string;
  returnReason?: string;
  notes?: string;
  idempotencyKey?: string;
  upiReference?: string;
  transactionRef?: string;
  createdAt: string;
  synced?: boolean;
}

export interface DraftInvoice {
  id: string;
  draftName: string;
  customerName: string;
  customerMobile: string;
  customerGstin?: string;
  invoiceType?: InvoiceType;
  items: InvoiceItem[];
  paymentMode: PaymentMode;
  isInterstate: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  creditBalance: number;
  creditLimit?: number;
  notes?: string;
  isActive?: boolean;
  synced?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantityChange: number;
  previousStock: number;
  newStock: number;
  reason: string;
  createdAt: string;
  referenceId?: string;
}

export interface ShopProfile {
  shopName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  state: string;
  pincode: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  upiId: string;
  invoicePrefix: string;
  termsAndConditions: string;
  // Coaching additions
  registrationNo?: string;
  affiliationNo?: string;
  directorName?: string;
  directorSignatureUrl?: string;
  logoUrl?: string;
  receiptPrefix?: string;
  studentIdPrefix?: string;
  academicSession?: string;
}

export type PaperSize = '80mm' | '58mm' | 'A5' | 'A4' | 'Thermal';
export type PrintEngine = 'auto' | 'usb' | 'bluetooth' | 'browser';

export interface PrintSettings {
  paperSize: PaperSize;
  printEngine: PrintEngine;
  autoCutPaper: boolean;
  openCashDrawer: boolean;
  showGstBreakdown: boolean;
  showBankDetails: boolean;
  showTerms: boolean;
  autoPrintOnSave: boolean;
}

export type WhatsAppReceiptFormat = 'text' | 'pdf' | 'image';
export type WhatsAppPdfStyle = 'a5' | 'thermal_80mm';

export interface BillingSettings {
  defaultInvoiceType: 'gst' | 'simple';
  showAdvancedModes: boolean;
  enableBos: boolean;
  enableChallan: boolean;
  enableEstimate: boolean;
  enableIgst: boolean;
  whatsappFormat: WhatsAppReceiptFormat;
  whatsappPdfStyle: WhatsAppPdfStyle;
  quickSearchAdd?: boolean;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  autoSync: boolean;
  lastSyncAt: string | null;
}

export interface AuditLog {
  id: string;
  action: string;
  tableName: string;
  recordId: string;
  details: Record<string, any>;
  createdBy?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  mobile?: string;
  gstin?: string;
  address?: string;
  balancePayable: number;
  createdAt: string;
}

export interface PurchaseInvoiceItem {
  id: string;
  purchaseInvoiceId?: string;
  productId?: string;
  rawName: string;
  matchedProductName?: string;
  hsnCode?: string;
  qty: number;
  freeQty?: number;
  unit: UnitType;
  purchaseRate: number;
  mrp: number;
  saleRate?: number;
  discountPct?: number;
  gstRate: GstRate;
  totalAmount: number;
  isNewProduct?: boolean;
}

export interface PurchaseInvoice {
  id: string;
  supplierName: string;
  supplierGstin?: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalItems: number;
  subtotal: number;
  totalGst: number;
  grandTotal: number;
  billImageUrl?: string;
  status: 'completed' | 'draft' | 'cancelled';
  items: PurchaseInvoiceItem[];
  createdAt: string;
  synced?: boolean;
}

export interface PettyExpense {
  id: string;
  category: 'Tea & Refreshments' | 'Transport & Loading' | 'Packing Material' | 'Cleaning & Maintenance' | 'Courier & Post' | 'Bank Deposit' | 'Other';
  amount: number;
  description: string;
  time: string;
  createdAt: string;
}

export interface DenominationCount {
  c500: number;
  c200: number;
  c100: number;
  c50: number;
  c20: number;
  c10: number;
  coins: number;
}

export interface DailyRegisterData {
  date: string;
  openingCash: number;
  closingCashCounted: number;
  expenses: PettyExpense[];
  notes?: string;
  closedAt?: string;
}

// ==========================================
// COACHING CLASS & INSTITUTE MANAGEMENT TYPES
// ==========================================

export const SUPPORTED_STANDARDS = [
  'LKG',
  'UKG',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10'
] as const;

export type SupportedStandard = typeof SUPPORTED_STANDARDS[number];
export type StudentStatus = 'active' | 'inactive' | 'alumni' | 'dropped';
export type Gender = 'male' | 'female' | 'other';
export type AcademicBoard = 'CBSE' | 'ICSE' | 'State Board' | 'IB' | 'Other';

export interface Student {
  id: string;
  enrollmentNo: string;
  rollNo?: string;
  name: string;
  gender?: Gender;
  dob?: string;
  bloodGroup?: string;
  photoUrl?: string;
  standard: SupportedStandard | string; // 'LKG' | 'UKG' | 'Class 1' ... 'Class 10'
  stream?: string; // Science / Commerce / Arts / Foundation
  schoolName?: string;
  board?: AcademicBoard | string;
  fatherName?: string;
  motherName?: string;
  parentMobile: string;
  studentMobile?: string;
  whatsappNumber: string;
  email?: string;
  address?: string;
  city?: string;
  pincode?: string;
  joiningDate: string;
  batchIds: string[]; // Batches enrolled in
  status: StudentStatus;
  discountScholarshipPct?: number;
  totalFeeAssigned?: number;
  totalFeePaid?: number;
  feeBalanceDue?: number;
  notes?: string;
  synced?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Course {
  id: string;
  code: string; // e.g. "PHY-11" or "JEE-MAIN"
  name: string; // e.g. "Class 11 Physics & Chemistry"
  standard: string;
  stream?: string;
  description?: string;
  subjects: string[];
  durationMonths: number;
  totalFee: number;
  admissionFee: number;
  installmentCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Batch {
  id: string;
  courseId: string;
  courseName: string;
  name: string; // e.g. "Batch A - Morning (Class 10)"
  standard: string;
  timing: string; // e.g. "07:30 AM - 09:30 AM"
  days: string[]; // ["Mon", "Wed", "Fri"]
  classroom?: string;
  facultyName?: string;
  maxCapacity: number;
  currentStrength?: number;
  academicYear: string; // e.g. "2026-2027"
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type FeePaymentStatus = 'paid' | 'partial' | 'pending' | 'overdue';

export interface FeeInstallmentSchedule {
  id: string;
  studentId: string;
  courseId?: string;
  installmentNumber: number;
  title: string; // e.g. "Admission Fee", "1st Installment", "2nd Installment"
  dueDate: string;
  amount: number;
  paidAmount: number;
  balanceAmount: number;
  status: FeePaymentStatus;
  lastPaymentDate?: string;
}

export interface FeePlan {
  id: string;
  studentId: string;
  studentName: string;
  enrollmentNo: string;
  courseId: string;
  courseName: string;
  standard: string;
  totalBaseFee: number;
  scholarshipDiscountAmount: number;
  scholarshipReason?: string;
  netFeePayable: number;
  admissionFee: number;
  installments: FeeInstallmentSchedule[];
  totalPaid: number;
  balanceDue: number;
  status: FeePaymentStatus;
  academicYear: string;
  createdAt: string;
  updatedAt?: string;
}

export type FeePaymentMode = 'cash' | 'upi' | 'card' | 'cheque' | 'netbanking';

export interface FeeReceipt {
  id: string;
  receiptNumber: string; // e.g. "REC-2026-0001"
  studentId: string;
  enrollmentNo: string;
  rollNo?: string;
  studentName: string;
  standard: string;
  batchNames: string[];
  parentName?: string;
  parentMobile: string;
  paymentDate: string;
  paymentTime: string;
  installmentIds: string[];
  installmentTitles: string[];
  baseAmount: number;
  lateFine: number;
  discountAmount: number;
  netReceived: number;
  balanceRemaining: number;
  paymentMode: FeePaymentMode;
  transactionRef?: string; // UPI Ref / Cheque No / Txn ID
  bankName?: string;
  chequeDate?: string;
  notes?: string;
  collectedBy?: string;
  synced?: boolean;
  createdAt: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  batchId: string;
  batchName: string;
  studentId: string;
  studentName: string;
  rollNo?: string;
  status: AttendanceStatus;
  remarks?: string;
  notifiedParent?: boolean;
  markedBy?: string;
  createdAt: string;
}

export interface Exam {
  id: string;
  title: string; // e.g. "Unit Test 1 - Mechanics", "Weekly Mock Test #4"
  batchId: string;
  batchName: string;
  subject: string;
  examDate: string;
  maxMarks: number;
  passingMarks: number;
  syllabus?: string;
  academicYear: string;
  createdAt: string;
}

export interface ExamScore {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  rollNo?: string;
  marksObtained: number;
  isAbsent: boolean;
  percentage: number;
  grade?: string;
  rank?: number;
  remarks?: string;
  notifiedParent?: boolean;
  createdAt: string;
}

export type ExpenseCategory =
  | 'Rent'
  | 'Faculty Salary'
  | 'Staff Salary'
  | 'Electricity & Water'
  | 'Printing & Stationery'
  | 'Study Material'
  | 'Marketing & Ads'
  | 'Internet & Software'
  | 'Repairs & Maintenance'
  | 'Refreshments'
  | 'Other';

export interface CoachingExpense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  paymentMode: 'cash' | 'upi' | 'bank_transfer' | 'cheque';
  paidTo: string;
  description: string;
  date: string;
  time?: string;
  voucherNo?: string;
  receiptUrl?: string;
  createdAt: string;
}

export interface InstituteProfile {
  instituteName: string;
  tagline: string;
  affiliationNo?: string;
  registrationNo?: string;
  address: string;
  phone: string;
  altPhone?: string;
  email: string;
  website?: string;
  directorName: string;
  directorSignatureUrl?: string;
  logoUrl?: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  upiId: string;
  receiptPrefix: string;
  studentIdPrefix: string;
  academicSession: string; // e.g. "2026-2027"
  termsAndConditions: string;
  smsWhatsappSenderName?: string;
}

