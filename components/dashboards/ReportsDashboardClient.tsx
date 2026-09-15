"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  Calculator,
  Download,
  FileSpreadsheet,
  HardHat,
  Layers,
  Package,
  Printer,
  Receipt,
  RotateCw,
  Search,
  Store,
  Tag,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { money, toNumber } from "@/lib/utils/numbers";
import type { SheetRow } from "@/lib/types";
import {
  filterBillsByProject,
  getRowAmount,
  getRowCategory,
  getRowCategoryAmount,
  getRowTransferAmount,
  isLaborRow,
  isMaterialOrExpenseRow,
} from "@/lib/reports";
import { isPaidBill, isCommittedBill } from "@/lib/bills/bill-status";
import {
  MATERIAL_100_CODES,
  EQUIPMENT_500_CODES,
  isMaterialCost,
  isLaborCost,
  isStaffCost,
  isFuelCost,
  isRepairCost,
  isMachineCost,
  isToolCost,
  isOtherExpense,
} from "@/lib/cost-codes";
import { useYearFilter } from "@/lib/context/YearFilterContext";
const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

function formatDateThai(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  const str = String(value).trim();
  if (!str || str === "-") return "-";
  const mISO = str.match(/^(\d{4})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])/);
  if (mISO) {
    const y = Number(mISO[1]);
    const m = Number(mISO[2]) - 1;
    const d = Number(mISO[3]);
    const thMonth = m >= 0 && m < 12 ? THAI_MONTHS_SHORT[m] : String(m + 1);
    return `${d} ${thMonth} ${y}`;
  }
  const mDMY = str.match(/^(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d\d|\d\d|\d{4})/);
  if (mDMY) {
    const d = Number(mDMY[1]);
    const m = Number(mDMY[2]) - 1;
    let y = Number(mDMY[3]);
    if (y > 2400) y -= 543;
    const thMonth = m >= 0 && m < 12 ? THAI_MONTHS_SHORT[m] : String(m + 1);
    return `${d} ${thMonth} ${y}`;
  }
  return str;
}

type ReportsDashboardClientProps = {
  initialDataRows: SheetRow[];
  initialProjectRows: SheetRow[];
  initialStoreRows: SheetRow[];
  initialContractorRows: SheetRow[];
  initialContractWorkRows?: SheetRow[];
  initialPeopleRows: SheetRow[];
};

type MainTab = "overview" | "material" | "labor";
type MaterialSubTab = "bills" | "stores" | "product_categories";
type LaborSubTab = "bills" | "contractors";


const CATEGORIES_LIST = [
  { key: "หมวด 100 ค่าของ", label: "หมวด 100 ค่าของ", searchKey: "ค่าของ", matcher: isMaterialCost, color: "bg-emerald-50 text-emerald-900 border-emerald-200" },
  { key: "หมวด 200 ค่าแรง", label: "หมวด 200 ค่าแรง", searchKey: "ค่าแรง", matcher: isLaborCost, color: "bg-indigo-50 text-indigo-900 border-indigo-200" },
  { key: "หมวด 300 พนักงาน", label: "หมวด 300 พนักงาน", searchKey: "พนักงาน", matcher: isStaffCost, color: "bg-purple-50 text-purple-900 border-purple-200" },
  { key: "501 น้ำมัน", label: "501 น้ำมัน", searchKey: "น้ำมัน", matcher: isFuelCost, color: "bg-amber-50 text-amber-900 border-amber-200" },
  { key: "502 ซ่อมรถ", label: "502 ซ่อมรถ", searchKey: "ซ่อมรถ", matcher: isRepairCost, color: "bg-orange-50 text-orange-900 border-orange-200" },
  { key: "503 เครื่องจักร", label: "503 เครื่องจักร", searchKey: "เครื่องจักร", matcher: isMachineCost, color: "bg-blue-50 text-blue-900 border-blue-200" },
  { key: "504 เครื่องมือ", label: "504 เครื่องมือ", searchKey: "เครื่องมือ", matcher: isToolCost, color: "bg-cyan-50 text-cyan-900 border-cyan-200" },
  { key: "อื่นๆ / ดำเนินการ", label: "อื่นๆ / ดำเนินการ", searchKey: "อื่นๆ", matcher: isOtherExpense, color: "bg-rose-50 text-rose-900 border-rose-200" },
];

type ProductCategoryItemConfig = {
  code: string;
  label: string;
  group: string;
  searchKeys: string[];
};

const DEFAULT_PRODUCT_CATEGORIES_LIST: ProductCategoryItemConfig[] = [
  ...MATERIAL_100_CODES.map((c) => ({
    code: c.code,
    label: `${c.code}. ${c.name}`,
    group: "หมวด 100 ค่าของ",
    searchKeys: [c.code, c.name, `${c.code} ${c.name}`],
  })),
  ...EQUIPMENT_500_CODES.map((c) => ({
    code: c.code,
    label: `${c.code}. ${c.name}`,
    group: "หมวด 500 เครื่องจักร/เครื่องมือ/ยานพาหนะ",
    searchKeys: [c.code, c.name, `${c.code} ${c.name}`],
  })),
];

export function ReportsDashboardClient({
  initialDataRows,
  initialProjectRows,
  initialStoreRows,
  initialContractorRows,
  initialContractWorkRows = [],
  initialPeopleRows,
}: ReportsDashboardClientProps) {
  const { filterRowsByYear } = useYearFilter();
  const [dataRows, setDataRows] = useState<SheetRow[]>(initialDataRows);
  const [projectRows, setProjectRows] = useState<SheetRow[]>(initialProjectRows);

  useEffect(() => {
    if (initialDataRows) setDataRows(initialDataRows);
  }, [initialDataRows]);
  useEffect(() => {
    if (initialProjectRows) setProjectRows(initialProjectRows);
  }, [initialProjectRows]);

  const [productCategoryList, setProductCategoryList] = useState<ProductCategoryItemConfig[]>(DEFAULT_PRODUCT_CATEGORIES_LIST);

  // Fetch dynamic Master Data for Product Categories
  useEffect(() => {
    async function loadMasterCategories() {
      try {
        const res = await fetch("/api/system-options");
        const json = await res.json();
        if (json.success && json.options && Array.isArray(json.options["PRODUCT_MASTER_DATA"])) {
          const masterList = json.options["PRODUCT_MASTER_DATA"];
          const dynamicList: ProductCategoryItemConfig[] = masterList.map((item: any) => {
            const code = String(item.code || "");
            const name = String(item.name || "");
            const group = (item.group || "").replace(/^[\p{Emoji}\s]+/gu, "").trim() || "หมวดงานทั่วไป & ดำเนินการ";
            return {
              code: code || name,
              label: `${code ? code + ". " : ""}${name}`,
              group,
              searchKeys: [code, name]
            };
          });
          setProductCategoryList(dynamicList);
        }
      } catch (err) {
        console.error("Failed to fetch product categories in ReportsDashboardClient:", err);
      }
    }
    loadMasterCategories();
  }, []);

  // Main & Sub Tab State
  const [activeMainTab, setActiveMainTab] = useState<MainTab>("overview");
  const [materialSubTab, setMaterialSubTab] = useState<MaterialSubTab>("bills");
  const [laborSubTab, setLaborSubTab] = useState<LaborSubTab>("bills");

  // Global Filter States
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [selectedRequester, setSelectedRequester] = useState<string>("all");
  const [selectedContractor, setSelectedContractor] = useState<string>("all");
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProductCategory, setSelectedProductCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);

  // Debounce search input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Entrepreneur Financial Calculator States
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcBaseAmount, setCalcBaseAmount] = useState<string>("100000");
  const [calcVatPercent, setCalcVatPercent] = useState<number>(7);
  const [calcWhtPercent, setCalcWhtPercent] = useState<number>(3);
  const [calcContractValue, setCalcContractValue] = useState<string>("5000000");

  // Build People lookup map (Code -> Name/Nickname)
  const peopleMap = useMemo(() => {
    const map: Record<string, string> = {};
    (initialPeopleRows || []).forEach((r) => {
      const code = String(r["รหัสพนักงาน"] || r["รหัส"] || r["ID"] || "").trim().toLowerCase();
      const nickname = String(r["ชื่อเล่น"] || "").trim();
      const fullName = String(r["ชื่อ-นามสกุล"] || r["ชื่อ"] || "").trim();
      const displayName = nickname || fullName;
      if (code && displayName) {
        map[code] = displayName;
      }
    });
    return map;
  }, [initialPeopleRows]);

  function getRequesterDisplayName(raw: unknown): string {
    const val = String(raw || "").trim();
    if (!val) return "-";
    const mappedName = peopleMap[val.toLowerCase()];
    if (mappedName) {
      return mappedName;
    }
    return val;
  }

  // Contractor map: id_Contractor/id_Conwork/code -> Display Name
  const contractorMap = useMemo(() => {
    const map: Record<string, { code: string; name: string }> = {};

    (initialContractorRows || []).forEach((c) => {
      const code = String(c["id_Contractor"] || c["id"] || c["รหัส"] || c["ID"] || "").trim();
      const nickname = String(c["ชื่อเล่น"] || "").trim();
      const fullName = String(c["ชื่อ-นามสกุล"] || "").trim();
      const name = nickname || fullName || String(c["รายละเอียดงาน"] || "").trim();

      if (code) {
        map[code.toLowerCase()] = { code, name: name || code };
      }
      if (nickname) {
        map[nickname.toLowerCase()] = { code: code || nickname, name: nickname };
      }
      if (fullName && !map[fullName.toLowerCase()]) {
        map[fullName.toLowerCase()] = { code: code || fullName, name: nickname || fullName };
      }
    });

    (initialContractWorkRows || []).forEach((cw) => {
      const conworkCode = String(cw["id_Conwork"] || cw["รหัสงาน"] || "").trim();
      const contractorRef = String(cw["id_Contractor"] || cw["ผู้รับเหมา"] || cw["ร้าน/บุคคล"] || "").trim();

      if (conworkCode) {
        let name = conworkCode;
        if (contractorRef) {
          const resolved = map[contractorRef.toLowerCase()];
          if (resolved) {
            name = resolved.name;
          } else {
            name = contractorRef;
          }
        }
        map[conworkCode.toLowerCase()] = { code: conworkCode, name };
      }
    });

    return map;
  }, [initialContractorRows, initialContractWorkRows]);

  function getContractorInfo(raw: unknown): { code: string; name: string } {
    const val = String(raw || "").trim();
    if (!val) return { code: "-", name: "-" };

    const mapped = contractorMap[val.toLowerCase()];
    if (mapped) {
      return { code: mapped.code, name: mapped.name };
    }
    if (/^CW\d+/i.test(val)) {
      return { code: val, name: val };
    }
    return { code: "-", name: val };
  }

  // Extract unique projects list
  const projectsList = useMemo(() => {
    return projectRows
      .map((p) => {
        const id = String(p["ID Project"] || p.id || "").trim();
        const name = String(p["ชื่อ Project"] || p.name || "").trim();
        return { id, name, label: id && name ? `${id} - ${name}` : id || name };
      })
      .filter((p) => p.id || p.name);
  }, [projectRows]);

  // Unique Requesters List for Dropdown Filter
  const requestersList = useMemo(() => {
    const map = new Map<string, string>();
    dataRows.forEach((r) => {
      const raw = String(r["ผู้เบิก"] || "").trim();
      if (raw) {
        const displayName = getRequesterDisplayName(raw);
        map.set(raw, displayName);
      }
    });
    return Array.from(map.entries())
      .map(([val, name]) => ({
        val,
        label: name !== val && !val.includes(name) ? `${val} (${name})` : name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "th"));
  }, [dataRows, peopleMap]);

  // Unified Unique Contractors List for Dropdowns
  const contractorsDropdownList = useMemo(() => {
    const map = new Map<string, { val: string; label: string }>();

    (initialContractorRows || []).forEach((c) => {
      const code = String(c["id_Contractor"] || c["id"] || c["รหัส"] || c["ID"] || "").trim();
      const nickname = String(c["ชื่อเล่น"] || "").trim();
      const fullName = String(c["ชื่อ-นามสกุล"] || "").trim();
      const name = nickname || fullName || String(c["รายละเอียดงาน"] || "").trim();

      const key = (name || code).toLowerCase();
      if (key && !map.has(key)) {
        const label = code && name && code !== name ? `${code} - ${name}` : (name || code);
        map.set(key, { val: name || code, label });
      }
    });

    dataRows.forEach((r) => {
      if (isLaborRow(r)) {
        const raw = String(r["ชื่อผู้รับเหมา"] || r["ผู้รับเหมา"] || r["ร้าน/บุคคล"] || "").trim();
        if (raw) {
          const info = getContractorInfo(raw);
          const name = info.name !== "-" ? info.name : raw;
          const key = name.toLowerCase();
          if (!map.has(key)) {
            const label = info.code !== "-" && info.code !== name ? `${info.code} - ${name}` : name;
            map.set(key, { val: name, label });
          }
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "th"));
  }, [dataRows, initialContractorRows, contractorMap]);

  // Extract unique stores list
  const storesList = useMemo(() => {
    const set = new Set<string>();
    dataRows.forEach((r) => {
      if (isMaterialOrExpenseRow(r)) {
        const store = String(r["ร้านค้า"] || r["ร้าน/บุคคล"] || r["ร้านค้า/ผู้รับเหมา"] || "").trim();
        if (store) set.add(store);
      }
    });
    initialStoreRows.forEach((s) => {
      const name = String(s["ชื่อร้านค้า"] || s.name || "").trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "th"));
  }, [dataRows, initialStoreRows]);

  // Filter rows by Project (applied on year-filtered data)
  const yearFilteredDataRows = useMemo(() => filterRowsByYear(dataRows), [dataRows, filterRowsByYear]);

  const projectFilteredRows = useMemo(() => {
    return filterBillsByProject(yearFilteredDataRows, selectedProjectId);
  }, [yearFilteredDataRows, selectedProjectId]);

  // Master Search & Multi-Dropdown Filter
  const searchFilteredRows = useMemo(() => {
    let list = projectFilteredRows;

    if (selectedRequester !== "all") {
      list = list.filter((r) => {
        const rawReq = String(r["ผู้เบิก"] || "").trim();
        const displayReq = getRequesterDisplayName(rawReq);
        return rawReq === selectedRequester || displayReq === selectedRequester;
      });
    }

    if (selectedContractor !== "all") {
      const target = selectedContractor.toLowerCase();
      list = list.filter((r) => {
        const rawC = String(r["ชื่อผู้รับเหมา"] || r["ผู้รับเหมา"] || r["ร้าน/บุคคล"] || "").trim();
        const info = getContractorInfo(rawC);
        return (
          rawC.toLowerCase().includes(target) ||
          info.code.toLowerCase().includes(target) ||
          info.name.toLowerCase().includes(target)
        );
      });
    }

    if (selectedStore !== "all") {
      const target = selectedStore.toLowerCase();
      list = list.filter((r) => {
        const rawS = String(r["ร้านค้า"] || r["ร้าน/บุคคล"] || r["ร้านค้า/ผู้รับเหมา"] || "").trim();
        return rawS.toLowerCase().includes(target);
      });
    }

    if (!debouncedSearch.trim()) return list;

    const q = debouncedSearch.toLowerCase().trim();
    return list.filter((r) => {
      const reqName = getRequesterDisplayName(r["ผู้เบิก"]);
      const cInfo = getContractorInfo(r["ผู้รับเหมา"] || r["ร้าน/บุคคล"] || r["ชื่อผู้รับเหมา"]);
      return (
        String(r["ลำดับ"] || "").toLowerCase().includes(q) ||
        String(r["ร้าน/บุคคล"] || "").toLowerCase().includes(q) ||
        String(r["ร้านค้า"] || "").toLowerCase().includes(q) ||
        String(r["ผู้รับเหมา"] || "").toLowerCase().includes(q) ||
        cInfo.code.toLowerCase().includes(q) ||
        cInfo.name.toLowerCase().includes(q) ||
        String(r["สินค้า/ทำงาน"] || "").toLowerCase().includes(q) ||
        String(r["รายละเอียดงาน"] || "").toLowerCase().includes(q) ||
        String(r["ประเภท"] || "").toLowerCase().includes(q) ||
        String(r["ผู้เบิก"] || "").toLowerCase().includes(q) ||
        reqName.toLowerCase().includes(q)
      );
    });
  }, [projectFilteredRows, selectedRequester, selectedContractor, selectedStore, debouncedSearch, peopleMap, contractorMap]);

  // Tab: Material rows
  const materialRows = useMemo(() => {
    return searchFilteredRows.filter(isMaterialOrExpenseRow);
  }, [searchFilteredRows]);

  // Tab: Product Categories breakdown
  const productCategoryMetrics = useMemo(() => {
    const grandTotal = materialRows.reduce((sum, r) => sum + getRowTransferAmount(r), 0);

    const breakdown = productCategoryList.map((cat) => {
      const rows = materialRows.filter((r) => {
        const categoryVal = getRowCategory(r).toLowerCase().trim();
        const itemVal = String(r["สินค้า/ทำงาน"] || r["รายการ"] || "").toLowerCase().trim();
        return cat.searchKeys.some((k) => categoryVal.includes(k.toLowerCase()) || itemVal.includes(k.toLowerCase()));
      });

      const count = rows.length;
      const amount = rows.reduce((sum, r) => sum + getRowAmount(r), 0);
      const transfer = rows.reduce((sum, r) => sum + getRowTransferAmount(r), 0);
      const percent = grandTotal > 0 ? (transfer / grandTotal) * 100 : 0;
      return { ...cat, count, amount, transfer, percent, rows };
    });

    return { grandTotal, breakdown };
  }, [materialRows, productCategoryList]);

  // Tab: Product Category Filtered Rows
  const productCategoryFilteredRows = useMemo(() => {
    if (selectedProductCategory === "all") return materialRows;
    const catConfig = productCategoryList.find((c) => c.code === selectedProductCategory);
    if (!catConfig) return materialRows;

    return materialRows.filter((r) => {
      const categoryVal = getRowCategory(r).toLowerCase().trim();
      const itemVal = String(r["สินค้า/ทำงาน"] || r["รายการ"] || "").toLowerCase().trim();
      return catConfig.searchKeys.some((k) => categoryVal.includes(k.toLowerCase()) || itemVal.includes(k.toLowerCase()));
    });
  }, [materialRows, selectedProductCategory, productCategoryList]);

  const productCategoryBillTotal = useMemo(() => {
    return productCategoryFilteredRows.reduce((sum, r) => sum + getRowAmount(r), 0);
  }, [productCategoryFilteredRows]);

  const productCategoryTransferTotal = useMemo(() => {
    return productCategoryFilteredRows.reduce((sum, r) => sum + getRowTransferAmount(r), 0);
  }, [productCategoryFilteredRows]);

  // Tab: Labor rows
  const laborRows = useMemo(() => {
    return searchFilteredRows.filter(isLaborRow);
  }, [searchFilteredRows]);

  // Tab: Category breakdown (8 หมวดหมู่)
  const categoryMetrics = useMemo(() => {
    const grandTotal = searchFilteredRows.reduce((sum, r) => sum + getRowTransferAmount(r), 0);

    const breakdown = CATEGORIES_LIST.map((cat) => {
      const rows = searchFilteredRows.filter((r) => {
        const rowCat = getRowCategory(r);
        return (
          (cat.matcher && cat.matcher(rowCat)) ||
          rowCat.toLowerCase().includes(cat.searchKey) ||
          rowCat.toLowerCase().includes(cat.key.toLowerCase())
        );
      });
      const count = rows.length;
      const amount = rows.reduce((sum, r) => sum + getRowAmount(r), 0);
      const transfer = rows.reduce((sum, r) => sum + getRowTransferAmount(r), 0);
      const percent = grandTotal > 0 ? (transfer / grandTotal) * 100 : 0;
      return { ...cat, count, amount, transfer, percent, rows };
    });

    return { grandTotal, breakdown };
  }, [searchFilteredRows]);

  // Category Filtered rows
  const categoryFilteredRows = useMemo(() => {
    if (selectedCategory === "all") return searchFilteredRows;
    const catObj = CATEGORIES_LIST.find((c) => c.key === selectedCategory);
    return searchFilteredRows.filter((r) => {
      const rowCat = getRowCategory(r);
      if (catObj?.matcher && catObj.matcher(rowCat)) return true;
      const searchKey = catObj ? catObj.searchKey : selectedCategory.toLowerCase();
      return rowCat.toLowerCase().includes(searchKey) || rowCat.toLowerCase().includes(selectedCategory.toLowerCase());
    });
  }, [searchFilteredRows, selectedCategory]);

  const categoryFilteredBillTotal = useMemo(() => {
    return categoryFilteredRows.reduce((sum, r) => sum + getRowAmount(r), 0);
  }, [categoryFilteredRows]);

  const categoryFilteredTransferTotal = useMemo(() => {
    return categoryFilteredRows.reduce((sum, r) => sum + getRowTransferAmount(r), 0);
  }, [categoryFilteredRows]);

  // Contractor specific rows
  const contractorRows = useMemo(() => {
    const base = searchFilteredRows.filter(isLaborRow);
    if (selectedContractor === "all") return base;
    return base.filter((r) => {
      const name = String(r["ชื่อผู้รับเหมา"] || r["ผู้รับเหมา"] || r["ร้าน/บุคคล"] || "").trim();
      return name.toLowerCase().includes(selectedContractor.toLowerCase());
    });
  }, [searchFilteredRows, selectedContractor]);

  // Store specific rows
  const storeRows = useMemo(() => {
    const base = searchFilteredRows.filter(isMaterialOrExpenseRow);
    if (selectedStore === "all") return base;
    return base.filter((r) => {
      const name = String(r["ร้านค้า"] || r["ร้าน/บุคคล"] || r["ร้านค้า/ผู้รับเหมา"] || "").trim();
      return name.toLowerCase().includes(selectedStore.toLowerCase());
    });
  }, [searchFilteredRows, selectedStore]);

  // Metrics for Material
  const materialMetrics = useMemo(() => {
    const totalAmount = materialRows.reduce((sum, r) => sum + getRowAmount(r), 0);
    const totalTransfer = materialRows.reduce((sum, r) => sum + getRowTransferAmount(r), 0);
    const catMaterial = materialRows.reduce((sum, r) => sum + getRowCategoryAmount(r, "ค่าของ"), 0);
    const catFuel = materialRows.reduce((sum, r) => sum + getRowCategoryAmount(r, "น้ำมัน"), 0);
    const catRepair = materialRows.reduce((sum, r) => sum + getRowCategoryAmount(r, "ซ่อมรถ"), 0);
    const catMachine = materialRows.reduce((sum, r) => sum + getRowCategoryAmount(r, "เครื่องจักร"), 0);
    const catTool = materialRows.reduce((sum, r) => sum + getRowCategoryAmount(r, "เครื่องมือ"), 0);
    const catOther = materialRows.reduce((sum, r) => sum + getRowCategoryAmount(r, "อื่นๆ"), 0);
    const vatTotal = materialRows.reduce((sum, r) => sum + (toNumber(r.vat) || 0), 0);

    return {
      count: materialRows.length,
      totalAmount,
      totalTransfer,
      catMaterial,
      catFuel,
      catRepair,
      catMachine,
      catTool,
      catOther,
      vatTotal,
    };
  }, [materialRows]);

  function calcNetLabor(r: SheetRow): number {
    const directLaborCol = toNumber(r["แรง"]);
    if (directLaborCol > 0) return directLaborCol;

    const baseLabor = toNumber(r["ค่าแรง"]) || getRowAmount(r);
    const status = String(r["statusค่าแรง"] || "").trim();
    const deduct = toNumber(r["หัก"]);

    if (status === "บริษัท") {
      return Math.round(baseLabor * 1.04 * 100) / 100;
    }
    if (deduct > 0) {
      return Math.round(baseLabor * (1 - deduct / 100) * 100) / 100;
    }
    return baseLabor;
  }

  // Metrics for Labor
  const laborMetrics = useMemo(() => {
    const totalLabor = laborRows.reduce((sum, r) => sum + (toNumber(r["ค่าแรง"]) || getRowAmount(r)), 0);
    const totalNetLabor = laborRows.reduce((sum, r) => sum + calcNetLabor(r), 0);
    const totalTransfer = laborRows.reduce((sum, r) => sum + getRowTransferAmount(r), 0);
    const totalOpenHire = laborRows.reduce((sum, r) => sum + toNumber(r["เปิดจ้าง"]), 0);
    const totalAccumPaid = laborRows.reduce((sum, r) => sum + toNumber(r["จ่ายสะสม"]), 0);
    const totalStaff = laborRows.reduce((sum, r) => sum + toNumber(r["พนักงาน"]), 0);
    const totalOther = laborRows.reduce((sum, r) => sum + toNumber(r["อื่นๆ"]), 0);

    return {
      count: laborRows.length,
      totalLabor,
      totalNetLabor,
      totalTransfer,
      totalOpenHire,
      totalAccumPaid,
      totalStaff,
      totalOther,
    };
  }, [laborRows]);

  // Metrics for Contractor
  const contractorMetrics = useMemo(() => {
    const totalLabor = contractorRows.reduce((sum, r) => sum + (toNumber(r["ค่าแรง"]) || getRowAmount(r)), 0);
    const totalTransfer = contractorRows.reduce((sum, r) => sum + getRowTransferAmount(r), 0);
    const totalOpenHire = contractorRows.reduce((sum, r) => sum + toNumber(r["เปิดจ้าง"]), 0);
    const totalAccumPaid = contractorRows.reduce((sum, r) => sum + toNumber(r["จ่ายสะสม"]), 0);
    const remaining = totalOpenHire - totalAccumPaid;

    return {
      count: contractorRows.length,
      totalLabor,
      totalTransfer,
      totalOpenHire,
      totalAccumPaid,
      remaining,
    };
  }, [contractorRows]);

  // Metrics for Store
  const storeMetrics = useMemo(() => {
    const totalAmount = storeRows.reduce((sum, r) => sum + getRowAmount(r), 0);
    const totalTransfer = storeRows.reduce((sum, r) => sum + getRowTransferAmount(r), 0);

    return {
      count: storeRows.length,
      totalAmount,
      totalTransfer,
    };
  }, [storeRows]);

  // Overall Financial Totals
  const paidRows = useMemo(() => {
    return searchFilteredRows.filter(isPaidBill);
  }, [searchFilteredRows]);

  const pendingRows = useMemo(() => {
    return searchFilteredRows.filter((r) => !isPaidBill(r) && isCommittedBill(r));
  }, [searchFilteredRows]);

  const totalPaidTransferAll = useMemo(() => {
    return paidRows.reduce((sum, r) => sum + getRowTransferAmount(r), 0);
  }, [paidRows]);

  const totalPendingTransferAll = useMemo(() => {
    return pendingRows.reduce((sum, r) => sum + getRowTransferAmount(r), 0);
  }, [pendingRows]);

  const totalTransferAll = useMemo(() => {
    return searchFilteredRows.reduce((sum, r) => sum + getRowTransferAmount(r), 0);
  }, [searchFilteredRows]);

  const totalBillAmountAll = useMemo(() => {
    return searchFilteredRows.reduce((sum, r) => sum + getRowAmount(r), 0);
  }, [searchFilteredRows]);

  // Entrepreneur VAT & Tax Calculator Computations
  const calcResults = useMemo(() => {
    const base = parseFloat(calcBaseAmount) || 0;
    const vatVal = (base * calcVatPercent) / 100;
    const whtVal = (base * calcWhtPercent) / 100;
    const netPayment = base + vatVal - whtVal;
    return { base, vatVal, whtVal, netPayment };
  }, [calcBaseAmount, calcVatPercent, calcWhtPercent]);

  // Entrepreneur Project Margin Computations
  const projectMarginResults = useMemo(() => {
    const contract = parseFloat(calcContractValue) || 0;
    const spent = totalPaidTransferAll;
    const remaining = contract - spent;
    const burnRate = contract > 0 ? (spent / contract) * 100 : 0;
    const estimatedMargin = contract > 0 ? ((contract - spent) / contract) * 100 : 0;
    return { contract, spent, remaining, burnRate, estimatedMargin };
  }, [calcContractValue, totalPaidTransferAll]);

  async function refreshData() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/dashboard?refresh=1", { cache: "no-store" });
      if (!response.ok) throw new Error("Refresh failed");
      const payload = await response.json();
      setDataRows(payload.dataRows || []);
      setProjectRows(payload.projectRows || []);
    } finally {
      setRefreshing(false);
    }
  }

  // Export CSV Functionality
  function handleExportCSV() {
    let csvContent = "";
    const filename = `report_${activeMainTab}_${new Date().toISOString().slice(0, 10)}.csv`;

    if (activeMainTab === "overview") {
      csvContent = "\uFEFFหมวดหมู่,จำนวนบิล,ยอดเงินรวม (บาท),ยอดโอนสุทธิ (บาท),สัดส่วน (%)\n";
      categoryMetrics.breakdown.forEach((cat) => {
        csvContent += `"${cat.label}",${cat.count},${cat.amount},${cat.transfer},${cat.percent.toFixed(2)}%\n`;
      });
    } else if (activeMainTab === "material") {
      csvContent = "\uFEFFลำดับ,ผู้เบิก,บิล,ร้านค้า,รายละเอียดงาน,รายการ,ประเภท,ค่าของ,VAT,น้ำมัน,ซ่อมรถ,เครื่องจักร,เครื่องมือ,อื่นๆ,โอนเงิน,ว/ด/ป\n";
      materialRows.forEach((r, i) => {
        csvContent += `${r["ลำดับ"] || i + 1},"${getRequesterDisplayName(r["ผู้เบิก"])}","${r["บิล"] || ""}","${r["ร้านค้า"] || r["ร้าน/บุคคล"] || ""}","${r["รายละเอียดงาน"] || ""}","${r["สินค้า/ทำงาน"] || ""}","${getRowCategory(r) || ""}",${getRowCategoryAmount(r, "ค่าของ")},"${r.vat || ""}",${getRowCategoryAmount(r, "น้ำมัน")},${getRowCategoryAmount(r, "ซ่อมรถ")},${getRowCategoryAmount(r, "เครื่องจักร")},${getRowCategoryAmount(r, "เครื่องมือ")},${getRowCategoryAmount(r, "อื่นๆ")},${getRowTransferAmount(r)},"${formatDateThai(r["ว/ด/ป"] || r["วันที่"])}"\n`;
      });
    } else if (activeMainTab === "labor") {
      csvContent = "\uFEFFลำดับ,ผู้เบิก,บิล,ผู้รับเหมา,รายละเอียดงาน,ประเภท,ค่าแรง,หัก,เปิดจ้าง,จ่ายสะสม,พนักงาน,อื่นๆ,โอนเงิน,ว/ด/ป\n";
      laborRows.forEach((r, i) => {
        const cInfo = getContractorInfo(r["id_Contractor"] || r["CW Code"] || r["ผู้รับเหมา"] || r["ร้าน/บุคคล"] || r["ชื่อผู้รับเหมา"]);
        const cName = cInfo.name !== "-" ? cInfo.name : String(r["ชื่อผู้รับเหมา"] || r["ร้าน/บุคคล"] || "").trim();
        csvContent += `${r["ลำดับ"] || i + 1},"${getRequesterDisplayName(r["ผู้เบิก"])}","${r["บิล"] || ""}","${cName}","${r["รายละเอียดงาน"] || ""}","${r["ประเภท"] || ""}",${toNumber(r["ค่าแรง"]) || getRowAmount(r)},"${r["หัก"] || ""}",${toNumber(r["เปิดจ้าง"])},${toNumber(r["จ่ายสะสม"])},${toNumber(r["พนักงาน"])},${toNumber(r["อื่นๆ"])},${getRowTransferAmount(r)},"${formatDateThai(r["ว/ด/ป"] || r["วันที่"])}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="w-full flex flex-col gap-4 p-4 sm:p-5 max-w-[1700px] mx-auto font-sans text-sm text-slate-800 print:p-0 font-normal">
      {/* 1. HEADER ROW */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 no-print">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <BarChart3 className="text-emerald-700" size={22} />
            <span>รายงานวิเคราะห์การเงินและต้นทุนโครงการ</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-normal">คำนวณและสรุปข้อมูลต้นทุนค่าของ ค่าแรง ภาษี และผู้รับเหมา</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setShowCalculator(!showCalculator)}
            className={`px-3 py-1.5 rounded-lg font-medium transition border cursor-pointer flex items-center gap-1.5 ${
              showCalculator
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            <Calculator size={14} />
            <span>{showCalculator ? "ปิดเครื่องคิดเลข" : "เครื่องมือคำนวณ"}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition cursor-pointer flex items-center gap-1.5"
            title="ดาวน์โหลดไฟล์ CSV"
          >
            <Download size={14} />
            <span>ส่งออก CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition cursor-pointer flex items-center gap-1.5"
            title="พิมพ์หน้ารายงาน"
          >
            <Printer size={14} />
            <span>พิมพ์</span>
          </button>

          <button
            type="button"
            onClick={refreshData}
            disabled={refreshing}
            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <RotateCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span>{refreshing ? "รีเฟรช..." : "รีเฟรช"}</span>
          </button>
        </div>
      </div>

      {/* 2. 4 TOP KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Net Transfer */}
        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-800 font-medium">ยอดโอนเงินจริง (Net Paid)</span>
            <div className="w-6 h-6 rounded-md bg-emerald-200/80 text-emerald-800 flex items-center justify-center">
              <Wallet size={14} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-emerald-950 mt-1">
            {money(totalPaidTransferAll)}
          </div>
          <div className="text-[11px] text-emerald-700 mt-0.5">
            เบิกแล้ว {paidRows.length} รายการ
            {pendingRows.length > 0 && (
              <span className="text-amber-700 font-normal ml-1">
                (รอเบิก {money(totalPendingTransferAll)})
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Total Bill Amount */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">ยอดเงินบิลรวม (Total Amount)</span>
            <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center">
              <Receipt size={14} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
            {money(totalBillAmountAll)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            ยอดก่อนหักภาษี / เงื่อนไข
          </div>
        </div>

        {/* Card 3: Total Materials & Supplies */}
        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-800 font-medium">รวมต้นทุนค่าของ & วัสดุ</span>
            <div className="w-6 h-6 rounded-md bg-amber-200/80 text-amber-800 flex items-center justify-center">
              <Package size={14} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-amber-950 mt-1">
            {money(materialMetrics.totalTransfer)}
          </div>
          <div className="text-[11px] text-amber-700 mt-0.5">
            {materialMetrics.count} รายการ ({totalTransferAll > 0 ? ((materialMetrics.totalTransfer / totalTransferAll) * 100).toFixed(1) : 0}%)
          </div>
        </div>

        {/* Card 4: Total Labor & Contractors */}
        <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-indigo-800 font-medium">รวมต้นทุนค่าแรง & ช่าง</span>
            <div className="w-6 h-6 rounded-md bg-indigo-200/80 text-indigo-800 flex items-center justify-center">
              <HardHat size={14} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-indigo-950 mt-1">
            {money(laborMetrics.totalTransfer)}
          </div>
          <div className="text-[11px] text-indigo-700 mt-0.5">
            {laborMetrics.count} รายการ ({totalTransferAll > 0 ? ((laborMetrics.totalTransfer / totalTransferAll) * 100).toFixed(1) : 0}%)
          </div>
        </div>
      </div>

      {/* 3. CALCULATOR DRAWER (Collapsible) */}
      {showCalculator && (
        <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3 font-normal shadow-sm no-print">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Calculator size={14} className="text-emerald-700" />
              <span>เครื่องมือช่วยคำนวณภาษีและประเมินผลกำไร</span>
            </h2>
            <button type="button" onClick={() => setShowCalculator(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
              <X size={15} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* VAT & WHT Calculator */}
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-3">
              <span className="font-semibold text-slate-700 block">1. คำนวณภาษี VAT 7% & หัก ณ ที่จ่าย (WHT)</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">ยอดก่อนภาษี (บาท)</label>
                  <input
                    type="number"
                    value={calcBaseAmount}
                    onChange={(e) => setCalcBaseAmount(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-xs font-normal px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">VAT (%)</label>
                  <select
                    value={calcVatPercent}
                    onChange={(e) => setCalcVatPercent(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 text-xs font-normal px-2 py-1.5 rounded-lg focus:outline-none"
                  >
                    <option value={7}>VAT 7%</option>
                    <option value={0}>ไม่มี VAT (0%)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">หัก ณ ที่จ่าย (%)</label>
                  <select
                    value={calcWhtPercent}
                    onChange={(e) => setCalcWhtPercent(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 text-xs font-normal px-2 py-1.5 rounded-lg focus:outline-none"
                  >
                    <option value={3}>หัก 3% (บริการ/ค่าแรง)</option>
                    <option value={1}>หัก 1% (ขนส่ง)</option>
                    <option value={5}>หัก 5% (ค่าเช่า)</option>
                    <option value={0}>ไม่หัก (0%)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                <div>
                  <span className="text-xs text-slate-400 block">+ ภาษีมูลค่าเพิ่ม</span>
                  <span className="font-semibold text-slate-900">+{money(calcResults.vatVal)}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">- หัก ณ ที่จ่าย</span>
                  <span className="font-semibold text-amber-600">-{money(calcResults.whtVal)}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">ยอดโอนจริงสุทธิ</span>
                  <span className="font-semibold text-emerald-700">{money(calcResults.netPayment)}</span>
                </div>
              </div>
            </div>

            {/* Burn Rate & Margin Estimator */}
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-3">
              <span className="font-semibold text-slate-700 block">2. คำนวณ Burn Rate & ประมาณการกำไรโครงการ</span>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-xs text-slate-500 block mb-1">มูลค่าสัญญาโครงการ (บาท)</label>
                  <input
                    type="number"
                    value={calcContractValue}
                    onChange={(e) => setCalcContractValue(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-xs font-normal px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-slate-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-500 block mb-1">เบิกจ่ายจริงแล้วสะสม</label>
                  <div className="w-full bg-white border border-slate-200 text-emerald-700 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center justify-between">
                    <span>{money(projectMarginResults.spent)}</span>
                    {totalPendingTransferAll > 0 && (
                      <span className="text-[10px] text-amber-600 font-normal">
                        (รอเบิก {money(totalPendingTransferAll)})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                <div>
                  <span className="text-xs text-slate-400 block">งบประมาณคงเหลือ</span>
                  <span className={`font-semibold ${projectMarginResults.remaining >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                    {money(projectMarginResults.remaining)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">อัตราใช้งบ (Burn Rate)</span>
                  <span className={`font-semibold ${projectMarginResults.burnRate > 90 ? "text-rose-600" : "text-slate-800"}`}>
                    {projectMarginResults.burnRate.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">ประมาณการกำไร</span>
                  <span className={`font-semibold ${projectMarginResults.estimatedMargin >= 0 ? "text-indigo-700" : "text-rose-600"}`}>
                    {projectMarginResults.estimatedMargin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. SINGLE UNIFIED SMART FILTER TOOLBAR (ควบคุมจากจุดเดียว ไม่ซ้ำซ้อน) */}
      <div className="border border-slate-200 rounded-xl p-3 bg-white flex flex-col lg:flex-row items-center justify-between gap-3 text-xs shadow-2xs no-print">
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Project Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">โครงการ:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-white border border-slate-300 text-xs font-normal text-slate-900 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-emerald-600 max-w-[210px] cursor-pointer"
            >
              <option value="all">ทุกโครงการ ({projectsList.length} โครงการ)</option>
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Requester Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">ผู้เบิก:</span>
            <select
              value={selectedRequester}
              onChange={(e) => setSelectedRequester(e.target.value)}
              className="bg-white border border-slate-300 text-xs font-normal text-slate-900 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-emerald-600 max-w-[190px] cursor-pointer"
            >
              <option value="all">ผู้เบิกทุกคน ({requestersList.length} คน)</option>
              {requestersList.map((r) => (
                <option key={r.val} value={r.val}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Context-Aware 3rd Dropdown */}
          {activeMainTab === "labor" && (
            <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
              <span className="font-semibold text-slate-700">ผู้รับเหมา/ช่าง:</span>
              <select
                value={selectedContractor}
                onChange={(e) => setSelectedContractor(e.target.value)}
                className="bg-white border border-slate-300 text-xs font-normal text-slate-900 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-emerald-600 max-w-[210px] cursor-pointer"
              >
                <option value="all">ผู้รับเหมาทุกคน ({contractorsDropdownList.length} ราย)</option>
                {contractorsDropdownList.map((c) => (
                  <option key={c.val} value={c.val}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeMainTab === "material" && (
            <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
              <span className="font-semibold text-slate-700">ร้านค้า/ซัพพลายเออร์:</span>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="bg-white border border-slate-300 text-xs font-normal text-slate-900 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-emerald-600 max-w-[210px] cursor-pointer"
              >
                <option value="all">ร้านค้าทั้งหมด ({storesList.length} ร้าน)</option>
                {storesList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeMainTab === "overview" && (
            <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
              <span className="font-semibold text-slate-700">หมวดหมู่:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-white border border-slate-300 text-xs font-normal text-slate-900 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-emerald-600 max-w-[190px] cursor-pointer"
              >
                <option value="all">ทุกหมวดหมู่ (8 หมวด)</option>
                {CATEGORIES_LIST.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Real-time Search Box */}
        <div className="relative flex items-center w-full sm:w-72">
          <Search size={14} className="absolute left-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาร้านค้า, ผู้รับเหมา, รายการ..."
            className="w-full bg-white border border-slate-300 text-xs pl-8 pr-7 py-1.5 rounded-lg focus:outline-none focus:border-emerald-600 font-normal placeholder:text-slate-400"
          />
          {searchTerm && (
            <button type="button" onClick={() => setSearchTerm("")} className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 5. 3 MAIN RE-STRUCTURED TABS (ชัดเจน ไม่ซอยย่อย ไม่ทับซ้อน) */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-medium no-print">
        <button
          type="button"
          onClick={() => setActiveMainTab("overview")}
          className={`px-4 py-2.5 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeMainTab === "overview"
              ? "border-emerald-700 text-emerald-800 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BarChart3 size={15} />
          <span>1. ภาพรวม 8 หมวดหมู่ ({searchFilteredRows.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab("material")}
          className={`px-4 py-2.5 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeMainTab === "material"
              ? "border-emerald-700 text-emerald-800 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Package size={15} />
          <span>2. สรุปค่าของ & ร้านค้า ({materialMetrics.count})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab("labor")}
          className={`px-4 py-2.5 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeMainTab === "labor"
              ? "border-emerald-700 text-emerald-800 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <HardHat size={15} />
          <span>3. สรุปค่าแรง & ผู้รับเหมา ({laborMetrics.count})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 📊 TAB 1: ภาพรวม & 8 หมวดหมู่ (OVERVIEW & CATEGORY BREAKDOWN)             */}
      {/* ========================================================================= */}
      {activeMainTab === "overview" && (
        <div className="space-y-4">
          {/* 8 Categories Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {categoryMetrics.breakdown.map((cat) => (
              <div
                key={cat.key}
                onClick={() => setSelectedCategory(selectedCategory === cat.key ? "all" : cat.key)}
                className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between gap-2 select-none ${
                  selectedCategory === cat.key
                    ? "border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-500 shadow-2xs"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 truncate">{cat.label}</span>
                  <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                    {cat.count} บิล
                  </span>
                </div>
                <div>
                  <div className="text-base font-bold text-slate-900">{money(cat.transfer)}</div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, cat.percent))}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                    <span>สัดส่วน</span>
                    <span className="font-semibold text-slate-600">{cat.percent.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Category Table */}
          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
            <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800">ตารางสรุปยอดแยกตาม 8 หมวดหมู่หลัก</span>
              <span className="font-semibold text-emerald-800">
                ยอดโอนรวมสุทธิ: {money(categoryFilteredTransferTotal)}
              </span>
            </div>

            <div className="overflow-auto max-h-[calc(100vh-280px)] relative">
              <table className="w-full text-left text-xs text-slate-700 border-collapse font-sans font-normal">
                <thead className="sticky top-0 z-20 bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 border-r border-slate-200">ลำดับ</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">ผู้เบิก</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">บิล</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">ชื่อร้านค้า/ผู้รับเหมา</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">รายละเอียดงาน / รายการ</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">ประเภทหมวด</th>
                    <th className="py-2.5 px-3 text-right border-r border-slate-200">ยอดเงินบิล</th>
                    <th className="py-2.5 px-3 text-right border-r border-slate-200 text-emerald-800">โอนเงิน</th>
                    <th className="py-2.5 px-3 text-center">ว/ด/ป</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categoryFilteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">ไม่พบรายการบิลในหมวดหมู่นี้</td>
                    </tr>
                  ) : (
                    categoryFilteredRows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition">
                        <td className="py-2 px-3 text-slate-500">{r["ลำดับ"] || i + 1}</td>
                        <td className="py-2 px-3 text-slate-900 font-medium">{getRequesterDisplayName(r["ผู้เบิก"])}</td>
                        <td className="py-2 px-3 text-slate-700 font-mono">{r["บิล"] || "-"}</td>
                        <td className="py-2 px-3 text-slate-900">{r["ร้านค้า"] || r["ผู้รับเหมา"] || r["ร้าน/บุคคล"] || "-"}</td>
                        <td className="py-2 px-3 text-slate-700">{r["สินค้า/ทำงาน"] || r["รายละเอียดงาน"] || "-"}</td>
                        <td className="py-2 px-3 text-emerald-700 font-medium">{getRowCategory(r) || "-"}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-800">{money(getRowAmount(r))}</td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-emerald-700 bg-emerald-50/40">
                          {money(getRowTransferAmount(r))}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-600 whitespace-nowrap">{formatDateThai(r["ว/ด/ป"] || r["วันที่"])}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {categoryFilteredRows.length > 0 && (
                  <tfoot className="sticky bottom-0 z-20 border-t-2 border-slate-300 bg-slate-100 font-semibold text-xs shadow-2xs">
                    <tr>
                      <td colSpan={6} className="py-2.5 px-3 text-slate-900 border-r border-slate-300">
                        รวมสุทธิ ({categoryFilteredRows.length} รายการ)
                      </td>
                      <td className="py-2.5 px-3 text-right border-r border-slate-300 font-mono">
                        {money(categoryFilteredBillTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-right border-r border-emerald-300 text-emerald-800 bg-emerald-100 font-mono">
                        {money(categoryFilteredTransferTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400">-</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📦 TAB 2: สรุปค่าของ & ร้านค้า (MATERIALS & STORES BREAKDOWN)              */}
      {/* ========================================================================= */}
      {activeMainTab === "material" && (
        <div className="space-y-3">
          {/* Sub-tab Pill Switcher */}
          <div className="flex items-center justify-between no-print">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setMaterialSubTab("bills")}
                className={`px-3 py-1 rounded-md transition font-medium cursor-pointer ${
                  materialSubTab === "bills"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                📋 รายบิลค่าของ ({materialMetrics.count})
              </button>
              <button
                type="button"
                onClick={() => setMaterialSubTab("stores")}
                className={`px-3 py-1 rounded-md transition font-medium cursor-pointer ${
                  materialSubTab === "stores"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                🏪 สรุปตามร้านค้า ({storesList.length})
              </button>
              <button
                type="button"
                onClick={() => setMaterialSubTab("product_categories")}
                className={`px-3 py-1 rounded-md transition font-medium cursor-pointer ${
                  materialSubTab === "product_categories"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                🏷️ สรุปตามประเภทสินค้า ({productCategoryList.length})
              </button>
            </div>

            <div className="text-xs text-slate-600 font-medium">
              โอนรวมค่าของ: <strong className="text-emerald-700">{money(materialMetrics.totalTransfer)}</strong>
            </div>
          </div>

          {/* Sub-view 1: Material Bills Table */}
          {materialSubTab === "bills" && (
            <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
              <div className="overflow-auto max-h-[calc(100vh-280px)] relative">
                <table className="w-full text-left text-xs text-slate-700 border-collapse font-sans font-normal">
                  <thead className="sticky top-0 z-20 bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 border-r border-slate-200">ลำดับ</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">ผู้เบิก</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">บิล</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">ชื่อร้านค้า</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">รายละเอียดงาน</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">รายการ</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">ประเภท</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200">ค่าของ</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200">VAT</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200">น้ำมัน</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200">ซ่อมรถ</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200">เครื่องจักร</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200">เครื่องมือ</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200">อื่นๆ</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200 text-emerald-800">โอนเงิน</th>
                      <th className="py-2.5 px-3 text-center">ว/ด/ป</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {materialRows.length === 0 ? (
                      <tr>
                        <td colSpan={16} className="py-8 text-center text-slate-400">ไม่พบรายการบิลค่าของ</td>
                      </tr>
                    ) : (
                      materialRows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition">
                          <td className="py-2 px-3 text-slate-500">{r["ลำดับ"] || i + 1}</td>
                          <td className="py-2 px-3 text-slate-900 font-medium">{getRequesterDisplayName(r["ผู้เบิก"])}</td>
                          <td className="py-2 px-3 text-slate-700 font-mono">{r["บิล"] || "-"}</td>
                          <td className="py-2 px-3 text-slate-900 font-medium">{r["ร้านค้า"] || r["ร้าน/บุคคล"] || r["ร้านค้า/ผู้รับเหมา"] || "-"}</td>
                          <td className="py-2 px-3 text-slate-700">{r["รายละเอียดงาน"] || "-"}</td>
                          <td className="py-2 px-3 text-slate-700">{r["สินค้า/ทำงาน"] || r["รายการ"] || "-"}</td>
                          <td className="py-2 px-3 text-indigo-700 font-medium">{getRowCategory(r) || "-"}</td>
                          <td className="py-2 px-3 text-right font-mono">{money(getRowCategoryAmount(r, "ค่าของ"))}</td>
                          <td className="py-2 px-3 text-right font-mono">{r.vat || "-"}</td>
                          <td className="py-2 px-3 text-right font-mono">{money(getRowCategoryAmount(r, "น้ำมัน"))}</td>
                          <td className="py-2 px-3 text-right font-mono">{money(getRowCategoryAmount(r, "ซ่อมรถ"))}</td>
                          <td className="py-2 px-3 text-right font-mono">{money(getRowCategoryAmount(r, "เครื่องจักร"))}</td>
                          <td className="py-2 px-3 text-right font-mono">{money(getRowCategoryAmount(r, "เครื่องมือ"))}</td>
                          <td className="py-2 px-3 text-right font-mono">{money(getRowCategoryAmount(r, "อื่นๆ"))}</td>
                          <td className="py-2 px-3 text-right font-mono font-medium text-emerald-700 bg-emerald-50/50">
                            {money(getRowTransferAmount(r))}
                          </td>
                          <td className="py-2 px-3 text-center text-slate-600 whitespace-nowrap">{formatDateThai(r["ว/ด/ป"] || r["วันที่"])}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {materialRows.length > 0 && (
                    <tfoot className="sticky bottom-0 z-20 border-t-2 border-slate-300 bg-slate-100 font-semibold text-xs shadow-2xs">
                      <tr>
                        <td colSpan={7} className="py-2.5 px-3 text-slate-900 border-r border-slate-300">
                          รวมสุทธิ ({materialRows.length} รายการ)
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 font-mono text-emerald-800">
                          {money(materialMetrics.catMaterial)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 font-mono">
                          {materialMetrics.vatTotal > 0 ? money(materialMetrics.vatTotal) : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 font-mono">
                          {money(materialMetrics.catFuel)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 font-mono">
                          {money(materialMetrics.catRepair)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 font-mono">
                          {money(materialMetrics.catMachine)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 font-mono">
                          {money(materialMetrics.catTool)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 font-mono">
                          {money(materialMetrics.catOther)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-emerald-300 text-emerald-800 bg-emerald-100 font-mono">
                          {money(materialMetrics.totalTransfer)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-400">-</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Sub-view 2: Stores Summary Table */}
          {materialSubTab === "stores" && (
            <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
              <div className="overflow-auto max-h-[calc(100vh-280px)] relative">
                <table className="w-full text-left text-xs text-slate-700 border-collapse font-sans font-normal">
                  <thead className="sticky top-0 z-20 bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 border-r border-slate-200">ลำดับ</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">ชื่อร้านค้า / ซัพพลายเออร์</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">รายละเอียดงาน / สินค้า</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200">ยอดเงินบิล</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200 text-emerald-800">โอนเงิน</th>
                      <th className="py-2.5 px-3 text-center">ว/ด/ป</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {storeRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">ไม่พบรายการของร้านค้านี้</td>
                      </tr>
                    ) : (
                      storeRows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition">
                          <td className="py-2 px-3 text-slate-500">{r["ลำดับ"] || i + 1}</td>
                          <td className="py-2 px-3 text-slate-900 font-medium">{r["ร้านค้า"] || r["ร้าน/บุคคล"] || r["ร้านค้า/ผู้รับเหมา"] || "-"}</td>
                          <td className="py-2 px-3 text-slate-700">{r["สินค้า/ทำงาน"] || r["รายละเอียดงาน"] || "-"}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-800">{money(getRowAmount(r))}</td>
                          <td className="py-2 px-3 text-right font-mono font-medium text-emerald-700 bg-emerald-50/50">
                            {money(getRowTransferAmount(r))}
                          </td>
                          <td className="py-2 px-3 text-center text-slate-600 whitespace-nowrap">{formatDateThai(r["ว/ด/ป"] || r["วันที่"])}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {storeRows.length > 0 && (
                    <tfoot className="sticky bottom-0 z-20 border-t-2 border-slate-300 bg-slate-100 font-semibold text-xs shadow-2xs">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3 text-slate-900 border-r border-slate-300">
                          รวมสุทธิร้านค้า ({storeRows.length} รายการ)
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 font-mono">
                          {money(storeMetrics.totalAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-emerald-300 text-emerald-800 bg-emerald-100 font-mono">
                          {money(storeMetrics.totalTransfer)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-400">-</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Sub-view 3: Product Categories Summary */}
          {materialSubTab === "product_categories" && (
            <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
              <div className="overflow-auto max-h-[calc(100vh-280px)] relative">
                <table className="w-full text-left text-xs text-slate-700 border-collapse font-sans font-normal">
                  <thead className="sticky top-0 z-20 bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 border-r border-slate-200">ลำดับ</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">ผู้เบิก</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">บิล</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">ชื่อร้านค้า/ผู้รับเหมา</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">รายละเอียดงาน / รายการ</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">ประเภท</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200">ยอดเงินบิล</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200 text-emerald-800">โอนเงิน</th>
                      <th className="py-2.5 px-3 text-center">ว/ด/ป</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productCategoryFilteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">ไม่พบรายการในประเภทสินค้านี้</td>
                      </tr>
                    ) : (
                      productCategoryFilteredRows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition">
                          <td className="py-2 px-3 text-slate-500">{r["ลำดับ"] || i + 1}</td>
                          <td className="py-2 px-3 text-slate-900 font-medium">{getRequesterDisplayName(r["ผู้เบิก"])}</td>
                          <td className="py-2 px-3 text-slate-700 font-mono">{r["บิล"] || "-"}</td>
                          <td className="py-2 px-3 text-slate-900">{r["ร้านค้า"] || r["ผู้รับเหมา"] || r["ร้าน/บุคคล"] || "-"}</td>
                          <td className="py-2 px-3 text-slate-700">{r["สินค้า/ทำงาน"] || r["รายละเอียดงาน"] || "-"}</td>
                          <td className="py-2 px-3 text-teal-700 font-medium">{getRowCategory(r) || "-"}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-800">{money(getRowAmount(r))}</td>
                          <td className="py-2 px-3 text-right font-mono font-medium text-emerald-700 bg-emerald-50/50">
                            {money(getRowTransferAmount(r))}
                          </td>
                          <td className="py-2 px-3 text-center text-slate-600 whitespace-nowrap">{formatDateThai(r["ว/ด/ป"] || r["วันที่"])}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {productCategoryFilteredRows.length > 0 && (
                    <tfoot className="sticky bottom-0 z-20 border-t-2 border-slate-300 bg-slate-100 font-semibold text-xs shadow-2xs">
                      <tr>
                        <td colSpan={6} className="py-2.5 px-3 text-slate-900 border-r border-slate-300">
                          รวมสุทธิ ({productCategoryFilteredRows.length} รายการ)
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 font-mono">
                          {money(productCategoryBillTotal)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-emerald-300 text-emerald-800 bg-emerald-100 font-mono">
                          {money(productCategoryTransferTotal)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-400">-</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 👷‍♂️ TAB 3: สรุปค่าแรง & ผู้รับเหมา (LABOR & CONTRACTORS BREAKDOWN)          */}
      {/* ========================================================================= */}
      {activeMainTab === "labor" && (
        <div className="space-y-3">
          {/* Sub-tab Pill Switcher */}
          <div className="flex items-center justify-between no-print">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setLaborSubTab("bills")}
                className={`px-3 py-1 rounded-md transition font-medium cursor-pointer ${
                  laborSubTab === "bills"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                📋 รายบิลค่าแรง ({laborMetrics.count})
              </button>
              <button
                type="button"
                onClick={() => setLaborSubTab("contractors")}
                className={`px-3 py-1 rounded-md transition font-medium cursor-pointer ${
                  laborSubTab === "contractors"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                👷‍♂️ สรุปตามผู้รับเหมา ({contractorsDropdownList.length})
              </button>
            </div>

            <div className="text-xs text-slate-600 font-medium">
              โอนรวมค่าแรง: <strong className="text-emerald-700">{money(laborMetrics.totalTransfer)}</strong>
            </div>
          </div>

          {/* Sub-view 1: Labor Bills Table */}
          {laborSubTab === "bills" && (
            <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
              <div className="overflow-auto max-h-[calc(100vh-280px)] relative">
                <table className="w-full text-left text-xs text-slate-700 border-collapse font-sans font-normal whitespace-nowrap">
                  <thead className="sticky top-0 z-20 bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-2.5 border-r border-slate-200 text-center w-12">ลำดับ</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">ผู้เบิก</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">บิล</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">ผู้รับเหมา / ช่าง</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">รายละเอียดงาน</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">ประเภท</th>
                      <th className="py-2.5 px-2.5 text-right border-r border-slate-200 text-slate-900">ค่าแรง</th>
                      <th className="py-2.5 px-2 border-r border-slate-200 text-center">หัก</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">statusค่าแรง</th>
                      <th className="py-2.5 px-2.5 text-right border-r border-slate-200">แรง</th>
                      <th className="py-2.5 px-2.5 text-right border-r border-slate-200">เปิดจ้าง</th>
                      <th className="py-2.5 px-2.5 text-right border-r border-slate-200">จ่ายสะสม</th>
                      <th className="py-2.5 px-2.5 text-right border-r border-slate-200">พนักงาน</th>
                      <th className="py-2.5 px-2.5 text-right border-r border-slate-200">อื่นๆ</th>
                      <th className="py-2.5 px-2.5 text-right border-r border-slate-200 text-emerald-800">โอนเงิน</th>
                      <th className="py-2.5 px-2.5 text-center">ว/ด/ป</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {laborRows.length === 0 ? (
                      <tr>
                        <td colSpan={16} className="py-8 text-center text-slate-400">ไม่พบรายการบิลค่าแรง</td>
                      </tr>
                    ) : (
                      laborRows.map((r, i) => {
                        const laborAmt = toNumber(r["ค่าแรง"]) || getRowAmount(r);
                        const transferAmt = getRowTransferAmount(r);
                        const openHire = toNumber(r["เปิดจ้าง"]);
                        const accumPaid = toNumber(r["จ่ายสะสม"]);
                        const staffAmt = toNumber(r["พนักงาน"]);
                        const otherAmt = toNumber(r["อื่นๆ"]);
                        const rawContractor = String(r["id_Contractor"] || r["CW Code"] || r["ผู้รับเหมา"] || r["ร้าน/บุคคล"] || r["ชื่อผู้รับเหมา"] || "").trim();
                        const cInfo = getContractorInfo(rawContractor);
                        const contractorName = cInfo.name !== "-" ? cInfo.name : String(r["ชื่อผู้รับเหมา"] || r["ร้าน/บุคคล"] || rawContractor || "-").trim();
                        const laborStatus = String(r["statusค่าแรง"] || "").trim() || "บุคคลธรรมดา";

                        return (
                          <tr key={i} className="hover:bg-slate-50 transition">
                            <td className="py-2 px-2.5 text-center text-slate-500">{r["ลำดับ"] || i + 1}</td>
                            <td className="py-2 px-2.5 text-slate-900 font-medium">{getRequesterDisplayName(r["ผู้เบิก"])}</td>
                            <td className="py-2 px-2.5 text-slate-700 font-mono">{r["บิล"] || "-"}</td>
                            <td className="py-2 px-2.5 text-slate-900 font-medium">{contractorName}</td>
                            <td className="py-2 px-2.5 text-slate-700">{r["รายละเอียดงาน"] || r["สินค้า/ทำงาน"] || "-"}</td>
                            <td className="py-2 px-2.5 text-indigo-700 font-medium">{getRowCategory(r) || "-"}</td>
                            <td className="py-2 px-2.5 text-right font-mono font-medium text-slate-900">{money(laborAmt)}</td>
                            <td className="py-2 px-2 text-center text-amber-700 font-mono">{r["หัก"] ? `${r["หัก"]}%` : "-"}</td>
                            <td className="py-2 px-2.5 text-slate-600 text-[11px]">{laborStatus}</td>
                            <td className="py-2 px-2.5 text-right font-mono">{r["แรง"] ? money(toNumber(r["แรง"])) : "-"}</td>
                            <td className="py-2 px-2.5 text-right font-mono">{openHire > 0 ? money(openHire) : "-"}</td>
                            <td className="py-2 px-2.5 text-right font-mono">{accumPaid > 0 ? money(accumPaid) : "-"}</td>
                            <td className="py-2 px-2.5 text-right font-mono">{staffAmt > 0 ? money(staffAmt) : "-"}</td>
                            <td className="py-2 px-2.5 text-right font-mono">{otherAmt > 0 ? money(otherAmt) : "-"}</td>
                            <td className="py-2 px-2.5 text-right font-mono font-medium text-emerald-700 bg-emerald-50/50">
                              {money(transferAmt)}
                            </td>
                            <td className="py-2 px-2.5 text-center text-slate-600 whitespace-nowrap">{formatDateThai(r["ว/ด/ป"] || r["วันที่"])}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {laborRows.length > 0 && (
                    <tfoot className="sticky bottom-0 z-20 border-t-2 border-slate-300 bg-slate-100 font-semibold text-xs shadow-2xs">
                      <tr>
                        <td colSpan={6} className="py-2.5 px-3 text-slate-900 border-r border-slate-300">
                          รวมสุทธิ ({laborRows.length} รายการ)
                        </td>
                        <td className="py-2.5 px-2.5 text-right border-r border-slate-300 font-mono text-slate-900">
                          {money(laborMetrics.totalLabor)}
                        </td>
                        <td colSpan={2} className="py-2.5 px-2 border-r border-slate-300 text-center text-slate-400">-</td>
                        <td className="py-2.5 px-2.5 text-right border-r border-slate-300 font-mono">
                          {money(laborMetrics.totalNetLabor)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right border-r border-slate-300 font-mono">
                          {money(laborMetrics.totalOpenHire)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right border-r border-slate-300 font-mono">
                          {money(laborMetrics.totalAccumPaid)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right border-r border-slate-300 font-mono">
                          {money(laborMetrics.totalStaff)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right border-r border-slate-300 font-mono">
                          {money(laborMetrics.totalOther)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right border-r border-emerald-300 text-emerald-800 bg-emerald-100 font-mono">
                          {money(laborMetrics.totalTransfer)}
                        </td>
                        <td className="py-2.5 px-2.5 text-center text-slate-400">-</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Sub-view 2: Contractors Summary Table */}
          {laborSubTab === "contractors" && (
            <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
              <div className="overflow-auto max-h-[calc(100vh-280px)] relative">
                <table className="w-full text-left text-xs text-slate-700 border-collapse font-sans font-normal">
                  <thead className="sticky top-0 z-20 bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 border-r border-slate-200">ลำดับ</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">ชื่อผู้รับเหมา / ช่าง</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">รายละเอียดงาน</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200">เปิดจ้าง</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200">ค่าแรง</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200 text-emerald-800">โอนเงิน</th>
                      <th className="py-2.5 px-3 text-center">ว/ด/ป</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contractorRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">ไม่พบรายการของผู้รับเหมาท่านนี้</td>
                      </tr>
                    ) : (
                      contractorRows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition">
                          <td className="py-2 px-3 text-slate-500">{r["ลำดับ"] || i + 1}</td>
                          <td className="py-2 px-3 text-slate-900 font-medium">
                            {r["ชื่อผู้รับเหมา"] || r["ผู้รับเหมา"] || r["ร้าน/บุคคล"] || "-"}
                          </td>
                          <td className="py-2 px-3 text-slate-700">{r["รายละเอียดงาน"] || r["สินค้า/ทำงาน"] || "-"}</td>
                          <td className="py-2 px-3 text-right font-mono">{money(toNumber(r["เปิดจ้าง"]))}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-900">{money(toNumber(r["ค่าแรง"]) || getRowAmount(r))}</td>
                          <td className="py-2 px-3 text-right font-mono font-medium text-emerald-700 bg-emerald-50/50">
                            {money(getRowTransferAmount(r))}
                          </td>
                          <td className="py-2 px-3 text-center text-slate-600 whitespace-nowrap">{formatDateThai(r["ว/ด/ป"] || r["วันที่"])}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {contractorRows.length > 0 && (
                    <tfoot className="sticky bottom-0 z-20 border-t-2 border-slate-300 bg-slate-100 font-semibold text-xs shadow-2xs">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3 text-slate-900 border-r border-slate-300">
                          รวมสุทธิผู้รับเหมา ({contractorRows.length} รายการ)
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 font-mono">
                          {money(contractorMetrics.totalOpenHire)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 font-mono">
                          {money(contractorMetrics.totalLabor)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-emerald-300 text-emerald-800 bg-emerald-100 font-mono">
                          {money(contractorMetrics.totalTransfer)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-400">-</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
