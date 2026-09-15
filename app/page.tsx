import { MainDashboard } from "@/components/dashboards/DashboardsServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  return <MainDashboard />;
}

