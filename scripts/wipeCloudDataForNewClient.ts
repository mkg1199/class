import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qgkbkkodosgcvqvaouxf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5wp7W3kttM0chFtGkVp6bQ_vJl1m7HN';

async function wipeCloudData() {
  console.log('Connecting to Supabase project...');
  const client = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('Wiping old demo/test rows from Supabase (Preserving API keys, settings & categories)...');

  try {
    const { error: smErr } = await client.from('stock_movements').delete().neq('id', 'keep_none');
    console.log('Stock movements wiped:', smErr ? smErr.message : 'SUCCESS');

    const { error: iiErr } = await client.from('invoice_items').delete().neq('id', 'keep_none');
    console.log('Invoice items wiped:', iiErr ? iiErr.message : 'SUCCESS');

    const { error: invErr } = await client.from('invoices').delete().neq('id', 'keep_none');
    console.log('Invoices wiped:', invErr ? invErr.message : 'SUCCESS');

    const { error: piiErr } = await client.from('purchase_invoice_items').delete().neq('id', 'keep_none');
    console.log('Purchase items wiped:', piiErr ? piiErr.message : 'SUCCESS');

    const { error: piErr } = await client.from('purchase_invoices').delete().neq('id', 'keep_none');
    console.log('Purchase invoices wiped:', piErr ? piErr.message : 'SUCCESS');

    const { error: prodErr } = await client.from('products').delete().neq('id', 'keep_none');
    console.log('Products wiped:', prodErr ? prodErr.message : 'SUCCESS');

    const { error: supErr } = await client.from('suppliers').delete().neq('id', 'keep_none');
    console.log('Suppliers wiped:', supErr ? supErr.message : 'SUCCESS');

    const { error: custErr } = await client.from('customers').delete().neq('id', 'cust_default_cash');
    console.log('Non-default customers wiped:', custErr ? custErr.message : 'SUCCESS');

    console.log('\n✅ Supabase Cloud is now 100% clean and ready for Sukhya Mart!');
  } catch (err: any) {
    console.error('Error during wipe:', err.message);
  }
}

wipeCloudData();

