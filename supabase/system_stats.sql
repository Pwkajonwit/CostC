-- =========================================================================
-- SUPABASE SYSTEM STATS RPC FUNCTION
-- =========================================================================
-- ให้คัดลอกคำสั่งด้านล่างนี้ไปวางและรันที่:
-- Supabase Dashboard -> SQL Editor -> New Query -> Run
--
-- ประโยชน์:
-- 1. เรียกดูขนาดพื้นที่ฐานข้อมูลรวม (PostgreSQL Database Size)
-- 2. เรียกดูจำนวนไฟล์และขนาดพื้นที่จัดเก็บรูปภาพในแต่ละ Storage Bucket
-- 3. ตรวจสอบขนาดของแต่ละตารางในระบบได้แบบ Realtime
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_system_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_catalog
AS $$
DECLARE
  v_db_size bigint;
  v_db_size_pretty text;
  v_storage_stats jsonb;
  v_table_stats jsonb;
BEGIN
  -- 1. ขนาดฐานข้อมูล PostgreSQL รวม
  SELECT pg_database_size(current_database()) INTO v_db_size;
  SELECT pg_size_pretty(v_db_size) INTO v_db_size_pretty;

  -- 2. ข้อมูล Storage Buckets (จำนวนไฟล์ และ ขนาดพื้นที่จัดเก็บรูปภาพ)
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'public', b.public,
      'file_count', coalesce(s.cnt, 0),
      'total_bytes', coalesce(s.bytes, 0),
      'size_pretty', pg_size_pretty(coalesce(s.bytes, 0)::bigint)
    )
  ), '[]'::jsonb)
  INTO v_storage_stats
  FROM storage.buckets b
  LEFT JOIN (
    SELECT 
      bucket_id,
      count(*) as cnt,
      sum((metadata->>'size')::bigint) as bytes
    FROM storage.objects
    GROUP BY bucket_id
  ) s ON b.id = s.bucket_id;

  -- 3. ขนาดของแต่ละตารางและจำนวนแถวข้อมูล
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'table_name', t.table_name,
      'row_count', t.row_count,
      'total_bytes', t.total_bytes,
      'size_pretty', pg_size_pretty(t.total_bytes)
    )
  ), '[]'::jsonb)
  INTO v_table_stats
  FROM (
    SELECT 
      relname AS table_name,
      n_live_tup AS row_count,
      pg_total_relation_size(relid) AS total_bytes
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY total_bytes DESC
  ) t;

  RETURN jsonb_build_object(
    'db_size_bytes', v_db_size,
    'db_size_pretty', v_db_size_pretty,
    'storage', v_storage_stats,
    'tables', v_table_stats,
    'updated_at', now()
  );
END;
$$;

-- ให้สิทธิ์การเรียกใช้งาน
GRANT EXECUTE ON FUNCTION public.get_system_stats() TO authenticated, anon, service_role;
