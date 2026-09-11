import { WithdrawDashboard } from "@/components/dashboards/DashboardsServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type WithdrawRequestPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WithdrawRequestPage({ searchParams }: WithdrawRequestPageProps) {
  const query = await searchParams;
  const requester = firstSearchParam(query?.requester).trim();
  const date = firstSearchParam(query?.date).trim();
  const bill = firstSearchParam(query?.bill).trim();
  const search = firstSearchParam(query?.search).trim();

  return (
    <WithdrawDashboard
      filters={{
        requester: requester || undefined,
        date: date || undefined,
        bill: bill || undefined,
        search: search || undefined,
      }}
    />
  );
}

function firstSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

