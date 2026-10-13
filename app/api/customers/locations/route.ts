import { NextRequest, NextResponse } from "next/server";
import {
  getCustomerLocationsMap,
  saveCustomerLocation,
  deleteCustomerLocation,
  type CustomerLocation
} from "@/lib/supabase/supabase-db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId") || searchParams.get("id");
    const map = await getCustomerLocationsMap();

    if (customerId) {
      const locations = map[String(customerId).trim()] || [];
      return NextResponse.json({ ok: true, locations });
    }

    return NextResponse.json({ ok: true, locationsMap: map });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Failed to load locations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, location } = body;

    if (!customerId || !location || !location.name) {
      return NextResponse.json({ ok: false, error: "กรุณาระบุรหัสลูกค้าและชื่อสถานที่/ไซต์งาน" }, { status: 400 });
    }

    const updatedList = await saveCustomerLocation(String(customerId).trim(), location as CustomerLocation);
    return NextResponse.json({ ok: true, locations: updatedList });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Failed to save location" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, locationId } = body;

    if (!customerId || !locationId) {
      return NextResponse.json({ ok: false, error: "กรุณาระบุ customerId และ locationId" }, { status: 400 });
    }

    const updatedList = await deleteCustomerLocation(String(customerId).trim(), String(locationId).trim());
    return NextResponse.json({ ok: true, locations: updatedList });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Failed to delete location" }, { status: 500 });
  }
}
