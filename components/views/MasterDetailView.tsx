import { renderRowDetailPage } from "@/lib/views-render";

type MasterDetailViewProps = {
  viewId: string;
  rowKey: string;
};

export async function MasterDetailView({ viewId, rowKey }: MasterDetailViewProps) {
  return await renderRowDetailPage(viewId, rowKey);
}

