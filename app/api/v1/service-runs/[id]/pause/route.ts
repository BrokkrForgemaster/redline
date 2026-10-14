import { applyPauseResume } from "@/lib/api/visit-pause-resume";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return applyPauseResume(request, (await params).id, "pause");
}
