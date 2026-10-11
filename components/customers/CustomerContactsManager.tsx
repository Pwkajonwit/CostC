"use client";

import { useState } from "react";
import {
  Users,
  Plus,
  Phone,
  Mail,
  Briefcase,
  Edit2,
  Trash2,
  Star,
  Check,
  X,
  Loader2,
  ExternalLink
} from "lucide-react";
import type { CustomerContact } from "@/lib/supabase/supabase-db";

interface CustomerContactsManagerProps {
  customerId: string;
  customerName: string;
  initialShortName?: string;
  initialContacts?: CustomerContact[];
}

export function CustomerContactsManager({
  customerId,
  customerName,
  initialShortName = "",
  initialContacts = []
}: CustomerContactsManagerProps) {
  const [contacts, setContacts] = useState<CustomerContact[]>(initialContacts);
  const [shortName, setShortName] = useState(initialShortName);
  const [isEditingShort, setIsEditingShort] = useState(false);
  const [shortInput, setShortInput] = useState(initialShortName);
  const [savingShort, setSavingShort] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSaveShortName = async () => {
    setSavingShort(true);
    try {
      const res = await fetch("/api/customers/short-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          customerName,
          shortName: shortInput.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "บันทึกชื่อย่อไม่สำเร็จ");
      setShortName(shortInput.trim());
      setIsEditingShort(false);
    } catch (e: any) {
      alert(e.message || "เกิดข้อผิดพลาดในการบันทึกชื่อย่อ");
    } finally {
      setSavingShort(false);
    }
  };

  // Form states
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPosition, setFormPosition] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formIsPrimary, setFormIsPrimary] = useState(false);

  const openAddModal = () => {
    setEditingContact(null);
    setFormName("");
    setFormPhone("");
    setFormPosition("");
    setFormEmail("");
    setFormNote("");
    setFormIsPrimary(contacts.length === 0);
    setErrorMsg(null);
    setShowModal(true);
  };

  const openEditModal = (c: CustomerContact) => {
    setEditingContact(c);
    setFormName(c.name || "");
    setFormPhone(c.phone || "");
    setFormPosition(c.position || "");
    setFormEmail(c.email || "");
    setFormNote(c.note || "");
    setFormIsPrimary(Boolean(c.is_primary));
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMsg("กรุณาระบุชื่อผู้ติดต่อ");
      return;
    }
    if (!formPhone.trim()) {
      setErrorMsg("กรุณาระบุเบอร์โทรศัพท์ติดต่อ");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const payload: CustomerContact = {
      id: editingContact?.id || `ct_${Date.now()}`,
      name: formName.trim(),
      phone: formPhone.trim(),
      position: formPosition.trim() || undefined,
      email: formEmail.trim() || undefined,
      note: formNote.trim() || undefined,
      is_primary: formIsPrimary,
      created_at: editingContact?.created_at || new Date().toISOString()
    };

    try {
      const res = await fetch("/api/customers/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          contact: payload
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "บันทึกข้อมูลไม่สำเร็จ");
      }

      setContacts(data.contacts || []);
      setShowModal(false);
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (contactId: string, contactName: string) => {
    if (!confirm(`คุณต้องการลบข้อมูลผู้ติดต่อ "${contactName}" หรือไม่?`)) return;

    try {
      const res = await fetch("/api/customers/contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          contactId
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "ลบข้อมูลไม่สำเร็จ");
      }
      setContacts(data.contacts || []);
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการลบ");
    }
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="p-3.5 sm:p-4 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/60 shadow-2xs">
            <Users size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-slate-800">รายชื่อผู้ติดต่อ (Contacts)</h3>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                {contacts.length} คน
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              ข้อมูลผู้ติดต่อจะถูกนำไปเป็นตัวเลือกในหน้างานรับเหมา (PW) อัตโนมัติ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Customer Short Name Editor */}
          <div className="flex items-center gap-1.5 bg-blue-50/80 border border-blue-200/80 rounded-lg px-2.5 py-1">
            <span className="text-[11px] font-semibold text-blue-700">ชื่อย่อ (LINE/Flex):</span>
            {isEditingShort ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={shortInput}
                  onChange={(e) => setShortInput(e.target.value)}
                  placeholder="เช่น คาร์กิลล์"
                  className="px-2 py-0.5 text-xs bg-white border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-28 sm:w-36 text-slate-800"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveShortName();
                    if (e.key === "Escape") {
                      setIsEditingShort(false);
                      setShortInput(shortName);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveShortName}
                  disabled={savingShort}
                  className="p-1 text-emerald-600 hover:bg-emerald-100/60 rounded cursor-pointer transition"
                  title="บันทึก"
                >
                  {savingShort ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingShort(false);
                    setShortInput(shortName);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer transition"
                  title="ยกเลิก"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-blue-900 font-sans">
                  {shortName || "-"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShortInput(shortName);
                    setIsEditingShort(true);
                  }}
                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-100/60 rounded cursor-pointer transition"
                  title="แก้ไขชื่อย่อสำหรับแสดงใน Flex / LINE"
                >
                  <Edit2 size={12} />
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-medium rounded-lg shadow-2xs transition cursor-pointer"
          >
            <Plus size={14} />
            <span>เพิ่มผู้ติดต่อ</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3.5 sm:p-4">
        {contacts.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <Users size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-medium text-slate-600">ยังไม่มีข้อมูลผู้ติดต่อสำหรับลูกค้ารายนี้</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              กดปุ่ม &quot;เพิ่มผู้ติดต่อ&quot; ด้านบนเพื่อบันทึกชื่อ เบอร์โทร และตำแหน่ง
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {contacts.map((c) => {
              const cleanPhone = (c.phone || "").replace(/\D/g, "");
              const hasPhone = cleanPhone.length >= 9;

              return (
                <div
                  key={c.id}
                  className="relative p-3 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 transition shadow-2xs flex flex-col justify-between gap-2.5 group"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {c.name}
                        </span>
                        {c.is_primary && (
                          <span className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/60 inline-flex items-center gap-0.5">
                            <Star size={9} className="fill-amber-400 text-amber-500" />
                            หลัก
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition cursor-pointer"
                          title="แก้ไข"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id, c.name)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                          title="ลบ"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {c.position && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <Briefcase size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">{c.position}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-slate-800">
                      <Phone size={12} className="text-emerald-600 shrink-0" />
                      <span>{c.phone || "-"}</span>
                    </div>

                    {c.email && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <Mail size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}

                    {c.note && (
                      <p className="text-[10px] text-slate-400 line-clamp-2 pt-0.5">
                        {c.note}
                      </p>
                    )}
                  </div>

                  {hasPhone && (
                    <div className="pt-2 border-t border-slate-100">
                      <a
                        href={`tel:${cleanPhone}`}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-1 px-2 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 rounded-lg transition"
                      >
                        <Phone size={11} />
                        <span>โทรออก</span>
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3.5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-emerald-600" />
                <h4 className="text-xs font-semibold text-slate-800">
                  {editingContact ? "แก้ไขข้อมูลผู้ติดต่อ" : "เพิ่มผู้ติดต่อใหม่"}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-4 space-y-3">
              {errorMsg && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600 block">
                  ชื่อผู้ติดต่อ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="เช่น คุณสมชาย, ช่างเอ"
                  className="w-full h-8.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600 block">
                  เบอร์โทรติดต่อ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="เช่น 081-XXX-XXXX"
                  className="w-full h-8.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600 block">ตำแหน่ง / แผนก</label>
                  <input
                    type="text"
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value)}
                    placeholder="เช่น จัดซื้อ, โฟร์แมน"
                    className="w-full h-8.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600 block">อีเมล (ถ้ามี)</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full h-8.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600 block">หมายเหตุเพิ่มเติม</label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="บันทึกข้อความเพิ่มเติม..."
                  className="w-full h-8.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formIsPrimary}
                  onChange={(e) => setFormIsPrimary(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-700">ตั้งเป็นผู้ติดต่อหลักของลูกค้ารายนี้</span>
              </label>

              {/* Modal Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-medium rounded-lg shadow-2xs transition disabled:opacity-50 cursor-pointer"
                >
                  {loading && <Loader2 size={13} className="animate-spin" />}
                  <span>{editingContact ? "บันทึกการแก้ไข" : "เพิ่มผู้ติดต่อ"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
