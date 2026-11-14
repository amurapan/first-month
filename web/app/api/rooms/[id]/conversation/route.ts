import { failure, HttpError, json } from "@/lib/room";
import { conversation } from "@/lib/conversation";
import { GuideError } from "@/lib/guide.js";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return json(await conversation(request, (await context.params).id));
  } catch (error) {
    return failure(
      error instanceof GuideError
        ? new HttpError(error.status, error.message)
        : error,
    );
  }
}
