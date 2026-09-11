import { renderViewForId } from "@/lib/views-render";

type MasterTableViewProps = {
  viewId: string;
  searchParams?: Record<string, string | string[] | undefined>;
};

export async function MasterTableView({ viewId, searchParams }: MasterTableViewProps) {
  return await renderViewForId(viewId, searchParams);
}

