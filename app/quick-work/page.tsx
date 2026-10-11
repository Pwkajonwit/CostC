"use client";

import { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  FileText,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Send,
  Trash2,
  User,
  X,
  Edit3,
  Share2,
  Eye,
  Users,
  Gavel,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
  Search
} from "lucide-react";
import { QuickCreatorBar, type QuickCreator } from "@/components/auth/QuickCreatorBar";
import { closeToLine } from "@/lib/line/line-close";

interface SystemContractor {
  id: string;
  nickname: string | null;
  full_name: string | null;
  phone: string | null;
}

interface SystemCompany {
  id: string;
  name_th: string | null;
  name_en: string | null;
}

interface SystemCustomer {
  id: string;
  name: string | null;
}

interface CustomerContactItem {
  id: string;
  name: string;
  phone: string;
  position?: string;
  email?: string;
  note?: string;
  is_primary?: boolean;
}

const TEAMS = ["PW", "PW1", "PW2", "PW3", "PW4", "PW5"] as const;
const ACTIVITIES = ["รอดูงาน", "ประชุมงาน", "ประมูล"] as const;
const WORK_STATUSES = ["รอดูงาน", "รอเสนอราคา", "ประชุม", "ประมูล", "เสร็จ"] as const;

const COMMON_TIMES = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "18:00"
];

const QUICK_TIMES = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00"];

function parseInspectDateTime(val?: string) {
  if (!val || val === "-") return { date: "", time: "10:00" };
  let date = "";
  let time = "10:00";

  const timeMatch = val.match(/(?:เวลา\s*)?(\d{1,2}:\d{2})/);
  if (timeMatch) {
    time = timeMatch[1].padStart(5, "0");
  }

  const isoMatch = val.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    date = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  } else {
    const dmyMatch = val.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (dmyMatch) {
      let yr = Number(dmyMatch[3]);
      if (yr < 100) yr += 2000;
      if (yr > 2500) yr -= 543;
      date = `${yr}-${dmyMatch[2].padStart(2, "0")}-${dmyMatch[1].padStart(2, "0")}`;
    }
  }

  return { date, time };
}

function parseProposeDateTime(val?: string) {
  if (!val || val === "-") return { date: "", time: "10:00" };
  let date = "";
  let time = "10:00";

  const timeMatch = val.match(/(?:เวลา\s*)?(\d{1,2}:\d{2})/);
  if (timeMatch) {
    time = timeMatch[1].padStart(5, "0");
  }

  const isoMatch = val.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    date = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  } else {
    const dmyMatch = val.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (dmyMatch) {
      let yr = Number(dmyMatch[3]);
      if (yr < 100) yr += 2000;
      if (yr > 2500) yr -= 543;
      date = `${yr}-${dmyMatch[2].padStart(2, "0")}-${dmyMatch[1].padStart(2, "0")}`;
    }
  }

  return { date, time };
}

interface SearchableOption {
  key?: string;
  value: string;
  label: string;
  subLabel?: string;
  item?: any;
}

interface SearchableComboboxProps {
  label: string;
  value: string;
  onChange: (value: string, item?: any) => void;
  placeholder?: string;
  options: SearchableOption[];
  allowCustom?: boolean;
  required?: boolean;
}

function SearchableCombobox({
  label,
  value,
  onChange,
  placeholder = "เลือก...",
  options,
  allowCustom = true,
  required = false
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setSearch("");
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q)) ||
        (opt.item?.company && String(opt.item.company).toLowerCase().includes(q)) ||
        (opt.item?.phone && String(opt.item.phone).toLowerCase().includes(q))
    );
  }, [options, search]);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : value;

  return (
    <div ref={containerRef} className="space-y-1 relative">
      <label className="text-[11px] font-medium text-slate-600 block">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full h-8.5 px-2.5 bg-white border rounded-lg text-xs flex items-center justify-between gap-1.5 transition text-left cursor-pointer ${
          open
            ? "border-emerald-600 ring-1 ring-emerald-600/30"
            : "border-slate-300 hover:border-slate-400"
        }`}
      >
        <span className={`truncate flex-1 ${value ? "text-slate-900 font-medium" : "text-slate-400"}`}>
          {value ? displayLabel : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {value ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange("", null);
              }}
              className="p-0.5 hover:text-slate-600 rounded transition cursor-pointer"
              title="ล้างค่า"
            >
              <X size={12} />
            </span>
          ) : null}
          {open ? <ChevronUp size={13} className="text-slate-600" /> : <ChevronDown size={13} />}
        </div>
      </button>

      {/* Floating Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 font-sans animate-in fade-in zoom-in-95 duration-100">
          {/* Search Input */}
          <div className="relative mb-1.5">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="พิมพ์ค้นหา..."
              className="w-full h-8 pl-7 pr-6 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:outline-none transition-all"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={12} />
              </button>
            ) : null}
          </div>

          {/* Options List */}
          <div className="max-h-52 overflow-y-auto overflow-x-hidden space-y-0.5 text-xs">
            {filtered.length > 0 ? (
              filtered.map((opt, idx) => {
                const isSelected = opt.value === value;
                const uniqueKey = opt.key ? `${opt.key}-${idx}` : `${opt.value}-${idx}`;
                return (
                  <button
                    key={uniqueKey}
                    type="button"
                    onClick={() => {
                      onChange(opt.value, opt.item);
                      setOpen(false);
                    }}
                    className={`w-full py-2 px-2.5 rounded-lg text-left transition flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? "bg-emerald-50 text-emerald-900 font-semibold"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span className="truncate flex-1">{opt.label}</span>
                    {opt.subLabel && (
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {opt.subLabel}
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="py-4 text-center text-[11px] text-slate-400">
                ไม่พบข้อมูลที่ตรงกับ &quot;{search}&quot;
              </div>
            )}

            {/* Custom value option if searched text is not in list */}
            {allowCustom && search.trim() && !filtered.some((f) => f.value.toLowerCase() === search.toLowerCase().trim()) && (
              <button
                type="button"
                onClick={() => {
                  onChange(search.trim(), null);
                  setOpen(false);
                }}
                className="w-full py-2 px-2.5 rounded-lg text-left transition flex items-center gap-1.5 cursor-pointer bg-slate-50 hover:bg-slate-100 text-emerald-700 font-medium border border-dashed border-slate-200 mt-1"
              >
                <span className="text-xs">＋</span>
                <span className="truncate">ใช้ &quot;{search.trim()}&quot; (กำหนดเอง)</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QuickWorkContent() {
  const searchParams = useSearchParams();
  const rawIdParam = searchParams.get("id") || searchParams.get("work_id") || searchParams.get("edit") || "";
  const cleanId = rawIdParam ? rawIdParam.replace(/\D/g, "") : "";
  const isEditMode = Boolean(cleanId);

  const [creator, setCreator] = useState<QuickCreator | null>(null);
  const teamParam = searchParams.get("team")?.toUpperCase();
  const [team, setTeam] = useState<string>(
    teamParam && TEAMS.includes(teamParam as any) ? teamParam : "PW"
  );
  const [activityType, setActivityType] = useState<string>("รอดูงาน");
  const [status, setStatus] = useState<string>("รอดูงาน");
  const [title, setTitle] = useState("");
  const [prNo, setPrNo] = useState("");
  const [location, setLocation] = useState("");

  // Default to today's date in YYYY-MM-DD
  const todayIso = new Date().toISOString().split("T")[0];
  const [dateInspect, setDateInspect] = useState(todayIso);
  const [timeInspect, setTimeInspect] = useState("10:00");
  const [datePropose, setDatePropose] = useState("");
  const [timePropose, setTimePropose] = useState("10:00");

  const [contact1, setContact1] = useState("");
  const [phone1, setPhone1] = useState("");
  const [company, setCompany] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  // System master data options
  const [systemContractors, setSystemContractors] = useState<SystemContractor[]>([]);
  const [systemCompanies, setSystemCompanies] = useState<SystemCompany[]>([]);
  const [systemCustomers, setSystemCustomers] = useState<SystemCustomer[]>([]);
  const [customerContactsMap, setCustomerContactsMap] = useState<Record<string, CustomerContactItem[]>>({});

  // Form submission & loading states
  const [loadingWork, setLoadingWork] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [createdWorkId, setCreatedWorkId] = useState<string | null>(null);
  const [isUpdateSuccess, setIsUpdateSuccess] = useState(false);

  // Normalize current status for comparison and matching
  const normalizedStatus = useMemo(() => {
    let st = status;
    if (st === "รอดู") return "รอดูงาน";
    if (st === "รอเสนอราคา") return "รอเสนอ";
    if (st === "สำเร็จ" || st === "ปิดงาน") return "เสร็จ";
    if (st === "ประชุมงาน") return "ประชุม";
    return st;
  }, [status]);

  // Stepper steps based on activity type as specified:
  // - รอดูงาน/รอเสนอ: รอดูงาน > รอเสนอ > เสร็จ (หรือ รอเสนอ > รอดูงาน > เสร็จ)
  // - ประชุม: ประชุม > เสร็จ
  // - ประมูล: ประมูล > เสร็จ
  const currentSteps = useMemo(() => {
    if (activityType === "ประชุมงาน" || activityType === "ประชุม") {
      return [
        {
          id: "ประชุม",
          label: "ประชุม",
          desc: "นัดหมาย / ประชุมงาน",
          icon: Users,
          activeClasses: "bg-purple-50 border-purple-400 text-purple-900 ring-2 ring-purple-500/20 shadow-xs",
          badgeActive: "bg-purple-600 text-white",
          iconColor: "text-purple-600",
          checkColor: "text-purple-600"
        },
        {
          id: "เสร็จ",
          label: "เสร็จ (ปิดงาน)",
          desc: "ประชุมเสร็จสิ้น",
          icon: CheckCircle2,
          activeClasses: "bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs",
          badgeActive: "bg-emerald-600 text-white",
          iconColor: "text-emerald-600",
          checkColor: "text-emerald-600"
        }
      ];
    }

    if (activityType === "ประมูล") {
      return [
        {
          id: "ประมูล",
          label: "ประมูล",
          desc: "เตรียมยื่นประมูล",
          icon: Gavel,
          activeClasses: "bg-indigo-50 border-indigo-400 text-indigo-900 ring-2 ring-indigo-500/20 shadow-xs",
          badgeActive: "bg-indigo-600 text-white",
          iconColor: "text-indigo-600",
          checkColor: "text-indigo-600"
        },
        {
          id: "เสร็จ",
          label: "เสร็จ (ปิดงาน)",
          desc: "ประมูลเสร็จสิ้น",
          icon: CheckCircle2,
          activeClasses: "bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs",
          badgeActive: "bg-emerald-600 text-white",
          iconColor: "text-emerald-600",
          checkColor: "text-emerald-600"
        }
      ];
    }

    // Default: รอดูงาน / รอเสนอ
    return [
      {
        id: "รอดูงาน",
        label: "รอดูงาน",
        desc: "นัดดูหน้างาน",
        icon: Eye,
        activeClasses: "bg-blue-50 border-blue-400 text-blue-900 ring-2 ring-blue-500/20 shadow-xs",
        badgeActive: "bg-blue-600 text-white",
        iconColor: "text-blue-600",
        checkColor: "text-blue-600"
      },
      {
        id: "รอเสนอ",
        label: "รอเสนอ",
        desc: "รอส่งใบเสนอราคา",
        icon: FileText,
        activeClasses: "bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-500/20 shadow-xs",
        badgeActive: "bg-amber-600 text-white",
        iconColor: "text-amber-600",
        checkColor: "text-amber-600"
      },
      {
        id: "เสร็จ",
        label: "เสร็จ (ปิดงาน)",
        desc: "ได้ข้อสรุป / จบงาน",
        icon: CheckCircle2,
        activeClasses: "bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs",
        badgeActive: "bg-emerald-600 text-white",
        iconColor: "text-emerald-600",
        checkColor: "text-emerald-600"
      }
    ];
  }, [activityType]);

  // Fetch work details and system options (contractors, companies, customers)
  useEffect(() => {
    let isMounted = true;
    if (cleanId) setLoadingWork(true);

    const url = cleanId ? `/api/works/quick-create?id=${cleanId}` : "/api/works/quick-create";
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.ok) {
          if (Array.isArray(data.contractors)) {
            setSystemContractors(data.contractors);
          }
          if (Array.isArray(data.companies)) {
            setSystemCompanies(data.companies);
          }
          if (Array.isArray(data.customers)) {
            setSystemCustomers(data.customers);
          }
          if (data.customerContacts && typeof data.customerContacts === "object") {
            setCustomerContactsMap(data.customerContacts);
          }

          if (data.work) {
            const w = data.work;
            if (w.team) setTeam(w.team);
            if (w.activity_type) {
              let act = w.activity_type;
              if (act === "เสนอราคา") act = "รอดูงาน";
              setActivityType(act);
            }
            if (w.title) setTitle(w.title);
            if (w.pr_no && w.pr_no !== "-") setPrNo(w.pr_no);
            if (w.location && w.location !== "-") setLocation(w.location);

            const dt = parseInspectDateTime(w.date_inspect);
            if (dt.date) setDateInspect(dt.date);
            if (dt.time) setTimeInspect(dt.time);

            const propDt = parseProposeDateTime(w.date_propose);
            if (propDt.date) setDatePropose(propDt.date);
            if (propDt.time) setTimePropose(propDt.time);

            if (w.contact1 && w.contact1 !== "-") setContact1(w.contact1);
            if (w.phone1 && w.phone1 !== "-") setPhone1(w.phone1);
            if (w.company && w.company !== "-") setCompany(w.company);

            // Extract amount if present in note or w.amount
            if (w.amount && Number(w.amount) > 0) {
              setAmount(Number(w.amount).toLocaleString("th-TH"));
            } else if (w.note) {
              const amtMatch = String(w.note).match(/(?:฿|ยอดเสนอ:\s*฿?)\s*([\d,]+)/);
              if (amtMatch) {
                setAmount(amtMatch[1]);
              }
            }

            if (w.status) {
              let st = w.status;
              if (st === "รอดู") st = "รอดูงาน";
              if (st === "รอเสนอ") st = "รอเสนอราคา";
              if (st === "สำเร็จ") st = "เสร็จ";
              if (st === "ประชุมงาน") st = "ประชุม";
              setStatus(st);
            }

            // Clean note (remove extracted amount suffix)
            if (w.note && w.note !== "-") {
              const cleanNote = String(w.note).replace(/\(ยอดเสนอ:\s*฿?[\d,]+\)/, "").trim();
              setNote(cleanNote);
            }

            // Pre-fill creator if present
            if (w.contact2 && w.contact2 !== "-") {
              setCreator({
                name: w.contact2,
                phone: w.phone2 && w.phone2 !== "-" ? w.phone2 : "",
                employeeId: ""
              });
            } else if (data.attachments?.submittedBy) {
              const rawSub = String(data.attachments.submittedBy);
              const m = rawSub.match(/^(.*?)(?:\s*\((.*?)\))?$/);
              if (m) {
                setCreator({
                  name: m[1].trim(),
                  phone: m[2] ? m[2].trim() : "",
                  employeeId: ""
                });
              }
            }
          }
        } else if (cleanId) {
          setErrorMsg(data.error || "ไม่พบข้อมูลงานรับเหมานี้");
        }
      })
      .catch((err) => {
        console.error("Fetch work error:", err);
        if (cleanId) setErrorMsg("ไม่สามารถโหลดข้อมูลงานได้");
      })
      .finally(() => {
        if (isMounted) setLoadingWork(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cleanId]);

  // Helper to find customer/company ID from company string
  const getSelectedCustomerId = (companyStr: string): string | null => {
    if (!companyStr) return null;
    const str = companyStr.trim().toLowerCase();
    for (const cus of systemCustomers) {
      if (
        str.startsWith(cus.id.toLowerCase()) ||
        str.includes(cus.id.toLowerCase()) ||
        (cus.name && (str.includes(cus.name.toLowerCase()) || cus.name.toLowerCase().includes(str)))
      ) {
        return cus.id;
      }
    }
    for (const co of systemCompanies) {
      if (
        str.startsWith(co.id.toLowerCase()) ||
        str.includes(co.id.toLowerCase()) ||
        (co.name_th && (str.includes(co.name_th.toLowerCase()) || co.name_th.toLowerCase().includes(str))) ||
        (co.name_en && (str.includes(co.name_en.toLowerCase()) || co.name_en.toLowerCase().includes(str)))
      ) {
        return co.id;
      }
    }
    return null;
  };

  // Combobox options for customer contact persons (filtered by selected company if chosen)
  const contactOptions = useMemo<SearchableOption[]>(() => {
    const list: SearchableOption[] = [];
    const matchedCusId = getSelectedCustomerId(company);

    // If a company/customer is selected, and it has contacts in customerContactsMap:
    if (matchedCusId && customerContactsMap[matchedCusId] && customerContactsMap[matchedCusId].length > 0) {
      const contacts = customerContactsMap[matchedCusId];
      const cusObj = systemCustomers.find((c) => c.id === matchedCusId);
      const cusName = cusObj?.name || matchedCusId;

      contacts.forEach((ct) => {
        const trimmedName = ct.name?.trim();
        if (!trimmedName) return;

        list.push({
          key: `ct-${matchedCusId}-${ct.id}`,
          value: trimmedName,
          label: trimmedName,
          item: {
            name: trimmedName,
            phone: ct.phone,
            company: cusName,
            customerId: matchedCusId,
            position: ct.position,
            is_primary: ct.is_primary,
          }
        });
      });

      return list;
    }

    // If no company selected or the selected company has no contacts, show all available contacts
    Object.entries(customerContactsMap).forEach(([cusId, contacts]) => {
      const cusObj = systemCustomers.find((c) => c.id === cusId);
      const cusName = cusObj?.name || cusId;

      contacts.forEach((ct) => {
        const trimmedName = ct.name?.trim();
        if (!trimmedName) return;

        list.push({
          key: `ct-${cusId}-${ct.id}`,
          value: trimmedName,
          label: trimmedName,
          item: {
            name: trimmedName,
            phone: ct.phone,
            company: cusName,
            customerId: cusId,
            position: ct.position,
            is_primary: ct.is_primary,
          }
        });
      });
    });

    return list;
  }, [customerContactsMap, systemCustomers, systemCompanies, company]);

  // Combobox options for companies / customers
  const companyOptions = useMemo<SearchableOption[]>(() => {
    const list: SearchableOption[] = [];
    systemCompanies.forEach((co) => {
      const name = co.name_th || co.name_en || co.id;
      list.push({
        key: `co-${co.id}`,
        value: name,
        label: `${co.id} - ${name}`,
        subLabel: "บริษัท",
        item: co,
      });
    });
    systemCustomers.forEach((cus) => {
      const name = cus.name || cus.id;
      list.push({
        key: `cus-${cus.id}`,
        value: name,
        label: `${cus.id} - ${name}`,
        subLabel: "ลูกค้า",
        item: cus,
      });
    });
    return list;
  }, [systemCompanies, systemCustomers]);

  // Synchronized change handlers for Contact and Company
  const handleContactChange = (val: string, item?: any) => {
    setContact1(val);
    if (!val) {
      // Clear phone when contact is cleared
      setPhone1("");
      return;
    }
    if (item) {
      if (item.phone && item.phone !== "-") {
        setPhone1(item.phone);
      }
      if (item.company && (!company || company !== item.company)) {
        setCompany(item.company);
      }
    } else {
      // Custom typed contact name - find if matches any contact in our records
      for (const contacts of Object.values(customerContactsMap)) {
        const found = contacts.find((c) => c.name?.trim().toLowerCase() === val.trim().toLowerCase());
        if (found) {
          if (found.phone && found.phone !== "-") setPhone1(found.phone);
          break;
        }
      }
    }
  };

  const handleCompanyChange = (val: string, item?: any) => {
    setCompany(val);
    if (!val) {
      // If company cleared, clear contact and phone
      setContact1("");
      setPhone1("");
      return;
    }

    const cusId = item?.id || getSelectedCustomerId(val);
    if (cusId && customerContactsMap[cusId] && customerContactsMap[cusId].length > 0) {
      const contacts = customerContactsMap[cusId];
      // Auto-sync with primary contact or first contact of this company
      const primary = contacts.find((c) => c.is_primary) || contacts[0];
      if (primary) {
        setContact1(primary.name?.trim() || "");
        setPhone1(primary.phone && primary.phone !== "-" ? primary.phone : "");
      }
    } else {
      // The newly selected company has no contacts: clear contact and phone
      setContact1("");
      setPhone1("");
    }
  };

  const handleShareWork = async () => {
    const targetId = cleanId ? `PW-${cleanId}` : (createdWorkId || "PW");
    const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/quick-work?id=${targetId}`;
    const shareText = [
      `📋 [งานรับเหมา: ${targetId}] ${title.trim() || "งานรับเหมา"}`,
      `📌 สถานะ: ${status}`,
      company ? `🏢 บริษัท: ${company}` : (location ? `📍 สถานที่: ${location}` : null),
      dateInspect ? `📅 นัดดูหน้างาน: ${dateInspect} เวลา ${timeInspect}` : null,
      datePropose ? `📅 นัดส่งเสนอ: ${datePropose} เวลา ${timePropose}` : null,
      contact1 ? `👤 ผู้ติดต่อ: ${contact1}${phone1 ? ` (${phone1})` : ""}` : null,
      amount ? `💰 ยอดประมาณการ: ฿${amount}` : null,
      note ? `📝 หมายเหตุ: ${note}` : null,
      `🔗 เปิดดู/อัพเดทข้อมูลงาน: ${shareUrl}`
    ].filter(Boolean).join("\n");

    // 1. Try LIFF ShareTargetPicker if in LINE client and available
    try {
      const liffModule = await import("@line/liff");
      const liff = liffModule.default || (window as any).liff;
      if (liff && typeof liff.isApiAvailable === "function" && liff.isApiAvailable("shareTargetPicker")) {
        await liff.shareTargetPicker([
          {
            type: "text",
            text: shareText
          }
        ]);
        return;
      }
    } catch (_) {}

    // 2. Fallback to LINE URL Scheme if mobile/LINE browser
    const lineShareUrl = `https://line.me/R/share?text=${encodeURIComponent(shareText)}`;
    if (typeof navigator !== "undefined" && (navigator.userAgent.includes("Line") || /Android|iPhone|iPad/i.test(navigator.userAgent))) {
      window.location.href = lineShareUrl;
      return;
    }

    // 3. Web Share API fallback
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `งานรับเหมา: ${targetId}`,
          text: shareText,
          url: shareUrl
        });
        return;
      } catch (_) {}
    }

    // 4. Fallback copy to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      alert("คัดลอกข้อมูลงานและลิงก์เรียบร้อยแล้ว สามารถส่งต่อใน LINE ได้ทันที");
    } catch (_) {
      window.open(lineShareUrl, "_blank");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creator || !creator.name) {
      setErrorMsg("กรุณาระบุตัวตนผู้เปิด/อัปเดตงาน (กรอกเบอร์โทรด้านบน) ก่อนทำการบันทึก");
      return;
    }

    if (!title.trim()) {
      setErrorMsg("กรุณาระบุชื่องาน / เรื่อง");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      if (cleanId) {
        formData.append("edit_id", cleanId);
      }
      formData.append("team", team);
      formData.append("activity_type", activityType);
      formData.append("status", status);
      formData.append("title", title.trim());
      formData.append("pr_no", prNo.trim() || "-");
      formData.append("location", location.trim() || "-");

      // Pass creator identity
      formData.append("creator_name", creator.name);
      formData.append("creator_phone", creator.phone || "-");
      formData.append("creator_emp_id", creator.employeeId || "");

      // Format inspect date with time if provided
      let formattedInspect = dateInspect ? dateInspect : "-";
      if (dateInspect) {
        const parts = dateInspect.split("-");
        if (parts.length === 3) {
          const dmy = `${parts[2]}/${parts[1]}/${Number(parts[0]) + 543}`;
          const effectiveTime = timeInspect ? timeInspect.trim() : "10:00";
          formattedInspect = `${dmy} เวลา ${effectiveTime}`;
        }
      }
      formData.append("date_inspect", formattedInspect);

      let formattedPropose = datePropose ? datePropose : "-";
      if (datePropose) {
        const parts = datePropose.split("-");
        if (parts.length === 3) {
          const dmy = `${parts[2]}/${parts[1]}/${Number(parts[0]) + 543}`;
          const effectiveTime = timePropose ? timePropose.trim() : "10:00";
          formattedPropose = `${dmy} เวลา ${effectiveTime}`;
        }
      }
      formData.append("date_propose", formattedPropose);

      formData.append("contact1", contact1.trim() || "-");
      formData.append("phone1", phone1.trim() || "-");
      formData.append("company", company.trim() || "-");
      formData.append("amount", amount ? String(Number(amount.replace(/,/g, "")) || 0) : "0");
      formData.append("note", note.trim());

      const res = await fetch("/api/works/quick-create", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "บันทึกไม่สำเร็จ");
      }

      const returnedWorkId = data.workId || (cleanId ? `PW-${cleanId}` : "PW-OK");
      const isUpd = Boolean(data.isUpdate);

      setCreatedWorkId(returnedWorkId);

      // Try sending message via LINE LIFF sendMessage if open in client
      if (data.flex) {
        try {
          const liffModule = await import("@line/liff");
          const liff = liffModule.default || (window as any).liff;
          if (liff && typeof liff.isInClient === "function" && liff.isInClient()) {
            const altText = isUpd
              ? `[อัปเดตงานรับเหมา: ${returnedWorkId}] ${title.trim()}`
              : `[เปิดงานรับเหมา: ${returnedWorkId}] ${title.trim()}`;
            await liff.sendMessages([
              {
                type: "flex",
                altText,
                contents: data.flex,
              },
            ]);
          }
        } catch (liffErr) {
          console.warn("liff.sendMessages notice/fallback:", liffErr);
        }
      }

      setIsUpdateSuccess(isUpd);
      if (!isUpd) {
        // Clear form inputs only for new work
        setTitle("");
        setPrNo("");
        setLocation("");
        setContact1("");
        setPhone1("");
        setCompany("");
        setAmount("");
        setNote("");
      }
      setErrorMsg(null);
      setSuccessMsg(
        isUpd
          ? `🎉 อัปเดตงานรับเหมาสำเร็จ! (รหัส ${returnedWorkId}) บันทึกและส่ง Flex แจ้งเตือนเข้า LINE เรียบร้อยแล้ว`
          : `🎉 เปิดงานรับเหมาสำเร็จ! (รหัส ${returnedWorkId}) บันทึกและส่ง Flex แจ้งเตือนเข้า LINE เรียบร้อยแล้ว`
      );

      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingWork) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-500 gap-3 font-sans">
        <Loader2 size={32} className="animate-spin text-emerald-600" />
        <span className="text-xs font-medium">กำลังโหลดข้อมูลงาน [PW-{cleanId}]...</span>
      </div>
    );
  }

  // FORM VIEW
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between font-sans text-xs selection:bg-emerald-100 selection:text-emerald-900">
      {/* Main Container */}
      <main className="flex-1 w-full max-w-lg mx-auto px-3.5 sm:px-4 pt-3.5 sm:pt-5 pb-32 space-y-3.5">
        {/* Creator Identity Bar (Remembered across sessions) */}
        <QuickCreatorBar
          creator={creator}
          onCreatorChange={setCreator}
          accentColor="emerald"
        />

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start justify-between gap-2.5 shadow-2xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="font-bold text-emerald-900">บันทึกสำเร็จ!</p>
                <p className="text-emerald-700 leading-relaxed">{successMsg}</p>
                <button
                  type="button"
                  onClick={handleShareWork}
                  className="inline-flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-lg shadow-2xs transition cursor-pointer active:scale-95"
                >
                  <Share2 size={13} />
                  <span>ส่งต่อ (แชร์งานเข้า LINE)</span>
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-500 hover:text-emerald-800 p-0.5 rounded transition"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {isEditMode ? (
          /* =========================================================
             EDIT MODE: ฟอร์มอัปเดตสถานะ & ข้อมูลงานรับเหมา (กระชับ รวดเร็ว)
             ========================================================= */
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center justify-between animate-in fade-in">
                <span>⚠️ {errorMsg}</span>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="text-rose-400 hover:text-rose-700 p-0.5"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* 1. Status Stepper Card: รวมรหัสงาน + หมวดหมู่ + เลื่อนสถานะ (กะทัดรัด แถวเดียว) */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-3 sm:p-3.5 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-600 text-white shadow-2xs shrink-0">
                    PW-{cleanId}
                  </span>
                  <span className="text-xs font-bold text-slate-800 truncate" title={title}>
                    {title || `งานรับเหมา PW-${cleanId}`}
                  </span>
                </div>

                {/* หมวดหมู่กิจกรรม */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] shrink-0">
                  {ACTIVITIES.map((act) => {
                    const isActSelected = activityType === act;
                    return (
                      <button
                        key={act}
                        type="button"
                        onClick={() => {
                          setActivityType(act);
                          if (act === "รอดูงาน" && status !== "รอดูงาน" && status !== "รอเสนอ" && status !== "เสร็จ") {
                            setStatus("รอดูงาน");
                          } else if (act === "ประชุมงาน" && status !== "ประชุม" && status !== "เสร็จ") {
                            setStatus("ประชุม");
                          } else if (act === "ประมูล" && status !== "ประมูล" && status !== "เสร็จ") {
                            setStatus("ประมูล");
                          }
                        }}
                        className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                          isActSelected
                            ? "bg-white text-slate-900 font-bold shadow-2xs"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {act === "ประชุมงาน" ? "ประชุม" : act}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ปุ่มเลื่อนสถานะแบบ Compact Segment Bar */}
              <div className={`grid gap-1.5 ${currentSteps.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                {currentSteps.map((step) => {
                  const isSelected = normalizedStatus === step.id;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setStatus(step.id)}
                      className={`py-2 px-2 rounded-lg border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? step.activeClasses
                          : "bg-slate-50/80 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <step.icon size={13} className={isSelected ? step.iconColor : "text-slate-400"} />
                      <span className="font-bold text-xs">{step.label}</span>
                      {isSelected && <Check size={12} className={step.checkColor} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. ข้อมูลงาน & ทีมรับผิดชอบ (ส่วนสำคัญ: แสดงชัดเจน ปรับเปลี่ยนทีมและเรื่องได้ทันที) */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-1.5 pb-1 border-b border-slate-100">
                <Briefcase size={14} className="text-emerald-600" />
                <h2 className="text-xs font-semibold text-slate-800">ข้อมูลงาน & ทีมรับผิดชอบ</h2>
              </div>

              {/* ชื่องาน / เรื่อง */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-700">
                  ชื่องาน / เรื่อง <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="เช่น งานเทพื้นคอนกรีต, งานระบบท่อดับเพลิง"
                  className="w-full h-8.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30"
                />
              </div>

              {/* ทีมรับผิดชอบ (PW, PW1, PW2, PW3, PW4, PW5) - แถวเต็ม 6 ปุ่ม กดเปลี่ยนได้ทันที 1-Click */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-slate-700">ทีมรับผิดชอบ</label>
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ทีมที่เลือก: {team}
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1 sm:gap-1.5">
                  {TEAMS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTeam(t)}
                      className={`py-2 text-xs rounded-lg border transition-all cursor-pointer font-medium flex items-center justify-center ${
                        team === t
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold ring-2 ring-emerald-500/20"
                          : "bg-slate-50/80 text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* สถานที่ / ไซต์งาน & เลขที่ PR */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">สถานที่ / ไซต์งาน</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="เช่น อาคาร A หรือ ไซต์งาน"
                    className="w-full h-8.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">เลขที่ PR (ถ้ามี)</label>
                  <input
                    type="text"
                    value={prNo}
                    onChange={(e) => setPrNo(e.target.value)}
                    placeholder="PR-..."
                    className="w-full h-8.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30"
                  />
                </div>
              </div>
            </div>

            {/* 3. บริษัท & ข้อมูลผู้ติดต่อ */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
              <div className="flex items-center gap-1.5 pb-1 border-b border-slate-100">
                <Building2 size={14} className="text-emerald-600" />
                <h2 className="text-xs font-semibold text-slate-800">บริษัท & ผู้ติดต่อ</h2>
              </div>

              {/* บริษัท / ผู้ว่าจ้าง */}
              <div>
                <SearchableCombobox
                  label="บริษัท / ผู้ว่าจ้าง"
                  value={company}
                  placeholder="เลือกบริษัท หรือ ผู้ว่าจ้าง..."
                  options={companyOptions}
                  onChange={handleCompanyChange}
                />
              </div>

              {/* ผู้ติดต่อ & เบอร์ติดต่อ */}
              <div className="grid grid-cols-2 gap-2">
                <SearchableCombobox
                  label="ชื่อผู้ติดต่อ"
                  value={contact1}
                  placeholder="เลือกหรือค้นหาชื่อผู้ติดต่อ..."
                  options={contactOptions}
                  onChange={handleContactChange}
                />
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">เบอร์โทรติดต่อ</label>
                  <input
                    type="tel"
                    value={phone1}
                    onChange={(e) => setPhone1(e.target.value)}
                    placeholder="081-XXX-XXXX"
                    className="w-full h-8.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30"
                  />
                </div>
              </div>

              {/* วันนัดดูหน้างาน & วันส่งใบเสนอราคา */}
              <div className="border-t border-slate-100 pt-2.5 space-y-2.5">
                {/* 1. นัดดูหน้างาน */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1 min-w-0">
                      <label className="text-[11px] font-medium text-slate-600 block truncate">วันนัดดูหน้างาน</label>
                      <input
                        type="date"
                        value={dateInspect}
                        onChange={(e) => setDateInspect(e.target.value)}
                        className="w-full min-w-0 h-8.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 transition"
                      />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <label className="text-[11px] font-medium text-slate-600 block truncate">เวลานัดดูหน้างาน</label>
                      <div className="relative min-w-0 w-full">
                        <Clock
                          size={13}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"
                        />
                        <select
                          value={timeInspect}
                          onChange={(e) => setTimeInspect(e.target.value)}
                          className="w-full min-w-0 h-8.5 pl-7 pr-6 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 transition appearance-none cursor-pointer"
                        >
                          {COMMON_TIMES.map((t) => (
                            <option key={t} value={t}>
                              {t} น.
                            </option>
                          ))}
                          {timeInspect && !COMMON_TIMES.includes(timeInspect) && (
                            <option value={timeInspect}>{timeInspect} น. (กำหนดเอง)</option>
                          )}
                        </select>
                        <ChevronDown
                          size={13}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* แถบเลือกเวลาด่วน (ดูหน้างาน) */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-medium">เวลานัดดู:</span>
                    {QUICK_TIMES.map((qt) => {
                      const isSelected = timeInspect === qt;
                      return (
                        <button
                          key={`inspect-${qt}`}
                          type="button"
                          onClick={() => setTimeInspect(qt)}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                            isSelected
                              ? "bg-emerald-600 text-white shadow-2xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {qt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. นัดส่งใบเสนอราคา (รอเสนอ) */}
                <div className="space-y-1.5 border-t border-dashed border-slate-100 pt-2">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1 min-w-0">
                      <label className="text-[11px] font-medium text-slate-600 block truncate">วันนัดส่งใบเสนอราคา</label>
                      <input
                        type="date"
                        value={datePropose}
                        onChange={(e) => setDatePropose(e.target.value)}
                        className="w-full min-w-0 h-8.5 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600/30 transition"
                      />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <label className="text-[11px] font-medium text-slate-600 block truncate">เวลานัดส่งเสนอ (รอเสนอ)</label>
                      <div className="relative min-w-0 w-full">
                        <Clock
                          size={13}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"
                        />
                        <select
                          value={timePropose}
                          onChange={(e) => setTimePropose(e.target.value)}
                          className="w-full min-w-0 h-8.5 pl-7 pr-6 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600/30 transition appearance-none cursor-pointer"
                        >
                          {COMMON_TIMES.map((t) => (
                            <option key={t} value={t}>
                              {t} น.
                            </option>
                          ))}
                          {timePropose && !COMMON_TIMES.includes(timePropose) && (
                            <option value={timePropose}>{timePropose} น. (กำหนดเอง)</option>
                          )}
                        </select>
                        <ChevronDown
                          size={13}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* แถบเลือกเวลาด่วน (ส่งเสนอ) */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-medium">เวลานัดเสนอ:</span>
                    {QUICK_TIMES.map((qt) => {
                      const isSelected = timePropose === qt;
                      return (
                        <button
                          key={`propose-${qt}`}
                          type="button"
                          onClick={() => setTimePropose(qt)}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                            isSelected
                              ? "bg-purple-600 text-white shadow-2xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {qt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* หมายเหตุ */}
              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-medium text-slate-600">หมายเหตุ / ผลการดำเนินงาน</label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="ผลการดูหน้างาน, รายละเอียดเพิ่มเติม..."
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600 resize-none"
                />
              </div>
            </div>

            {/* Sticky Bottom Button for Update Mode (ตัดปุ่มแชร์งานออก ปุ่มเต็มความกว้าง) */}
            <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 z-20 shadow-md">
              <div className="max-w-lg mx-auto">
                <button
                  type="submit"
                  disabled={submitting}
                  className={`w-full py-2.5 sm:py-3 disabled:opacity-50 text-white rounded-xl font-bold text-xs sm:text-sm tracking-wide transition shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
                    normalizedStatus === "เสร็จ"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : normalizedStatus === "รอเสนอ"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : normalizedStatus === "ประชุม"
                      ? "bg-purple-600 hover:bg-purple-700"
                      : normalizedStatus === "ประมูล"
                      ? "bg-indigo-600 hover:bg-indigo-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>กำลังบันทึกและส่งเข้า LINE...</span>
                    </>
                  ) : (
                    <>
                      {normalizedStatus === "เสร็จ" ? <CheckCircle2 size={16} /> : <Send size={15} />}
                      <span>
                        {normalizedStatus === "เสร็จ"
                          ? "บันทึกปิดงาน (เสร็จสิ้น) & ส่งเข้า LINE"
                          : `บันทึกอัปเดตสถานะ [${normalizedStatus}] & ส่ง LINE`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* =========================================================
             CREATE MODE: ฟอร์มเปิดงานใหม่มาตรฐาน
             ========================================================= */
          <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center justify-between animate-in fade-in">
                <span>⚠️ {errorMsg}</span>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="text-rose-400 hover:text-rose-700 p-0.5"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* 1. Primary Work Info */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-4.5 space-y-3.5 shadow-2xs">
              <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100">
                <Briefcase size={14} className="text-emerald-600" />
                <h2 className="text-xs font-semibold text-slate-800">ข้อมูลงานรับเหมา</h2>
              </div>

              {/* Team Selector */}
              <div className="space-y-1.5 pt-0.5">
                <label className="text-[11px] font-medium text-slate-600">ทีมรับผิดชอบ</label>
                <div className="grid grid-cols-5 gap-2">
                  {TEAMS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTeam(t)}
                      className={`py-2 text-xs rounded-lg border transition-all cursor-pointer font-medium flex items-center justify-center ${
                        team === t
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-semibold ring-2 ring-emerald-500/20"
                          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Activity Type */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-600">ประเภทกิจกรรม</label>
                <div className="grid grid-cols-3 gap-2">
                  {ACTIVITIES.map((act) => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => {
                        setActivityType(act);
                        if (act === "รอดูงาน") setStatus("รอดูงาน");
                        else if (act === "ประชุมงาน") setStatus("ประชุม");
                        else if (act === "ประมูล") setStatus("ประมูล");
                      }}
                      className={`py-2 px-2 text-xs font-medium rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                        activityType === act
                          ? "bg-emerald-50 text-emerald-700 border-emerald-400 ring-2 ring-emerald-500/20 font-semibold"
                          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {act}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1.5 pt-0.5">
                <label className="text-[11px] font-medium text-slate-700 flex items-center justify-between">
                  <span>
                    ชื่องาน / รายละเอียดเรื่อง <span className="text-rose-500">*</span>
                  </span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="เช่น งานเทพื้นคอนกรีต, งานระบบท่อดับเพลิง"
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 transition"
                />
              </div>

              {/* PR & Location */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5 min-w-0">
                  <label className="text-[11px] font-medium text-slate-600 block truncate">เลขที่ PR (ถ้ามี)</label>
                  <div className="relative min-w-0 w-full">
                    <FileText
                      size={14}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                    <input
                      type="text"
                      value={prNo}
                      onChange={(e) => setPrNo(e.target.value)}
                      placeholder="PR-2026-..."
                      className="w-full min-w-0 max-w-full h-9 pl-8 pr-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 transition"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 min-w-0">
                  <label className="text-[11px] font-medium text-slate-600 block truncate">สถานที่ / ไซต์งาน</label>
                  <div className="relative min-w-0 w-full">
                    <MapPin
                      size={14}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="ไซต์งาน, อาคาร..."
                      className="w-full min-w-0 max-w-full h-9 pl-8 pr-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Inspection & Schedule */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-4.5 space-y-3 shadow-2xs">
              <h2 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 pb-0.5">
                <Calendar size={14} className="text-emerald-600" />
                <span>การนัดหมายหน้างาน</span>
              </h2>

              {/* 1. นัดดูหน้างาน */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1 min-w-0">
                    <label className="text-[11px] font-medium text-slate-600 block truncate">วันนัดดูหน้างาน</label>
                    <input
                      type="date"
                      value={dateInspect}
                      onChange={(e) => setDateInspect(e.target.value)}
                      className="w-full min-w-0 max-w-full h-9 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 transition"
                    />
                  </div>

                  <div className="space-y-1 min-w-0">
                    <label className="text-[11px] font-medium text-slate-600 block truncate">เวลานัดดูหน้างาน</label>
                    <div className="relative min-w-0 w-full">
                      <Clock
                        size={14}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"
                      />
                      <select
                        value={timeInspect}
                        onChange={(e) => setTimeInspect(e.target.value)}
                        className="w-full min-w-0 max-w-full h-9 pl-8 pr-6 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 transition appearance-none cursor-pointer"
                      >
                        {COMMON_TIMES.map((t) => (
                          <option key={t} value={t}>
                            {t} น.
                          </option>
                        ))}
                        {timeInspect && !COMMON_TIMES.includes(timeInspect) && (
                          <option value={timeInspect}>{timeInspect} น. (กำหนดเอง)</option>
                        )}
                      </select>
                      <ChevronDown
                        size={14}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                      />
                    </div>
                  </div>
                </div>

                {/* แถบเลือกเวลาด่วน (ดูหน้างาน) */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-medium">เวลานัดดู:</span>
                  {QUICK_TIMES.map((qt) => {
                    const isSelected = timeInspect === qt;
                    return (
                      <button
                        key={`create-inspect-${qt}`}
                        type="button"
                        onClick={() => setTimeInspect(qt)}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                          isSelected
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {qt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. นัดส่งใบเสนอราคา (รอเสนอ) */}
              <div className="space-y-1.5 border-t border-dashed border-slate-100 pt-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1 min-w-0">
                    <label className="text-[11px] font-medium text-slate-600 block truncate">วันนัดส่งใบเสนอราคา (ถ้ามี)</label>
                    <input
                      type="date"
                      value={datePropose}
                      onChange={(e) => setDatePropose(e.target.value)}
                      className="w-full min-w-0 max-w-full h-9 px-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600/30 transition"
                    />
                  </div>

                  <div className="space-y-1 min-w-0">
                    <label className="text-[11px] font-medium text-slate-600 block truncate">เวลานัดส่งเสนอ (รอเสนอ)</label>
                    <div className="relative min-w-0 w-full">
                      <Clock
                        size={14}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"
                      />
                      <select
                        value={timePropose}
                        onChange={(e) => setTimePropose(e.target.value)}
                        className="w-full min-w-0 max-w-full h-9 pl-8 pr-6 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600/30 transition appearance-none cursor-pointer"
                      >
                        {COMMON_TIMES.map((t) => (
                          <option key={t} value={t}>
                            {t} น.
                          </option>
                        ))}
                        {timePropose && !COMMON_TIMES.includes(timePropose) && (
                          <option value={timePropose}>{timePropose} น. (กำหนดเอง)</option>
                        )}
                      </select>
                      <ChevronDown
                        size={14}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                      />
                    </div>
                  </div>
                </div>

                {/* แถบเลือกเวลาด่วน (ส่งเสนอ) */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-medium">เวลานัดเสนอ:</span>
                  {QUICK_TIMES.map((qt) => {
                    const isSelected = timePropose === qt;
                    return (
                      <button
                        key={`create-propose-${qt}`}
                        type="button"
                        onClick={() => setTimePropose(qt)}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                          isSelected
                            ? "bg-purple-600 text-white shadow-2xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {qt}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3. Company / Contact */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-4.5 space-y-3 shadow-2xs">
              <h2 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 pb-0.5">
                <Building2 size={14} className="text-emerald-600" />
                <span>บริษัท & ผู้ติดต่อ</span>
              </h2>

              {/* บริษัท / ผู้ว่าจ้าง */}
              <div>
                <SearchableCombobox
                  label="บริษัท / ผู้ว่าจ้าง"
                  value={company}
                  placeholder="เลือกบริษัท หรือ ผู้ว่าจ้าง..."
                  options={companyOptions}
                  onChange={handleCompanyChange}
                />
              </div>

              {/* ผู้ติดต่อ & เบอร์ติดต่อ */}
              <div className="grid grid-cols-2 gap-2.5">
                <SearchableCombobox
                  label="ชื่อผู้ติดต่อ"
                  value={contact1}
                  placeholder="เลือกหรือค้นหาชื่อผู้ติดต่อ..."
                  options={contactOptions}
                  onChange={handleContactChange}
                />

                <div className="space-y-1 min-w-0">
                  <label className="text-[11px] font-medium text-slate-600 block truncate">เบอร์โทรติดต่อ</label>
                  <div className="relative min-w-0 w-full">
                    <Phone
                      size={14}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                    <input
                      type="tel"
                      value={phone1}
                      onChange={(e) => setPhone1(e.target.value)}
                      placeholder="081-XXX-XXXX"
                      className="w-full min-w-0 max-w-full h-8.5 pl-8 pr-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 transition"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">หมายเหตุเพิ่มเติม</label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="รายละเอียดเพิ่มเติมสำหรับการทำงาน..."
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 transition resize-none"
                />
              </div>
            </div>

            {/* Sticky Bottom Buttons */}
            <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 z-20 shadow-md">
              <div className="max-w-lg mx-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShareWork}
                  className="py-2.5 sm:py-3 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-xs sm:text-sm tracking-wide transition border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                  title="ส่งต่อข้อมูลงานนี้ไปที่ LINE"
                >
                  <Share2 size={16} className="text-emerald-600" />
                  <span>ส่งต่อ</span>
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium text-xs sm:text-sm tracking-wide transition shadow-2xs flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>กำลังบันทึกและส่งเข้า LINE...</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>บันทึกเปิดงาน & ส่งเข้า LINE</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

      </main>
    </div>
  );
}

export default function QuickWorkPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-500 gap-3 font-sans">
          <Loader2 size={32} className="animate-spin text-emerald-600" />
          <span className="text-xs font-medium">กำลังเตรียมฟอร์มงานรับเหมา...</span>
        </div>
      }
    >
      <QuickWorkContent />
    </Suspense>
  );
}
