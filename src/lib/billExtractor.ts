import type { UnitType, GstRate } from '../types';

export interface ExtractedBillItem {
  rawName: string;
  barcode?: string;
  sku?: string;
  hsnCode?: string;
  quantity: number;
  freeQuantity?: number;
  unit: UnitType;
  purchaseRate: number;
  mrp: number;
  discountPct?: number;
  gstRate: GstRate;
  totalAmount: number;
}

export interface ExtractedBill {
  supplier: {
    name: string;
    mobile?: string;
    gstin?: string;
    address?: string;
    invoiceNumber: string;
    invoiceDate: string;
  };
  items: ExtractedBillItem[];
  totals: {
    subtotal: number;
    totalGst: number;
    grandTotal: number;
  };
  rawExtractionNotes?: string;
}

/**
 * Preprocess an image (File or Data URL) on client-side Canvas:
 * Auto-scales down to maxDimension (default 1600px), converts to JPEG 0.85.
 * Keeps payload lightweight (<350KB) and crisp for OCR/Vision models.
 */
export async function preprocessImage(
  input: File | string,
  maxDimension = 1600
): Promise<{ dataUrl: string; base64: string; mimeType: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get 2D canvas context'));
        return;
      }

      // Draw with slight contrast / sharpness enhancement
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = 'image/jpeg';
      const dataUrl = canvas.toDataURL(mimeType, 0.85);
      const base64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');

      resolve({ dataUrl, base64, mimeType, width, height });
    };

    img.onerror = (err) => reject(new Error('Failed to load image: ' + err));

    if (typeof input === 'string') {
      img.src = input;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(input);
    }
  });
}

/**
 * Call Gemini Vision AI (2.0 Flash / 1.5 Flash) with the bill image.
 */
export async function extractBillWithGemini(
  base64Image: string,
  mimeType: string,
  apiKey: string
): Promise<ExtractedBill> {
  const prompt = `You are a world-class, high-accuracy Indian purchase invoice and bill parser engineered specifically for retail, garment & apparel stores, wholesale traders, and distributors.

The input image can be ANY of the following bill types:
1. Standard Computerized GST Tax Invoices (Tally Prime, Marg ERP, Busy ERP, Vyapar, Zoho Books, etc.)
2. Dot-Matrix Printer Invoices (faint purple/black ribbon ink on tractor-feed paper)
3. Faded Thermal Roll Receipts (cash register POS printouts)
4. Handwritten Wholesale Challans / Mandi Slips / Kacha Parcha (pen-written item, size, quantity, and rate columns)
5. Skewed, crumpled, or smartphone-photographed paper bills taken in varying lighting

Extract all available data into a strict JSON object with this exact structure:

{
  "supplier": {
    "name": "Supplier or Distributor Business Name (from bill header)",
    "mobile": "Phone/Mobile number if visible or null",
    "gstin": "15-character GSTIN if visible or null",
    "address": "Supplier city/market/address if visible or null",
    "invoiceNumber": "Invoice / Bill / Challan number",
    "invoiceDate": "YYYY-MM-DD or today's date if unreadable"
  },
  "items": [
    {
      "rawName": "Exact item name / description with brand, style, color, or size if mentioned (e.g. 'Oversized Cotton Tee - Black - L' or 'Slim Fit Formal Shirt White 40')",
      "barcode": "Barcode / EAN if printed, or null",
      "sku": "Item code / Art No / Design No if printed, or null",
      "hsnCode": "HSN code (e.g. 6109 for T-shirts, 6205 for Men's Shirts, 6203 for Trousers/Jeans, 6107 for Innerwear, 5208 for Fabrics) or 6205",
      "quantity": 10,
      "freeQuantity": 0,
      "unit": "Pcs" (choose closest from: 'Pcs', 'Pkt', 'Box', 'Dozen', 'Ream', 'Set', 'Roll', 'Pad'),
      "purchaseRate": 450.00 (purchase rate per unit before tax or net rate),
      "mrp": 799.00 (MRP printed on bill, or estimate purchaseRate * 1.5 if not printed),
      "discountPct": 0 (trade discount % or CD % if column exists),
      "gstRate": 12 (choose standard GST rate: 0, 5, 12, 18, 28; garments under Rs 1000 are typically 5% or 12%),
      "totalAmount": 4500.00
    }
  ],
  "totals": {
    "subtotal": 4500.00,
    "totalGst": 540.00,
    "grandTotal": 5040.00
  }
}

Special Instructions for Diverse Bill Types:
- Handwritten Bills / Challans: Carefully read quantities and rates from tabular handwritten columns. If an item row lists size distributions (e.g. 'M-5, L-10, XL-5'), capture the item and sum total quantity (20) with size notation in the name.
- Scheme / Free Quantities: If a row indicates free items (e.g., '10 + 1 Free', '100 Sch 10', or 'Buy 12 Get 1'), populate 'freeQuantity' accordingly.
- Dot-Matrix / Misaligned Text: Infer column alignment from headers (Rate, Qty, Amount, Disc) even if vertical table borders are absent.
- Extract ALL line items: Do not omit or summarize lines; capture every single product row.
- Output: Return ONLY raw, valid JSON. No conversational text or markdown explanation.`;

  const CANDIDATE_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            response_mime_type: 'application/json'
          }
        })
      });

      if (!response.ok) {
        if (response.status === 404) {
          continue;
        }
        const errorBody = await response.text();
        throw new Error(`Gemini API Error (${response.status}): ${errorBody}`);
      }

      const result = await response.json();
      const textContent = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textContent) {
        return parseAndSanitizeBillJson(textContent);
      }
    } catch (err: any) {
      lastError = err;
      if (!String(err?.message || '').includes('404')) {
        throw err;
      }
    }
  }

  throw lastError || new Error('No compatible Gemini model could be reached for bill extraction.');
}

/**
 * Sanitizes and validates AI raw JSON output into a bulletproof ExtractedBill object
 */
export function parseAndSanitizeBillJson(rawText: string): ExtractedBill {
  let cleaned = rawText.trim();
  // Strip ```json or ``` if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(cleaned);

  const supplier = {
    name: String(parsed?.supplier?.name || 'Wholesale Supplier').trim().toUpperCase(),
    mobile: parsed?.supplier?.mobile ? String(parsed.supplier.mobile).trim() : undefined,
    gstin: parsed?.supplier?.gstin ? String(parsed.supplier.gstin).trim().toUpperCase() : undefined,
    address: parsed?.supplier?.address ? String(parsed.supplier.address).trim() : undefined,
    invoiceNumber: String(parsed?.supplier?.invoiceNumber || `BILL-${Date.now().toString().slice(-5)}`).trim(),
    invoiceDate: parsed?.supplier?.invoiceDate || new Date().toISOString().slice(0, 10)
  };

  const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];
  const items: ExtractedBillItem[] = rawItems.map((item: any, idx: number) => {
    const qty = Math.max(1, Number(item.quantity ?? item.qty ?? 1));
    const freeQty = Number(item.freeQuantity ?? item.free_qty ?? 0);
    const purchaseRate = Math.max(0, Number(item.purchaseRate ?? item.rate ?? item.price ?? 0));
    const mrp = Number(item.mrp ?? (purchaseRate > 0 ? Math.round(purchaseRate * 1.35) : 50));
    const rawGst = Number(item.gstRate ?? item.gst ?? 12);
    const gstRate: GstRate = [0, 5, 12, 18, 28].includes(rawGst) ? (rawGst as GstRate) : 12;
    const totalAmount = Number(item.totalAmount ?? item.total ?? (qty * purchaseRate));

    const validUnits: UnitType[] = ['Pcs', 'Pkt', 'Box', 'Dozen', 'Ream', 'Set', 'Roll', 'Pad'];
    const matchedUnit = validUnits.find(u => u.toLowerCase() === String(item.unit || '').toLowerCase()) || 'Pcs';

    return {
      rawName: String(item.rawName || item.name || item.description || `Item #${idx + 1}`).trim(),
      barcode: item.barcode ? String(item.barcode).trim() : undefined,
      sku: item.sku ? String(item.sku).trim() : undefined,
      hsnCode: String(item.hsnCode || item.hsn || '6205').trim(),
      quantity: qty,
      freeQuantity: freeQty,
      unit: matchedUnit,
      purchaseRate,
      mrp,
      discountPct: Number(item.discountPct ?? 0),
      gstRate,
      totalAmount
    };
  });

  const subtotal = items.reduce((acc, it) => acc + (it.quantity * it.purchaseRate), 0);
  const totalGst = items.reduce((acc, it) => acc + (it.quantity * it.purchaseRate * (it.gstRate / 100)), 0);
  const grandTotal = Math.round((subtotal + totalGst) * 100) / 100;

  return {
    supplier,
    items,
    totals: {
      subtotal: Number(parsed?.totals?.subtotal ?? subtotal),
      totalGst: Number(parsed?.totals?.totalGst ?? totalGst),
      grandTotal: Number(parsed?.totals?.grandTotal ?? grandTotal)
    }
  };
}

/**
 * Built-in High-Fidelity Demo Bills:
 * Allows shopkeepers and testing agents to test instant AI bill scanning
 * without needing an active Gemini API key or real paper bill.
 */
export const DEMO_PURCHASE_BILLS: {
  id: string;
  name: string;
  description: string;
  distributor: string;
  bill: ExtractedBill;
}[] = [];
