import { WorkStatusDashboard } from "@/components/dashboards/DashboardsServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function WorkStatusPage() {
  return <WorkStatusDashboard />;
}

