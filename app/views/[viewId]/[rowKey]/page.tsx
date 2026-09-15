import { MasterDetailView } from "@/components/views/MasterDetailView";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ viewId: string; rowKey: string }>;
};

export default async function GenericViewDetailPage({ params }: PageProps) {
  const { viewId, rowKey } = await params;
  if (viewId === "project-all") {
    redirect(`/work-status/${rowKey}`);
  }
  return <MasterDetailView viewId={viewId} rowKey={rowKey} />;
}
