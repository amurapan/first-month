import { failure, json } from "@/lib/room";
import { mutateMonth } from "@/lib/months";
import { workspace } from "@/lib/life";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await mutateMonth(request, id);
    return json(await workspace(request, id));
  } catch (error) {
    return failure(error);
  }
}
