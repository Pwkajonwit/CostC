-- =========================================================================
-- SUPABASE CRON NOTIFICATIONS (ซิงค์เวลาแจ้งเตือนจากหน้าเว็บอัตโนมัติ)
-- =========================================================================
-- ให้คัดลอกคำสั่งด้านล่างนี้ไปวางและรันที่:
-- Supabase Dashboard -> SQL Editor -> New Query -> Run
--
-- จุดเด่น:
-- 1. ทำงานตรงเวลาเป๊ะ (ไม่ดีเลย์ ไม่มี auto-retry ส่งซ้ำเหมือน Vercel)
-- 2. ดึงเวลาช่วงเช้า/เย็น จากหน้าเว็บ (system_options.line_config) โดยอัตโนมัติ
-- 3. เมื่อผู้ใช้เปลี่ยนเวลาในหน้าเว็บและกดบันทึก ระบบจะ re-schedule pg_cron ให้อัตโนมัติทันที
-- =========================================================================

-- 1. เปิด Extensions ที่จำเป็น
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. ฟังก์ชันซิงค์เวลาแจ้งเตือนจากหน้าเว็บ (line_config) ไปยัง pg_cron
CREATE OR REPLACE FUNCTION public.sync_cron_schedules()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config jsonb;
  v_morning text;
  v_evening text;
  v_m_parts text[];
  v_e_parts text[];
  v_m_hour int;
  v_m_min int;
  v_e_hour int;
  v_e_min int;
  v_m_utc_hour int;
  v_e_utc_hour int;
  v_m_cron text;
  v_e_cron text;
BEGIN
  -- ดึงค่าเวลาที่ตั้งไว้ในหน้าเว็บจาก system_options
  SELECT data INTO v_config FROM public.system_options WHERE id = 'line_config';
  
  v_morning := COALESCE(v_config->>'CRON_TIME_MORNING', '07:30');
  v_evening := COALESCE(v_config->>'CRON_TIME_EVENING', '17:00');

  -- แปลงเวลาเช้า (HH:mm เวลาไทย UTC+7) เป็นเวลา UTC สำหรับ pg_cron
  v_m_parts := string_to_array(trim(v_morning), ':');
  v_m_hour := COALESCE(NULLIF(v_m_parts[1], '')::int, 7);
  v_m_min := COALESCE(NULLIF(v_m_parts[2], '')::int, 30);
  v_m_utc_hour := (v_m_hour - 7 + 24) % 24;
  v_m_cron := v_m_min::text || ' ' || v_m_utc_hour::text || ' * * *';

  -- แปลงเวลาเย็น (HH:mm เวลาไทย UTC+7) เป็นเวลา UTC สำหรับ pg_cron
  v_e_parts := string_to_array(trim(v_evening), ':');
  v_e_hour := COALESCE(NULLIF(v_e_parts[1], '')::int, 17);
  v_e_min := COALESCE(NULLIF(v_e_parts[2], '')::int, 0);
  v_e_utc_hour := (v_e_hour - 7 + 24) % 24;
  v_e_cron := v_e_min::text || ' ' || v_e_utc_hour::text || ' * * *';

  -- ลบ Schedule เดิมถ้ามี
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-morning-tasks') THEN
    PERFORM cron.unschedule('daily-morning-tasks');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-evening-summary') THEN
    PERFORM cron.unschedule('daily-evening-summary');
  END IF;

  -- ตั้ง Schedule เช้าตามเวลาที่ตั้งในหน้าเว็บ
  PERFORM cron.schedule(
    'daily-morning-tasks',
    v_m_cron,
    'SELECT net.http_get(url:=''https://cost-c.vercel.app/api/cron/daily-tasks'');'
  );

  -- ตั้ง Schedule เย็นตามเวลาที่ตั้งในหน้าเว็บ
  PERFORM cron.schedule(
    'daily-evening-summary',
    v_e_cron,
    'SELECT net.http_get(url:=''https://cost-c.vercel.app/api/cron/daily-summary'');'
  );

  RETURN jsonb_build_object(
    'success', true,
    'morning_th', v_morning,
    'evening_th', v_evening,
    'morning_cron_utc', v_m_cron,
    'evening_cron_utc', v_e_cron
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_cron_schedules() TO postgres, anon, authenticated, service_role;

-- 3. สร้าง Trigger อัตโนมัติ: เมื่อมีการกดบันทึกเวลาจากหน้าเว็บ ให้ sync_cron_schedules ทำงานทันที
CREATE OR REPLACE FUNCTION public.trigger_sync_line_cron()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.sync_cron_schedules();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_line_cron ON public.system_options;
CREATE TRIGGER trg_sync_line_cron
AFTER INSERT OR UPDATE ON public.system_options
FOR EACH ROW
WHEN (NEW.id = 'line_config')
EXECUTE FUNCTION public.trigger_sync_line_cron();

-- 4. รันครั้งแรกทันทีเพื่อซิงค์เวลาปัจจุบัน
SELECT public.sync_cron_schedules();

-- =========================================================================
-- ตรวจสอบงานที่ตั้งไว้:
-- SELECT jobid, jobname, schedule, active FROM cron.job;
-- =========================================================================
