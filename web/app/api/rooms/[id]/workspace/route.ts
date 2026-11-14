import { failure, json } from "@/lib/room";
import { workspace, mutateWorkspace } from "@/lib/life";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return json(await workspace(request, (await context.params).id));
  } catch (error) {
    return failure(error);
  }
}
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return json(await mutateWorkspace(request, (await context.params).id));
  } catch (error) {
    return failure(error);
  }
}
