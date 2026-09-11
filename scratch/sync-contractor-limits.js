const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Load .env.local manually
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  content.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CORPORATE_REGEX = /บริษัท|หจก|บจก|จำกัด|corporation|company/i;

async function syncContractors() {
  console.log("Fetching contractors from Supabase:", supabaseUrl);
  const { data: contractors, error } = await supabase.from("contractors").select("*");

  if (error || !contractors) {
    console.error("Error fetching contractors:", error);
    return;
  }

  console.log(`Found ${contractors.length} contractors. Auto-detecting and updating limits...`);

  let updatedCount = 0;
  let corpCount = 0;
  let indCount = 0;

  for (const c of contractors) {
    const fullName = String(c.full_name || "");
    const nickname = String(c.nickname || "");
    const isCorp = CORPORATE_REGEX.test(fullName + " " + nickname);

    const type = isCorp ? "นิติบุคคล" : "บุคคลธรรมดา";
    let newLimit = isCorp ? 2000000 : 1200000;

    // If already has higher limit (e.g. 2M-5M for corp), preserve it
    if (isCorp && Number(c.annual_limit) >= 2000000) {
      newLimit = Number(c.annual_limit);
    }

    if (isCorp) corpCount++;
    else indCount++;

    const currentData = (typeof c.data === "object" && c.data) ? c.data : {};
    const updatedData = {
      ...currentData,
      "ประเภท": type,
      "contractor_type": type,
      "จำกัดยอด/ปี": String(newLimit)
    };

    const { error: updateErr } = await supabase
      .from("contractors")
      .update({
        annual_limit: newLimit,
        data: updatedData
      })
      .eq("id", c.id);

    if (updateErr) {
      console.warn(`Failed to update ${c.id}:`, updateErr.message);
    } else {
      updatedCount++;
    }
  }

  console.log(`\n✅ Finished sync!`);
  console.log(`- Total contractors: ${contractors.length}`);
  console.log(`- Updated: ${updatedCount}`);
  console.log(`- บุคคลธรรมดา (โควตา 1.2M): ${indCount}`);
  console.log(`- นิติบุคคล (โควตา 2M-5M): ${corpCount}`);
}

syncContractors().catch(console.error);
