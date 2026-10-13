"use client";

import { useState } from "react";
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Star,
  Check,
  X,
  Loader2,
  Building
} from "lucide-react";
import type { CustomerLocation } from "@/lib/supabase/supabase-db";

interface CustomerLocationsManagerProps {
  customerId: string;
  customerName: string;
  initialLocations?: CustomerLocation[];
}

export function CustomerLocationsManager({
  customerId,
  customerName,
  initialLocations = []
}: CustomerLocationsManagerProps) {
  const [locations, setLocations] = useState<CustomerLocation[]>(initialLocations);
  const [showModal, setShowModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<CustomerLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formIsPrimary, setFormIsPrimary] = useState(false);

  const openAddModal = () => {
    setEditingLocation(null);
    setFormName("");
    setFormAddress("");
    setFormNote("");
    setFormIsPrimary(locations.length === 0);
    setErrorMsg(null);
    setShowModal(true);
  };

  const openEditModal = (loc: CustomerLocation) => {
    setEditingLocation(loc);
    setFormName(loc.name || "");
    setFormAddress(loc.address || "");
    setFormNote(loc.note || "");
    setFormIsPrimary(Boolean(loc.is_primary));
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMsg("กรุณาระบุชื่อสถานที่ หรือ ไซต์งาน");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const payload: CustomerLocation = {
      id: editingLocation?.id || `loc_${Date.now()}`,
      name: formName.trim(),
      address: formAddress.trim() || undefined,
      note: formNote.trim() || undefined,
      is_primary: formIsPrimary,
      created_at: editingLocation?.created_at || new Date().toISOString()
    };

    try {
      const res = await fetch("/api/customers/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          location: payload
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "บันทึกข้อมูลไม่สำเร็จ");
      }

      setLocations(data.locations || []);
      setShowModal(false);
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (locationId: string, locationName: string) => {
    if (!confirm(`คุณต้องการลบข้อมูลสถานที่ "${locationName}" หรือไม่?`)) return;

    try {
      const res = await fetch("/api/customers/locations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          locationId
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "ลบข้อมูลไม่สำเร็จ");
      }
      setLocations(data.locations || []);
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการลบ");
    }
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="p-3.5 sm:p-4 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100/60 shadow-2xs">
            <MapPin size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-slate-800">สถานที่ / ไซต์งาน (Locations & Sites)</h3>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                {locations.length} แห่ง
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              สถานที่และไซต์งานจะถูกนำไปเป็นตัวเลือกในหน้างานรับเหมา (Quick-Work) อัตโนมัติ
            </p>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-medium shadow-2xs transition active:scale-95 cursor-pointer"
          >
            <Plus size={14} />
            <span>เพิ่มสถานที่ / ไซต์งาน</span>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="p-3 sm:p-4">
        {locations.length === 0 ? (
          <div className="text-center py-7 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
            <MapPin size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-medium text-slate-600">ยังไม่มีข้อมูลสถานที่หรือไซต์งานของลูกค้ารายนี้</p>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm mx-auto">
              คุณสามารถกดปุ่ม &quot;เพิ่มสถานที่ / ไซต์งาน&quot; ด้านบนเพื่อบันทึกไซต์งาน แผนก หรือสาขา
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {locations.map((loc) => (
              <div
                key={loc.id}
                className="relative p-3 rounded-xl border border-slate-200/90 hover:border-teal-300/80 hover:shadow-2xs bg-white transition group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 group-hover:text-teal-700 transition">
                        {loc.name}
                      </span>
                      {loc.is_primary && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 rounded-md">
                          <Star size={10} className="fill-amber-400 text-amber-500" />
                          หลัก
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={() => openEditModal(loc)}
                        className="p-1 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition cursor-pointer"
                        title="แก้ไข"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(loc.id, loc.name)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                        title="ลบ"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {loc.address && (
                    <p className="text-[11px] text-slate-600 mt-1 flex items-start gap-1">
                      <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{loc.address}</span>
                    </p>
                  )}

                  {loc.note && (
                    <p className="text-[10px] text-slate-400 mt-1 italic">
                      หมายเหตุ: {loc.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
            <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100/60">
                  <Building size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    {editingLocation ? "แก้ไขสถานที่ / ไซต์งาน" : "เพิ่มสถานที่ / ไซต์งานใหม่"}
                  </h4>
                  <p className="text-[10px] text-slate-500 truncate max-w-xs">{customerName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-3">
              {errorMsg && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-700">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-700">
                  ชื่อสถานที่ / ไซต์งาน <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="เช่น อาคาร A, ไซต์งานบางนา, คลังสินค้า 1"
                  className="w-full h-8.5 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-slate-900"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-700">
                  ที่อยู่ / รายละเอียดตำแหน่ง (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="เช่น นิคมอุตสาหกรรมอมตะซิตี้ หรือ ชั้น 3 โซน B"
                  className="w-full h-8.5 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-700">
                  หมายเหตุเพิ่มเติม (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="เช่น ต้องแลกบัตรก่อนเข้า หรือ ติดต่อรปภ."
                  className="w-full h-8.5 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-slate-900"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={formIsPrimary}
                    onChange={(e) => setFormIsPrimary(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                  />
                  <span>ตั้งเป็นสถานที่หลักสำหรับลูกค้ารายนี้</span>
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading && <Loader2 size={13} className="animate-spin" />}
                  <span>{editingLocation ? "บันทึกการแก้ไข" : "เพิ่มสถานที่"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
