import { NextRequest, NextResponse } from "next/server";
import {
  generateFullBackupPayload,
  restoreFromPayload,
  executeAndSaveSnapshot,
  getBackupConfig,
  saveBackupConfig,
  getBackupHistory,
  getBackupSnapshotFile,
  deleteBackupSnapshot,
  restoreFromSnapshotId,
  sendBackupLineNotification,
} from "@/lib/backup-service";

export const dynamic = "force-dynamic";

// ==========================================
// GET /api/backup
// 1. ?type=snapshot&id=bk_... -> Download backup JSON file
// 2. ?type=config             -> Get backup schedule config & history
// 3. (default)                -> Generate full backup payload
// ==========================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const snapshotId = searchParams.get("id");

    // 1. Download snapshot file
    if (type === "snapshot" || snapshotId) {
      if (!snapshotId) {
        return NextResponse.json({ error: "กรุณาระบุรหัสจุดสำรองข้อมูล (id)" }, { status: 400 });
      }

      const { filename, data } = await getBackupSnapshotFile(snapshotId);
      const arrayBuffer = await data.arrayBuffer();

      return new NextResponse(arrayBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    // 2. Load backup config & history
    if (type === "config") {
      const config = await getBackupConfig();
      const history = await getBackupHistory();
      return NextResponse.json({
        success: true,
        config,
        history,
      });
    }

    // 3. Full backup payload export
    const { payload } = await generateFullBackupPayload("manual");
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Backup GET failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process backup request" },
      { status: 500 }
    );
  }
}

// ==========================================
// POST /api/backup
// 1. action === "trigger"       -> Trigger manual / auto snapshot
// 2. action === "save-config"   -> Save schedule config
// 3. action === "restore-point" -> Restore database from snapshot ID
// 4. (default)                  -> Restore from uploaded JSON payload
// ==========================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action;

    // 1. Trigger snapshot
    if (action === "trigger") {
      const backupType = body?.backupType || "manual";
      const snapshot = await executeAndSaveSnapshot(backupType);
      const config = await getBackupConfig();
      const history = await getBackupHistory();

      await sendBackupLineNotification(snapshot, config, false).catch(() => undefined);

      return NextResponse.json({
        success: true,
        message: `สำรองข้อมูลสำเร็จ ${snapshot.totalRows.toLocaleString()} รายการ`,
        snapshot,
        config,
        history,
      });
    }

    // 2. Save backup config
    if (action === "save-config") {
      const configData = body?.config || body;
      const updatedConfig = await saveBackupConfig(configData);
      const history = await getBackupHistory();

      return NextResponse.json({
        success: true,
        message: "บันทึกการตั้งค่าตารางเวลาสำรองข้อมูลสำเร็จ",
        config: updatedConfig,
        history,
      });
    }

    // 3. Restore from snapshot ID
    if (action === "restore-point") {
      const snapshotId = body?.snapshotId;
      if (!snapshotId) {
        return NextResponse.json({ error: "กรุณาระบุรหัสจุดสำรองข้อมูล (snapshotId)" }, { status: 400 });
      }

      const result = await restoreFromSnapshotId(snapshotId);
      const history = await getBackupHistory();

      return NextResponse.json({
        success: true,
        message: result.message,
        totalRestored: result.totalRestored,
        details: result.details,
        history,
      });
    }

    // 4. Restore from raw payload
    const result = await restoreFromPayload(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Backup POST failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to execute backup action" },
      { status: 500 }
    );
  }
}

// ==========================================
// DELETE /api/backup?id=bk_...
// Delete snapshot from history and storage
// ==========================================
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let snapshotId = searchParams.get("id");

    if (!snapshotId) {
      try {
        const body = await req.json();
        snapshotId = body?.snapshotId || body?.id;
      } catch (_) {}
    }

    if (!snapshotId) {
      return NextResponse.json({ error: "กรุณาระบุรหัสจุดสำรองข้อมูล (id)" }, { status: 400 });
    }

    const result = await deleteBackupSnapshot(snapshotId);

    return NextResponse.json({
      success: true,
      message: result.message,
      history: result.history,
    });
  } catch (error) {
    console.error("Delete snapshot failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete backup snapshot" },
      { status: 500 }
    );
  }
}
