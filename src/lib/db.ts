import Dexie, { Table } from 'dexie';
import type {
  Product,
  Invoice,
  DraftInvoice,
  StockMovement,
  Customer,
  Supplier,
  PurchaseInvoice,
  ProductSerial,
  ShopProfile,
  PrintSettings,
  BillingSettings,
  SupabaseConfig,
  Student,
  Course,
  Batch,
  FeePlan,
  FeeReceipt,
  AttendanceRecord,
  Exam,
  ExamScore,
  CoachingExpense,
  InstituteProfile
} from '../types';

export class WebRajyaDatabase extends Dexie {
  products!: Table<Product, string>;
  invoices!: Table<Invoice, string>;
  drafts!: Table<DraftInvoice, string>;
  stockMovements!: Table<StockMovement, string>;
  customers!: Table<Customer, string>;
  suppliers!: Table<Supplier, string>;
  purchaseInvoices!: Table<PurchaseInvoice, string>;
  productSerials!: Table<ProductSerial, string>;
  auditLogs!: Table<any, string>;
  keyValueSettings!: Table<{ key: string; value: any }, string>;

  // Coaching Class Tables
  students!: Table<Student, string>;
  courses!: Table<Course, string>;
  batches!: Table<Batch, string>;
  feePlans!: Table<FeePlan, string>;
  feeReceipts!: Table<FeeReceipt, string>;
  attendance!: Table<AttendanceRecord, string>;
  exams!: Table<Exam, string>;
  examScores!: Table<ExamScore, string>;
  coachingExpenses!: Table<CoachingExpense, string>;

  constructor() {
    super('WebRajyaCoachingDB');
    this.version(1).stores({
      products: 'id, barcode, name, category, hsnCode, stockQty, synced, updatedAt',
      invoices: 'id, invoiceNumber, date, customerName, customerMobile, status, idempotencyKey, synced, createdAt',
      drafts: 'id, draftName, updatedAt',
      stockMovements: 'id, productId, createdAt, type',
      customers: 'id, mobile, name, createdAt',
      auditLogs: 'id, action, recordId, createdAt',
      keyValueSettings: 'key'
    });

    this.version(2).stores({
      products: 'id, barcode, name, category, hsnCode, stockQty, synced, updatedAt',
      invoices: 'id, invoiceNumber, date, customerName, customerMobile, status, idempotencyKey, synced, createdAt',
      drafts: 'id, draftName, updatedAt',
      stockMovements: 'id, productId, createdAt, type',
      customers: 'id, mobile, name, createdAt',
      suppliers: 'id, name, mobile, gstin, createdAt',
      purchaseInvoices: 'id, invoiceNumber, supplierName, invoiceDate, status, synced, createdAt',
      auditLogs: 'id, action, recordId, createdAt',
      keyValueSettings: 'key'
    });

    this.version(3).stores({
      products: 'id, barcode, name, category, hsnCode, stockQty, synced, updatedAt',
      invoices: 'id, invoiceNumber, date, customerName, customerMobile, status, idempotencyKey, synced, createdAt',
      drafts: 'id, draftName, updatedAt',
      stockMovements: 'id, productId, createdAt, type',
      customers: 'id, mobile, name, createdAt',
      suppliers: 'id, name, mobile, gstin, createdAt',
      purchaseInvoices: 'id, invoiceNumber, supplierName, invoiceDate, status, synced, createdAt',
      productSerials: 'id, productId, serialNumber, status, invoiceId, createdAt',
      auditLogs: 'id, action, recordId, createdAt',
      keyValueSettings: 'key'
    });

    this.version(4).stores({
      products: 'id, barcode, name, category, hsnCode, stockQty, synced, updatedAt',
      invoices: 'id, invoiceNumber, date, customerName, customerMobile, status, idempotencyKey, synced, createdAt',
      drafts: 'id, draftName, updatedAt',
      stockMovements: 'id, productId, createdAt, type',
      customers: 'id, mobile, name, createdAt',
      suppliers: 'id, name, mobile, gstin, createdAt',
      purchaseInvoices: 'id, invoiceNumber, supplierName, invoiceDate, status, synced, createdAt',
      productSerials: 'id, productId, serialNumber, status, invoiceId, createdAt',
      auditLogs: 'id, action, recordId, createdAt',
      keyValueSettings: 'key',

      // Coaching Class Stores
      students: 'id, enrollmentNo, rollNo, name, standard, parentMobile, status, synced, createdAt',
      courses: 'id, code, name, standard, isActive, createdAt',
      batches: 'id, courseId, name, standard, facultyName, academicYear, isActive, createdAt',
      feePlans: 'id, studentId, courseId, status, createdAt',
      feeReceipts: 'id, receiptNumber, studentId, paymentDate, paymentMode, synced, createdAt',
      attendance: 'id, date, batchId, studentId, status, createdAt',
      exams: 'id, batchId, subject, examDate, createdAt',
      examScores: 'id, examId, studentId, createdAt',
      coachingExpenses: 'id, category, date, paymentMode, createdAt'
    });
  }
}

export const db = new WebRajyaDatabase();

// Default Coaching Institute Profile Settings
export const DEFAULT_INSTITUTE_PROFILE: InstituteProfile = {
  instituteName: 'WebRajya Tuition',
  tagline: 'Excellence in Board, Foundation & Competitive Guidance',
  affiliationNo: 'REG/2026/ED-449',
  registrationNo: 'MSME-UDYAM-MP-02-00451',
  address: 'Plot 42, Knowledge Park, Central Avenue',
  phone: '+91 98765 43210',
  altPhone: '+91 98765 43211',
  email: 'contact@webrajyatuition.com',
  website: 'https://webrajyatuition.com',
  directorName: 'Er. R. K. Verma',
  directorSignatureUrl: '',
  logoUrl: '',
  bankName: 'HDFC Bank',
  accountNo: '50200088991122',
  ifscCode: 'HDFC0001234',
  upiId: 'webrajyatuition@okhdfcbank',
  receiptPrefix: 'REC-2026-',
  studentIdPrefix: 'WT-2026-',
  academicSession: '2026-2027',
  termsAndConditions: '1. Fees once paid is strictly non-refundable and non-transferable.\n2. Minimum 75% attendance is compulsory for attending mock test series.\n3. Student must carry their Institute ID card at all times.\n4. Defaulters will not be permitted for final mock examinations.'
};

export const DEFAULT_SHOP_PROFILE: ShopProfile = {
  shopName: DEFAULT_INSTITUTE_PROFILE.instituteName,
  tagline: DEFAULT_INSTITUTE_PROFILE.tagline,
  address: DEFAULT_INSTITUTE_PROFILE.address,
  phone: DEFAULT_INSTITUTE_PROFILE.phone,
  email: DEFAULT_INSTITUTE_PROFILE.email,
  gstin: '',
  state: 'Madhya Pradesh (23)',
  pincode: '480661',
  bankName: DEFAULT_INSTITUTE_PROFILE.bankName,
  accountNo: DEFAULT_INSTITUTE_PROFILE.accountNo,
  ifscCode: DEFAULT_INSTITUTE_PROFILE.ifscCode,
  upiId: DEFAULT_INSTITUTE_PROFILE.upiId,
  invoicePrefix: DEFAULT_INSTITUTE_PROFILE.receiptPrefix,
  termsAndConditions: DEFAULT_INSTITUTE_PROFILE.termsAndConditions,
  registrationNo: DEFAULT_INSTITUTE_PROFILE.registrationNo,
  affiliationNo: DEFAULT_INSTITUTE_PROFILE.affiliationNo,
  directorName: DEFAULT_INSTITUTE_PROFILE.directorName,
  academicSession: DEFAULT_INSTITUTE_PROFILE.academicSession
};

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paperSize: 'A5',
  printEngine: 'auto',
  autoCutPaper: true,
  openCashDrawer: false,
  showGstBreakdown: false,
  showBankDetails: true,
  showTerms: true,
  autoPrintOnSave: true
};

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  defaultInvoiceType: 'simple',
  showAdvancedModes: false,
  enableBos: false,
  enableChallan: false,
  enableEstimate: false,
  enableIgst: false,
  whatsappFormat: 'text',
  whatsappPdfStyle: 'a5',
  quickSearchAdd: true
};

export const DEFAULT_SUPABASE_CONFIG: SupabaseConfig = {
  url: 'https://qgkbkkodosgcvqvaouxf.supabase.co',
  anonKey: 'sb_publishable_5wp7W3kttM0chFtGkVp6bQ_vJl1m7HN',
  autoSync: true,
  lastSyncAt: null
};
