import { MasterTableView } from "@/components/views/MasterTableView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ viewId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GenericViewPage({ params, searchParams }: PageProps) {
  const { viewId } = await params;
  const query = await searchParams;
  return <MasterTableView viewId={viewId} searchParams={query} />;
}
