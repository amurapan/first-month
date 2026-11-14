import {
  body,
  database,
  failure,
  hash,
  HttpError,
  json,
  limit,
} from "@/lib/room";
import type { Room } from "@/lib/room";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params,
      input = await body(request);
    if (
      typeof input.invite !== "string" ||
      !/^[a-f0-9]{64}$/.test(input.invite)
    )
      throw new HttpError(
        410,
        "This invitation is no longer available. Ask your partner for a new link.",
      );
    await limit(
      "invite-preview:" +
        new Date().toISOString().slice(0, 13) +
        ":" +
        (await hash(request.headers.get("cf-connecting-ip") || "local")),
      120,
    );
    const row = await database()
      .prepare(
        "SELECT data FROM rooms WHERE id = ? AND invite = ? AND token_b IS NULL",
      )
      .bind(id, await hash(input.invite))
      .first<{ data: string }>();
    if (!row)
      throw new HttpError(
        410,
        "This invitation has already been used or replaced. Return with your saved personal link, or ask your partner for a new invitation.",
      );
    const room = JSON.parse(row.data) as Room;
    // An invitation preview deliberately never uses the household view projection.
    return json({
      inviterName: room.partners.A.name,
      startingPlanReady: room.partners.A.submitted,
    });
  } catch (error) {
    return failure(error);
  }
}
