export type RowValue = string | number | boolean | null | Record<string, any>;

export interface BaseEntity {
  id: string | number;
  _sheetRow?: string | number;
  created_at?: string;
  updated_at?: string;
  data?: Record<string, any>;
  [key: string]: any;
}

export interface ProjectEntity extends BaseEntity {
  id: string; // ID Project (e.g. "530")
  "ID Project"?: string;
  "ชื่อ Project"?: string;
  name?: string;
  "งบไม่เกิน"?: number;
  budget?: number;
  "ยอดงาน"?: number;
  work_amount?: number;
  color?: string;
}

export interface BillEntity extends BaseEntity {
  id: number; // ลำดับบิล
  "ลำดับ"?: number | string;
  "ID Project"?: string;
  project_id?: string;
  "ยอดเงิน"?: number;
  amount?: number;
  "สถานะ"?: string;
  status?: string;
  "ประเภท"?: string;
  category?: string;
}

export type TableRow = Record<string, any>;
export type SheetRow = TableRow;

export type FieldType =
  | "Text"
  | "LongText"
  | "Number"
  | "Decimal"
  | "Date"
  | "Enum"
  | "EnumList"
  | "Ref"
  | "Image"
  | "File"
  | "Hidden";

export type ShowIf = {
  column: string;
  equals?: string;
  in?: string[];
  notBlank?: boolean;
};

export type FieldSchema = {
  name: string;
  type: FieldType;
  key?: boolean;
  required?: boolean;
  readonly?: boolean;
  readonlyOnEdit?: boolean;
  initialValue?: string;
  values?: string[];
  inputMode?: "buttons" | "dropdown";
  refTable?: string;
  refKey?: string;
  refLabel?: string;
  validIf?: string;
  showIf?: ShowIf;
  description?: string;
  dynamicValues?: string;
  dynamicOptionSets?: Record<string, string[]>;
  refFill?: Record<string, string>;
  filterBy?: {
    field: string;
    column: string;
    openContract?: boolean;
  };
};

export type ViewConfig = {
  id: string;
  name: string;
  type: "dashboard" | "table" | "detail";
  table?: string;
  sourceTable?: string;
  position: "first" | "next" | "last" | "menu" | "task";
  items?: string[];
};

export type RefOption = {
  value: RowValue;
  label: string;
  row?: SheetRow;
};

export type CompanySettings = {
  companyName: string;
  companySubTitle: string;
  logoUrl: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
};

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: "",
  companySubTitle: "",
  logoUrl: "",
  taxId: "",
  address: "",
  phone: "",
  email: "",
};

