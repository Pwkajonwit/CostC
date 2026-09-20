import { LineSystemDashboardClient } from "@/components/dashboards/LineSystemDashboardClient";

export const dynamic = "force-dynamic";

export default function SettingsLineSystemPage() {
  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-3 p-2.5 sm:p-4 font-sans text-slate-800 antialiased pb-12">
      <LineSystemDashboardClient />
    </div>
  );
}

