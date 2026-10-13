import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { cached } from "@/lib/utils/cache";

export interface TaskCategoryOption {
  id: number;
  key: string;
  name: string;
  label: string;
  fullLabel: string;
  basePoints?: number;
  description?: string;
  color?: string;
  keywords?: string[];
}

export const DEFAULT_TASK_CATEGORIES: TaskCategoryOption[] = [
  {
    id: 1,
    key: "type_1",
    name: "1. เอกสาร",
    label: "เอกสาร",
    fullLabel: "1 (เอกสาร)",
    basePoints: 1,
    description: "งานเอกสาร, สัญญา, รายงานประจำวัน, ใบสำคัญ",
    color: "blue",
    keywords: ["เอกสาร", "สัญญา", "ใบสำคัญ", "รายงาน"]
  },
  {
    id: 2,
    key: "type_2",
    name: "2. แผนงาน",
    label: "แผนงาน",
    fullLabel: "2 (แผนงาน)",
    basePoints: 0.3,
    description: "งานแผนงาน, ตารางเวลาดำเนินงาน, แผนก่อสร้าง",
    color: "emerald",
    keywords: ["แผนงาน", "ตารางเวลา", "แผน", "plan"]
  },
  {
    id: 3,
    key: "type_3",
    name: "3. PJSA",
    label: "PJSA",
    fullLabel: "3 (PJSA)",
    basePoints: 5,
    description: "งาน PJSA, วิเคราะห์ความปลอดภัย, ตรวจสอบมาตรฐานหน้างาน",
    color: "purple",
    keywords: ["pjsa", "ความปลอดภัย", "ตรวจสอบ"]
  }
];

/**
 * Fetch dynamic task categories configured in task-performance
 */
export async function getDynamicTaskCategories(): Promise<TaskCategoryOption[]> {
  return cached("task_categories:all", 30_000, async () => {
    try {
      const { data } = await supabaseAdmin
        .from("system_options")
        .select("data")
        .eq("id", "task_category_scores")
        .maybeSingle();

      const rawCategories = data?.data?.categories;
      if (!Array.isArray(rawCategories) || rawCategories.length === 0) {
        return DEFAULT_TASK_CATEGORIES;
      }

      return rawCategories
        .filter((c: any) => c && c.name && !String(c.name).toUpperCase().includes("PW"))
        .map((c: any, idx: number) => {
          const rawName = String(c.name || "").trim();
          // Extract leading number if present (e.g. "1. เอกสาร" or "1 (เอกสาร)")
          const numMatch = rawName.match(/^(\d+)[\.\s\)]*(.*)/);
          const num = Number(c.taskType) || (numMatch ? parseInt(numMatch[1], 10) : idx + 1);
          const cleanName = numMatch && numMatch[2] ? numMatch[2].trim() : rawName;
          const label = cleanName || rawName;

          return {
            id: num,
            key: c.id || `type_${num}`,
            name: `${num}. ${label}`,
            label,
            fullLabel: `${num} (${label})`,
            basePoints: Number(c.basePoints) || 0,
            description: c.description || "",
            color: c.color || (num === 1 ? "blue" : num === 2 ? "emerald" : num === 3 ? "purple" : "amber"),
            keywords: Array.isArray(c.keywords) ? c.keywords : []
          };
        });
    } catch {
      return DEFAULT_TASK_CATEGORIES;
    }
  });
}

/**
 * Get formatted category labels for FormModal / Schema Enum values:
 * e.g. ["1 (เอกสาร)", "2 (แผนงาน)", "3 (PJSA)", "4 (...)"]
 */
export async function getTaskCategoryLabels(): Promise<string[]> {
  const categories = await getDynamicTaskCategories();
  return categories.map((c) => c.fullLabel);
}

/**
 * Format a numeric task type into a full display label:
 * e.g. 1 -> "1 (เอกสาร)", 2 -> "2 (แผนงาน)"
 */
export function formatTaskTypeLabel(typeNum: number, categories?: TaskCategoryOption[]): string {
  const cats = categories && categories.length > 0 ? categories : DEFAULT_TASK_CATEGORIES;
  const found = cats.find((c) => c.id === typeNum);
  if (found) return found.fullLabel;
  return `${typeNum}`;
}

/**
 * Parse an incoming string/number into numeric taskType:
 * e.g. "2 (แผนงาน)" -> 2, "1" -> 1
 */
export function parseTaskTypeNumber(val: any): number {
  if (typeof val === "number" && !isNaN(val)) return val;
  const str = String(val || "").trim();
  const match = str.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    if (!isNaN(num) && num > 0) return num;
  }
  return 1;
}
