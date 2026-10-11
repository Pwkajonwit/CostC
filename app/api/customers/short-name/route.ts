import { NextRequest, NextResponse } from "next/server";
import {
  getCustomerShortNamesMap,
  saveCustomerShortName,
  resolveCustomerShortName
} from "@/lib/supabase/supabase-db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId") || searchParams.get("id");
    const name = searchParams.get("name") || "";
    const map = await getCustomerShortNamesMap();

    if (customerId) {
      const cleanId = String(customerId).trim();
      const shortName = map[cleanId] || (name ? (map[name.trim()] || resolveCustomerShortName(name, map)) : "") || "";
      return NextResponse.json({ ok: true, shortName });
    }

    return NextResponse.json({ ok: true, shortNamesMap: map });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Failed to load customer short names" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, shortName, customerName } = body;

    if (!customerId) {
      return NextResponse.json({ ok: false, error: "กรุณาระบุรหัสลูกค้า (customerId)" }, { status: 400 });
    }

    const updatedMap = await saveCustomerShortName(
      String(customerId).trim(),
      String(shortName || "").trim(),
      customerName ? String(customerName).trim() : undefined
    );

    return NextResponse.json({
      ok: true,
      customerId,
      shortName: String(shortName || "").trim(),
      shortNamesMap: updatedMap
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Failed to save customer short name" }, { status: 500 });
  }
}
