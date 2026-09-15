import { NextRequest, NextResponse } from "next/server";
import { executeAndSaveSnapshot, getBackupConfig, getBackupHistory, sendBackupLineNotification } from "@/lib/backup-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const config = await getBackupConfig();

    if (!config.enabled) {
      return NextResponse.json({
        success: false,
        message: "ระบบสำรองข้อมูลอัตโนมัติถูกปิดการใช้งาน (Backup is disabled)"
      });
    }

    const backupType =
      config.frequency === "daily" ? "daily_auto" :
      config.frequency === "monthly" ? "monthly_auto" : "weekly_auto";

    const snapshot = await executeAndSaveSnapshot(backupType);
    const history = await getBackupHistory();

    await sendBackupLineNotification(snapshot, config, true);

    return NextResponse.json({
      success: true,
      message: `Cron automated backup completed successfully (${snapshot.totalRows} rows)`,
      snapshot,
      config,
      history
    });
  } catch (error) {
    console.error("Cron backup failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron backup execution failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
