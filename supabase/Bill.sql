-- ==========================================================
-- 1. สร้างตาราง petty_cash (เปิดเงินสดย่อย) แบบ Relational 100%
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.petty_cash (
  id TEXT PRIMARY KEY,                                      -- id_petty_cash (เช่น PC101 หรือตัวเลข)
  id_petty_cash TEXT,                                       -- รหัสเปิดเงินสดย่อย
  requester TEXT,                                           -- ผู้เบิก
  project_id TEXT,                                          -- ID Project
  project_name TEXT,                                        -- ชื่อ Project
  amount NUMERIC DEFAULT 0,                                 -- จำนวนเงิน
  purpose TEXT,                                             -- วัตถุประสงค์ / รายละเอียด
  date DATE,                                                -- วันที่เบิก
  due_date DATE,                                            -- กำหนดเคลียร์
  status TEXT DEFAULT 'รออนุมัติ',                           -- สถานะ
  bank_account TEXT,                                        -- เลขบัญชี
  bank_name TEXT,                                           -- ธนาคาร
  cleared_amount NUMERIC DEFAULT 0,                         -- ยอดเคลียร์แล้ว
  remaining_amount NUMERIC DEFAULT 0,                       -- ยอดคงเหลือ
  image_url TEXT,                                           -- รูปสลิป / เอกสารแนบ
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- เปิดใช้งานความปลอดภัย RLS
ALTER TABLE public.petty_cash ENABLE ROW LEVEL SECURITY;

-- กำหนดนโยบายความปลอดภัย (Idempotent: ป้องกัน Error หากรันซ้ำ)
DROP POLICY IF EXISTS "Allow all access to petty_cash" ON public.petty_cash;
DROP POLICY IF EXISTS "Allow all authenticated users access to petty_cash" ON public.petty_cash;

CREATE POLICY "Allow all access to petty_cash"
ON public.petty_cash
FOR ALL
USING (true)
WITH CHECK (true);

-- ==========================================================
-- 2. สร้างฟังก์ชันล็อกเลขบิล ป้องกันเลขบิลชนกัน (Advisory Lock)
-- ==========================================================
CREATE OR REPLACE FUNCTION public.get_atomic_next_bill_sequence(p_custom_start integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start integer := GREATEST(1, COALESCE(p_custom_start, 1));
  v_next integer;
BEGIN
  -- ล็อกระดับ Transaction ป้องกันการแย่งเลขลำดับพร้อมกัน
  PERFORM pg_advisory_xact_lock(74839201);

  IF NOT EXISTS (SELECT 1 FROM public.bills WHERE id = v_start) THEN
    RETURN v_start;
  END IF;

  SELECT COALESCE(
    (
      SELECT b1.id + 1
      FROM public.bills b1
      WHERE b1.id >= v_start
        AND NOT EXISTS (
          SELECT 1 FROM public.bills b2 WHERE b2.id = b1.id + 1
        )
      ORDER BY b1.id
      LIMIT 1
    ),
    v_start + 1
  ) INTO v_next;

  RETURN v_next;
END;
$$;

-- ==========================================================
-- 3. ซิงค์ประเภทบิลย้อนหลังให้ bill_type ตรงกับ bill_no เพื่อความถูกต้อง 100%
-- ==========================================================
UPDATE public.bills 
SET bill_type = bill_no 
WHERE bill_no IN ('หลัก', 'ย่อย') 
  AND (bill_type IS NULL OR bill_type != bill_no);

