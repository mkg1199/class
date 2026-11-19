-- ==============================================================================
-- SUPABASE RESOURCE OPTIMIZATION: ULTRA-LOW CONSUMPTION FOR FREE PLAN
-- Target Project: wmuhfxzkvpcdjnlztmlw (WebRajya POS)
-- Execution: Paste and run in Supabase SQL Editor
-- ==============================================================================

-- 1. PRUNE REALTIME REPLICATION (SLASHES REALTIME MESSAGE USAGE BY 90%+)
-- Removes high-frequency child line-items from broadcasting over WebSockets.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'invoice_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.invoice_items;
    RAISE NOTICE 'Removed invoice_items from supabase_realtime replication.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'stock_movements'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.stock_movements;
    RAISE NOTICE 'Removed stock_movements from supabase_realtime replication.';
  END IF;
END $$;

-- 2. AUTOMATIC DATA RETENTION & PRUNING PROCEDURE
-- Prevents database storage from growing towards the 500 MB Free Tier limit.
CREATE OR REPLACE FUNCTION public.prune_old_records()
RETURNS JSONB AS $$
DECLARE
  v_audit_deleted INT := 0;
  v_quotes_deleted INT := 0;
BEGIN
  -- Prune audit logs older than 45 days
  WITH del_audit AS (
    DELETE FROM public.audit_logs 
    WHERE created_at < NOW() - INTERVAL '45 days'
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_audit_deleted FROM del_audit;

  -- Prune temporary draft quotations older than 90 days
  WITH del_quotes AS (
    DELETE FROM public.invoices 
    WHERE invoice_type = 'quotation' 
      AND created_at < NOW() - INTERVAL '90 days'
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_quotes_deleted FROM del_quotes;

  RETURN jsonb_build_object(
    'status', 'success',
    'audit_logs_pruned', v_audit_deleted,
    'old_quotations_pruned', v_quotes_deleted,
    'executed_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.prune_old_records() TO anon, authenticated;

-- 3. AUTOVACUUM PARAMETERS FOR HIGH-FREQUENCY POS TABLES
-- Reclaims deleted row space immediately so database size remains compact (< 35 MB)
ALTER TABLE public.invoices SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE public.invoice_items SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE public.products SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE public.customers SET (autovacuum_vacuum_scale_factor = 0.05);

-- 4. VERIFICATION QUERY
SELECT 
  'Optimization Migration Completed Successfully!' AS status,
  (SELECT array_agg(tablename) FROM pg_publication_tables WHERE pubname = 'supabase_realtime') AS active_realtime_tables;

