import { NextRequest, NextResponse } from "next/server";
import {
  getImportHistory,
  appendImportHistory,
  deleteImportHistory,
  type ImportHistoryItem
} from "@/lib/import-history-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const history = await getImportHistory();
    return NextResponse.json({
      success: true,
      history
    });
  } catch (err) {
    console.error("GET /api/import-history error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load import history" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action;

    if (action === "clear") {
      const history = await deleteImportHistory(undefined, true);
      return NextResponse.json({
        success: true,
        message: "ล้างประวัติการนำเข้าข้อมูลทั้งหมดเรียบร้อยแล้ว",
        history
      });
    }

    if (action === "delete") {
      const id = body?.id;
      if (!id) {
        return NextResponse.json({ success: false, error: "Missing entry id" }, { status: 400 });
      }
      const history = await deleteImportHistory(id);
      return NextResponse.json({
        success: true,
        message: "ลบรายการประวัติการนำเข้าเรียบร้อยแล้ว",
        history
      });
    }

    // Default: append new entry
    const entry = (body?.item || body?.entry || body) as ImportHistoryItem;
    if (!entry || !entry.title) {
      return NextResponse.json({ success: false, error: "Invalid import history payload" }, { status: 400 });
    }

    // Ensure ID and timestamp
    const normalizedEntry: ImportHistoryItem = {
      ...entry,
      id: entry.id || `imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: entry.createdAt || new Date().toISOString()
    };

    const history = await appendImportHistory(normalizedEntry);
    return NextResponse.json({
      success: true,
      message: "บันทึกประวัติการนำเข้าสำเร็จ",
      history
    });
  } catch (err) {
    console.error("POST /api/import-history error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to save import history" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clearAll = searchParams.get("all") === "true";
    let id = searchParams.get("id");

    if (!id && !clearAll) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch (_) {}
    }

    if (!clearAll && !id) {
      return NextResponse.json({ success: false, error: "Missing id or all parameter" }, { status: 400 });
    }

    const history = await deleteImportHistory(id || undefined, clearAll);
    return NextResponse.json({
      success: true,
      message: clearAll ? "ล้างประวัติการนำเข้าทั้งหมดเรียบร้อยแล้ว" : "ลบรายการประวัติเรียบร้อยแล้ว",
      history
    });
  } catch (err) {
    console.error("DELETE /api/import-history error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to delete import history" },
      { status: 500 }
    );
  }
}
