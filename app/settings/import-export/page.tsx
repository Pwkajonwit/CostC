import { DataHubClient } from "@/components/settings/DataHubClient";

export const metadata = {
  title: "ศูนย์นำเข้าและส่งออกข้อมูล (Data Import & Export Center) | CostLab",
  description: "จัดการนำเข้าไฟล์ CSV ส่งออกข้อมูลสำรอง และดาวน์โหลดตัวอย่างเทมเพลตสำหรับทุกตารางในระบบ"
};

export default function ImportExportSettingsPage() {
  return <DataHubClient />;
}
