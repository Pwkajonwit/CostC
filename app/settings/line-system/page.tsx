import { LineSystemDashboardClient } from "@/components/dashboards/LineSystemDashboardClient";

export const dynamic = "force-dynamic";

export default function SettingsLineSystemPage() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <LineSystemDashboardClient />
    </div>
  );
}

