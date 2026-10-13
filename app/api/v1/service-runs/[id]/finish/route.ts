import { applyVisitLifecycle } from "@/lib/api/visit-lifecycle";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return applyVisitLifecycle(request, id, "finish");
}
