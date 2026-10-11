import { NextRequest, NextResponse } from "next/server";
import {
  getCustomerContactsMap,
  saveCustomerContact,
  deleteCustomerContact,
  type CustomerContact
} from "@/lib/supabase/supabase-db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId") || searchParams.get("id");
    const map = await getCustomerContactsMap();

    if (customerId) {
      const contacts = map[String(customerId).trim()] || [];
      return NextResponse.json({ ok: true, contacts });
    }

    return NextResponse.json({ ok: true, contactsMap: map });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Failed to load contacts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, contact } = body;

    if (!customerId || !contact || !contact.name) {
      return NextResponse.json({ ok: false, error: "กรุณาระบุรหัสลูกค้าและชื่อผู้ติดต่อ" }, { status: 400 });
    }

    const updatedList = await saveCustomerContact(String(customerId).trim(), contact as CustomerContact);
    return NextResponse.json({ ok: true, contacts: updatedList });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Failed to save contact" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, contactId } = body;

    if (!customerId || !contactId) {
      return NextResponse.json({ ok: false, error: "กรุณาระบุ customerId และ contactId" }, { status: 400 });
    }

    const updatedList = await deleteCustomerContact(String(customerId).trim(), String(contactId).trim());
    return NextResponse.json({ ok: true, contacts: updatedList });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Failed to delete contact" }, { status: 500 });
  }
}
