import { getRows } from "@/lib/db";
import { TABLES } from "@/lib/config";

async function inspectProject3() {
  const projects = await getRows(TABLES.PROJECT, 100_000);
  const p3 = projects.find(p => String(p["ID Project"] || p.id) === "3");
  console.log("Project 3 Raw Row:", JSON.stringify(p3, null, 2));
}

inspectProject3().catch(console.error);
