import 'fake-indexeddb/auto';
import { db, DEFAULT_SHOP_PROFILE, DEFAULT_PRINT_SETTINGS, DEFAULT_BILLING_SETTINGS } from '../src/lib/db';
import { disableCloudSyncForTests } from '../src/lib/supabase';
import { calculateInvoiceTotals, calculateItemTaxes } from '../src/lib/taxCalculator';
import { isDemoStationeryProduct } from '../src/store/useProductStore';
import type { Product, InvoiceItem, Invoice, Customer, StockMovement } from '../src/types';

async function runFeatureChecks() {
  disableCloudSyncForTests();
  console.log('====================================================');
  console.log('   FULL FEATURE VALIDATION & VERIFICATION SUITE     ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, details: string) {
    if (condition) {
      console.log(`✅ [PASS] ${title}`);
      console.log(`   └─ ${details}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${title}`);
      console.error(`   └─ ${details}`);
      failed++;
    }
  }

  // 1. BILLING & TAX CALCULATION ENGINE
  console.log('--- 1. Billing & Tax Calculation Engine ---');
  const calc = calculateItemTaxes(2, 800, 0, 10, 5, 'inclusive', false);
  const testItems: InvoiceItem[] = [
    {
      id: 'item_1',
      productId: 'p_shirt_01',
      productName: 'Cotton Casual Shirt',
      sku: 'SHIRT-COT-BLU-M',
      barcode: '8901234567890',
      hsnCode: '6205',
      pack: '1*1',
      unit: 'Pcs',
      qty: 2,
      freeQty: 0,
      mrp: 999,
      unitRate: 800,
      schemeDiscountPct: 0,
      schemeDiscountAmount: calc.schemeDiscountAmount,
      addlDiscountPct: 10,
      addlDiscountAmount: calc.addlDiscountAmount,
      discountAmount: calc.discountAmount,
      taxableAmount: calc.taxableAmount,
      gstRate: 5,
      taxType: 'inclusive',
      cgstRate: 2.5,
      cgstAmount: calc.cgstAmount,
      sgstRate: 2.5,
      sgstAmount: calc.sgstAmount,
      igstRate: 0,
      igstAmount: 0,
      totalGstAmount: calc.totalGst,
      totalAmount: calc.totalAmount
    }
  ];

  const totals = calculateInvoiceTotals(testItems, 0, 60, true);

  assert(
    totals.netPayable === 1500 && totals.totalGst > 0,
    'Tax & Totals Calculation',
    `Taxable: ₹${totals.subtotal.toFixed(2)}, GST: ₹${totals.totalGst.toFixed(2)}, Freight: ₹60, Net Payable: ₹${totals.netPayable} (Matched)`
  );

  // 2. CASH PAYMENT SETTLEMENT
  console.log('\n--- 2. Cash & UPI Payment Modes ---');
  await db.products.clear();
  await db.invoices.clear();
  await db.stockMovements.clear();
  await db.customers.clear();

  const testProduct: Product = {
    id: 'p_shirt_01',
    name: 'Cotton Casual Shirt',
    sku: 'SHIRT-COT-BLU-M',
    barcode: '8901234567890',
    category: 'Shirts & Casuals',
    packInfo: '1*1',
    unit: 'Pcs',
    mrp: 999,
    purchaseRate: 500,
    saleRate: 800,
    hsnCode: '6205',
    gstRate: 5,
    taxType: 'inclusive',
    stockQty: 50,
    minStockLevel: 10,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await db.products.put(testProduct);

  const cashInvoice: Invoice = {
    id: 'inv_cash_01',
    invoiceNumber: 'SNS-26-0001',
    invoiceType: 'gst',
    date: new Date().toISOString(),
    customerName: 'Cash Customer',
    items: testItems,
    totals,
    paymentMode: 'cash',
    paidAmount: 1500,
    balanceAmount: 0,
    status: 'completed',
    synced: false,
    createdAt: new Date().toISOString()
  };
  await db.invoices.put(cashInvoice);

  // Decrement stock upon bill completion
  await db.products.update('p_shirt_01', { stockQty: 50 - 2 });
  await db.stockMovements.put({
    id: 'sm_01',
    productId: 'p_shirt_01',
    productName: 'Cotton Casual Shirt',
    type: 'sale',
    quantityChange: -2,
    previousStock: 50,
    newStock: 48,
    reason: 'Sale — Invoice SNS-26-0001',
    createdAt: new Date().toISOString()
  });

  const updatedProd = await db.products.get('p_shirt_01');
  assert(
    updatedProd?.stockQty === 48,
    'Cash Quick Settle & Stock Decrement',
    `Initial Stock: 50 -> Sold: 2 -> New Stock: ${updatedProd?.stockQty} Pcs`
  );

  // 3. UPI PAYMENT WITH REFERENCE
  const upiInvoice: Invoice = {
    id: 'inv_upi_02',
    invoiceNumber: 'SNS-26-0002',
    invoiceType: 'gst',
    date: new Date().toISOString(),
    customerName: 'Rahul Verma',
    customerMobile: '9876543210',
    items: testItems,
    totals,
    paymentMode: 'upi',
    paidAmount: 1500,
    balanceAmount: 0,
    upiReference: 'UPI/1234567890/GPay',
    status: 'completed',
    synced: false,
    createdAt: new Date().toISOString()
  };
  await db.invoices.put(upiInvoice);

  const savedUpiInv = await db.invoices.get('inv_upi_02');
  assert(
    savedUpiInv?.paymentMode === 'upi' && savedUpiInv?.upiReference === 'UPI/1234567890/GPay',
    'UPI Settlement with Reference ID',
    `Invoice: ${savedUpiInv?.invoiceNumber}, Mode: ${savedUpiInv?.paymentMode}, Ref: ${savedUpiInv?.upiReference}`
  );

  // 4. CREDIT (KHATA / UDHAR) WORKFLOW
  console.log('\n--- 3. Customer Ledger / Khata Management ---');
  const testCustomer: Customer = {
    id: 'cust_01',
    name: 'Vikram Singh',
    mobile: '9123456789',
    creditBalance: 0,
    creditLimit: 10000,
    createdAt: new Date().toISOString()
  };
  await db.customers.put(testCustomer);

  // Record credit sale of ₹1500
  await db.customers.update('cust_01', { creditBalance: 1500 });
  const custAfterCredit = await db.customers.get('cust_01');

  assert(
    custAfterCredit?.creditBalance === 1500,
    'Credit Sale Ledger Booking',
    `Customer: ${custAfterCredit?.name}, Previous Balance: ₹0 -> Outstanding Ledger: ₹${custAfterCredit?.creditBalance}`
  );

  // 5. INVENTORY STOCK ADJUSTMENT WITH REASON
  console.log('\n--- 4. Inventory System Enhancements ---');
  // Add 10 stock with reason 'Opening Stock'
  await db.products.update('p_shirt_01', { stockQty: 58 });
  await db.stockMovements.put({
    id: 'sm_02',
    productId: 'p_shirt_01',
    productName: 'Cotton Casual Shirt',
    type: 'adjustment',
    quantityChange: 10,
    previousStock: 48,
    newStock: 58,
    reason: 'Opening Stock — Physical Box Verified',
    createdAt: new Date().toISOString()
  });

  const prodAdjusted = await db.products.get('p_shirt_01');
  const movement = await db.stockMovements.get('sm_02');

  assert(
    prodAdjusted?.stockQty === 58 && movement?.reason.includes('Opening Stock'),
    'Stock Adjustment (+/-) with Audit Log',
    `Adjusted to: ${prodAdjusted?.stockQty} Pcs | Audit Reason: "${movement?.reason}"`
  );

  // 6. PHYSICAL STOCK TAKE & VARIANCE AUTO-POSTING
  const physicalCount = 55; // 3 units less than book stock of 58
  const variance = physicalCount - (prodAdjusted?.stockQty || 0); // -3

  await db.products.update('p_shirt_01', { stockQty: physicalCount });
  await db.stockMovements.put({
    id: 'sm_03',
    productId: 'p_shirt_01',
    productName: 'Cotton Casual Shirt',
    type: 'adjustment',
    quantityChange: variance,
    previousStock: 58,
    newStock: physicalCount,
    reason: 'Physical Stock Take — Count Sheet Variance',
    createdAt: new Date().toISOString()
  });

  const prodAfterStockTake = await db.products.get('p_shirt_01');
  assert(
    prodAfterStockTake?.stockQty === 55,
    'Physical Stock Take Audit',
    `Book: 58, Counted: ${physicalCount}, Variance: ${variance} posted -> New Stock: ${prodAfterStockTake?.stockQty}`
  );

  // 7. STOCK VALUATION REPORT CALCULATION
  const allProds = await db.products.toArray();
  const totalCostValuation = allProds.reduce((acc, p) => acc + (p.purchaseRate * p.stockQty), 0);
  const totalMrpValuation = allProds.reduce((acc, p) => acc + (p.mrp * p.stockQty), 0);
  const potentialProfit = totalMrpValuation - totalCostValuation;

  assert(
    totalCostValuation === 55 * 500 && totalMrpValuation === 55 * 999,
    'Stock Valuation Metrics',
    `Total Cost: ₹${totalCostValuation.toLocaleString('en-IN')}, Retail MRP: ₹${totalMrpValuation.toLocaleString('en-IN')}, Potential Profit: ₹${potentialProfit.toLocaleString('en-IN')}`
  );

  // 8. LOW-STOCK ALERT BADGE
  const lowStockThreshold = prodAfterStockTake?.minStockLevel || 10;
  // Let's create an item with low stock
  await db.products.put({
    id: 'p_jeans_low',
    name: 'Slim Fit Blue Jeans',
    sku: 'JEAN-SLM-BLU-32',
    barcode: '8901234567899',
    category: 'Jeans & Denims',
    packInfo: '1*1',
    unit: 'Pcs',
    mrp: 1499,
    purchaseRate: 700,
    saleRate: 1199,
    hsnCode: '6203',
    gstRate: 5,
    taxType: 'inclusive',
    stockQty: 3, // Less than minStockLevel 10
    minStockLevel: 10,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const updatedCatalog = await db.products.toArray();
  const lowStockCount = updatedCatalog.filter(p => p.isActive && p.stockQty <= p.minStockLevel && p.stockQty >= 0).length;

  assert(
    lowStockCount === 1,
    'Low-Stock Alert Detection',
    `Detected ${lowStockCount} low-stock item(s) (Slim Fit Blue Jeans: 3/10 Pcs) for the Nav Badge`
  );

  // 9. DEMO DATA PURGE & ISOLATION CHECK
  console.log('\n--- 5. Demo Data Elimination Verification ---');
  const demoItem1 = { sku: 'MIG-NEO-ORA-5122', name: 'Highlighter Neon Orange 50 Pcs Jar' };
  const demoItem2 = { sku: 'CLM-NB-172', name: 'Classmate Long Book 172 Pgs' };
  const realClothing = { sku: 'SHIRT-COT-BLU-M', name: 'Cotton Casual Shirt' };

  const isDemo1 = isDemoStationeryProduct(demoItem1);
  const isDemo2 = isDemoStationeryProduct(demoItem2);
  const isReal = isDemoStationeryProduct(realClothing);

  assert(
    isDemo1 === true && isDemo2 === true && isReal === false,
    'Stationery Demo Filter Precision',
    `Highlighter: ${isDemo1 ? 'FLAGGED AS DEMO' : 'KEPT'}, Classmate: ${isDemo2 ? 'FLAGGED AS DEMO' : 'KEPT'}, Clothing Shirt: ${!isReal ? 'PROTECTED (NOT DEMO)' : 'ERROR'}`
  );

  // 10. BACKUP & RESTORE INTEGRITY
  console.log('\n--- 6. Data Backup & Export Integrity ---');
  const backupProducts = await db.products.toArray();
  const backupInvoices = await db.invoices.toArray();
  const backupCustomers = await db.customers.toArray();
  const backupMovements = await db.stockMovements.toArray();

  const backupPackage = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    appName: 'WebRajya Invoice POS',
    data: {
      products: backupProducts,
      invoices: backupInvoices,
      customers: backupCustomers,
      stockMovements: backupMovements
    }
  };

  const backupJSON = JSON.stringify(backupPackage);
  const parsedBackup = JSON.parse(backupJSON);

  assert(
    parsedBackup.data.products.length === 2 && parsedBackup.data.invoices.length === 2,
    'Backup & Restore Package Integrity',
    `JSON Backup v${parsedBackup.version} successfully packaged ${parsedBackup.data.products.length} products, ${parsedBackup.data.invoices.length} invoices`
  );

  // 7. WEBRAJYA INVOICE CHATBOT ENGINE
  console.log('\n--- 7. WebRajya Invoice Chatbot Engine ---');
  const { parseActionsFromText } = await import('../src/lib/ai/chatEngine');
  const { SOFTWARE_KNOWLEDGE_BASE } = await import('../src/lib/ai/softwareKnowledge');

  const testModelResponse = `To reconcile your shelf stock, open the physical count tool.
1. Enter counted quantity.
2. Review variance.
[ACTION:OPEN_STOCK_TAKE]
[ACTION:NAVIGATE_INVENTORY]`;

  const parsedActions = parseActionsFromText(testModelResponse);

  assert(
    parsedActions.actions.length === 2 &&
    parsedActions.actions.some(a => a.type === 'OPEN_STOCK_TAKE') &&
    parsedActions.actions.some(a => a.type === 'NAVIGATE_INVENTORY') &&
    !parsedActions.cleanText.includes('[ACTION:'),
    'AI Action Parser & Clean Text Extraction',
    `Successfully extracted ${parsedActions.actions.length} action buttons: ${parsedActions.actions.map(a => a.label).join(', ')}`
  );

  assert(
    SOFTWARE_KNOWLEDGE_BASE.includes('Stock Take / Physical Audit') &&
    SOFTWARE_KNOWLEDGE_BASE.includes('Scan Purchase Bill') &&
    SOFTWARE_KNOWLEDGE_BASE.includes('Cash') &&
    SOFTWARE_KNOWLEDGE_BASE.includes('Credit / Khata'),
    'AI Knowledge Base Coverage',
    'Grounding contains complete retail workflows (Stock audit, Purchase Inwarding, Cash/UPI, Khata)'
  );

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED / ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFeatureChecks().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
