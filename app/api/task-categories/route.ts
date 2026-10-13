import { NextResponse } from "next/server";
import { getDynamicTaskCategories, getTaskCategoryLabels } from "@/lib/tasks/task-categories";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await getDynamicTaskCategories();
    const labels = await getTaskCategoryLabels();
    return NextResponse.json({
      success: true,
      categories,
      labels
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
