import { MainDashboard } from "@/components/dashboards/DashboardsServer";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const liffState = params?.["liff.state"];
  if (liffState && typeof liffState === "string") {
    try {
      const decoded = decodeURIComponent(liffState);
      if (decoded.startsWith("/") && !decoded.startsWith("//")) {
        redirect(decoded);
      }
    } catch (_) {}
  }

  return <MainDashboard />;
}

