import { supabaseAdmin } from "../lib/supabase/supabase-admin";

async function main() {
  console.log("Listing files in repairs bucket...");
  let offset = 0;
  const limit = 100;
  let totalFiles = 0;
  let totalBytes = 0;

  while (true) {
    const { data: files, error } = await supabaseAdmin.storage.from("repairs").list("", {
      limit,
      offset,
      sortBy: { column: "created_at", order: "desc" }
    });

    if (error || !files || files.length === 0) break;
    totalFiles += files.length;
    for (const f of files) {
      if (f.metadata?.size) {
        totalBytes += Number(f.metadata.size);
      }
    }
    if (files.length < limit) break;
    offset += limit;
  }

  console.log(`Repairs bucket summary: ${totalFiles} files, ${(totalBytes / 1024 / 1024).toFixed(2)} MB (${totalBytes} bytes)`);
}

main().catch(console.error);
