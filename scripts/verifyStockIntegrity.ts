import 'fake-indexeddb/auto';
import { db } from '../src/lib/db';
import { useProductStore } from '../src/store/useProductStore';
import { useSalesStore } from '../src/store/useSalesStore';
import { auditAndReconcileAllStock } from '../src/lib/stockAuditEngine';
import { disableCloudSyncForTests } from '../src/lib/supabase';
import type { Product, Invoice } from '../src/types';

disableCloudSyncForTests();

async function runStockIntegritySuite() {
  console.log('\n====================================================');
  console.log('   PERMANENT STOCK INTEGRITY & RECONCILIATION SUITE  ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      console.log(`   └─ ${detail}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      console.error(`   └─ ${detail}`);
      failed++;
    }
  }

  // 1. Setup Test Product
  const testProduct: Product = {
    id: 'prod_test_carabin_99',
    sku: 'CRY-CAR-TEST-99',
    barcode: '8901234567890',
    name: 'CRYSTOL CARABIAN 22x2 TEST',
    category: 'Office Supplies',
    packInfo: '1 Pcs',
    unit: 'Pcs',
    mrp: 87,
    purchaseRate: 58,
    saleRate: 87,
    hsnCode: '54071011',
    gstRate: 5,
    taxType: 'inclusive',
    stockQty: 44, // 44 inwarded
    minStockLevel: 10,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    synced: true
  };

  await db.products.put(testProduct);
  // Add initial inward movement
  await db.stockMovements.put({
    id: 'sm_test_inward_44',
    productId: testProduct.id,
    productName: testProduct.name,
    type: 'purchase',
    quantityChange: 44,
    previousStock: 0,
    newStock: 44,
    reason: 'Purchase Inward: Bill #PO-TEST',
    createdAt: new Date().toISOString(),
    referenceId: 'po_test'
  });

  await useProductStore.getState().loadProducts(true);

  const initialProd = useProductStore.getState().products.find(p => p.id === testProduct.id);
  assert(
    initialProd?.stockQty === 44,
    'Initial Stock Inward Synchronization',
    `Product inwarded with 44 Pcs. In-Memory: ${initialProd?.stockQty} Pcs, Dexie: 44 Pcs`
  );

  // 2. Simulate Invoice Sale of all 44 Pcs (Transition to 0 Pcs Out of Stock)
  const saleInvoice = await useSalesStore.getState().createCompletedInvoice({
    invoiceType: 'gst',
    customerName: 'Cash Customer',
    items: [
      {
        id: 'item_test_1',
        productId: testProduct.id,
        productName: testProduct.name,
        sku: testProduct.sku,
        pack: '1 Pcs',
        unit: 'Pcs',
        qty: 44, // Sell all 44
        unitRate: 87,
        mrp: 87,
        gstRate: 5,
        hsnCode: '54071011',
        totalAmount: 3828
      }
    ],
    subtotal: 3645.71,
    totalDiscount: 0,
    totalGst: 182.29,
    cgstTotal: 91.14,
    sgstTotal: 91.15,
    igstTotal: 0,
    freightAmount: 0,
    roundOff: 0,
    netPayable: 3828,
    paidAmount: 3828,
    balanceAmount: 0,
    paymentMode: 'cash',
    paymentStatus: 'paid',
    isInterstate: false
  });

  const postSaleInMemory = useProductStore.getState().products.find(p => p.id === testProduct.id);
  const postSaleDexie = await db.products.get(testProduct.id);

  assert(
    postSaleInMemory?.stockQty === 0 && postSaleDexie?.stockQty === 0,
    'Zero-Stock Sale Instant In-Memory & Dexie Decrement',
    `Sold 44/44 units. In-Memory: ${postSaleInMemory?.stockQty} Pcs, Dexie: ${postSaleDexie?.stockQty} Pcs (Both exactly 0 Pcs)`
  );

  // 3. Verify Stock Movement Log for the sale
  const saleMovements = await db.stockMovements.where('productId').equals(testProduct.id).toArray();
  const saleDeductMovement = saleMovements.find(m => m.type === 'sale');
  assert(
    saleDeductMovement?.quantityChange === -44 && saleDeductMovement?.newStock === 0,
    'Stock Movement Log Accuracy',
    `Sale movement logged: ${saleDeductMovement?.quantityChange} Pcs, New Stock: ${saleDeductMovement?.newStock} Pcs`
  );

  // 4. Test Stock Reconciliation Engine
  // Deliberately induce an artificial drift to test the self-healing engine
  await db.products.update(testProduct.id, { stockQty: 999 }); // Corrupted stock
  const preAuditProd = await db.products.get(testProduct.id);
  assert(preAuditProd?.stockQty === 999, 'Simulation of Stock Drift', `Artificially set stock to ${preAuditProd?.stockQty}`);

  const auditResult = await auditAndReconcileAllStock();
  const healedProd = await db.products.get(testProduct.id);
  const healedInMemory = useProductStore.getState().products.find(p => p.id === testProduct.id);

  assert(
    auditResult.mismatchesFound >= 1 && healedProd?.stockQty === 0 && healedInMemory?.stockQty === 0,
    'Self-Healing Audit Engine Auto-Reconciliation',
    `Detected drift and restored accurate calculated stock: ${healedProd?.stockQty} Pcs (Movements: +44 inward, -44 sale = 0)`
  );

  // 5. Test Invoice Cancellation & Stock Restoration
  await useSalesStore.getState().cancelInvoice(saleInvoice.id, true, 'Customer Cancellation');

  const restoredInMemory = useProductStore.getState().products.find(p => p.id === testProduct.id);
  const restoredDexie = await db.products.get(testProduct.id);

  assert(
    restoredInMemory?.stockQty === 44 && restoredDexie?.stockQty === 44,
    'Invoice Cancellation Full Stock Restoration',
    `Cancelled invoice: In-Memory restored to ${restoredInMemory?.stockQty} Pcs, Dexie restored to ${restoredDexie?.stockQty} Pcs`
  );

  // Cleanup test artifacts
  await db.products.delete(testProduct.id);
  await db.stockMovements.where('productId').equals(testProduct.id).delete();
  await db.invoices.delete(saleInvoice.id);

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED / ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStockIntegritySuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

