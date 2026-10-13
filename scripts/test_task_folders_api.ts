import fs from "fs";

try {
  const envContent = fs.readFileSync(".env.local", "utf8");
  envContent.split("\n").forEach((line) => {
    const idx = line.indexOf("=");
    if (idx > 0) {
      const k = line.substring(0, idx).trim();
      let v = line.substring(idx + 1).trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      process.env[k] = v;
    }
  });
} catch (e) {
  console.error("Failed to read .env.local", e);
}

async function run() {
  const { GET } = await import("../app/api/task-folders/route");
  const { NextRequest } = await import("next/server");

  const req = new NextRequest("http://localhost:3000/api/task-folders");
  const res = await GET(req);
  const data = await res.json();

  console.log("=== API Response Stats ===");
  console.log(data.stats);

  console.log("\n=== Contractors in Tree ===");
  console.log(Object.keys(data.tree));

  console.log("\n=== Details for Contractor 'ต้อม' ===");
  const tom = data.tree["ต้อม"];
  if (tom) {
    console.log("Projects:", Object.keys(tom.projects));
    Object.entries(tom.projects).forEach(([pName, pNode]: [string, any]) => {
      console.log(`  Project [${pName}] -> Months:`, Object.keys(pNode.months));
      Object.entries(pNode.months).forEach(([mName, mNode]: [string, any]) => {
        console.log(`    Month [${mName}] -> Tasks:`, mNode.tasks.map((t: any) => ({
          title: t.displayTitle,
          status: t.status,
          files: t.files.length
        })));
      });
    });
  }

  console.log("\n=== Total Flat Files Count ===", data.flatFiles.length);
  if (data.flatFiles.length > 0) {
    console.log("Sample file:", data.flatFiles[0]);
  }
}

run();
