import { supabaseAdmin } from "../lib/supabase/supabase-admin";

async function main() {
  const { data, error } = await supabaseAdmin.from("stores").select("*").limit(5);
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Sample Stores from DB:");
  data?.forEach(s => console.log({
    id: s.id,
    name: s.name,
    full_name: s.full_name,
    credit_payment_day: s.credit_payment_day,
    bank_name: s.bank_name,
    bank_account: s.bank_account,
    phone: s.phone,
    address: s.address,
    tax_id: s.tax_id,
    data: s.data
  }));
}

main().catch(console.error);
