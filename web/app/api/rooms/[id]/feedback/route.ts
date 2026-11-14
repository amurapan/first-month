import {
  authorize,
  body,
  database,
  failure,
  HttpError,
  json,
  limit,
} from "@/lib/room";
import { feedbackKinds, feedbackScreens, ownFeedback } from "@/lib/feedback";
const validId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    value,
  );
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params,
      { role } = await authorize(request, id);
    return json({ feedback: await ownFeedback(id, role) });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params,
      input = await body(request),
      { role, room } = await authorize(request, id);
    if (!validId(input.id))
      throw new HttpError(
        400,
        "The feedback reference is invalid. Reopen the form and try again.",
      );
    if (input.action === "remove") {
      // Idempotent deletion; the other role can never delete an author's feedback.
      await database()
        .prepare(
          "DELETE FROM product_feedback WHERE id = ? AND room_id = ? AND role = ?",
        )
        .bind(input.id, id, role)
        .run();
      return json({ feedback: await ownFeedback(id, role) });
    }
    if (
      input.action !== "create" ||
      !feedbackKinds.includes(input.kind as any) ||
      !feedbackScreens.includes(input.screen as any)
    )
      throw new HttpError(400, "Choose a feedback category and try again.");
    if (
      typeof input.message !== "string" ||
      input.message.trim().length < 5 ||
      input.message.trim().length > 2000
    )
      throw new HttpError(400, "Write between 5 and 2,000 characters.");
    const message = input.message.trim();
    const previous = await database()
      .prepare(
        "SELECT room_id, role, kind, screen, message FROM product_feedback WHERE id = ?",
      )
      .bind(input.id)
      .first<{
        room_id: string;
        role: string;
        kind: string;
        screen: string;
        message: string;
      }>();
    if (previous) {
      if (
        previous.room_id !== id ||
        previous.role !== role ||
        previous.kind !== input.kind ||
        previous.screen !== input.screen ||
        previous.message !== message
      )
        throw new HttpError(
          409,
          "This feedback reference was already used. Close and reopen the form for a new message.",
        );
      return json({ feedback: await ownFeedback(id, role) });
    }
    await limit(
      `feedback:${id}:${role}:${new Date().toISOString().slice(0, 10)}`,
      5,
    );
    const result = await database()
      .prepare(
        "INSERT OR IGNORE INTO product_feedback (id, room_id, role, kind, screen, message, demo, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM rooms WHERE id = ?) AND (SELECT COUNT(*) FROM product_feedback WHERE room_id = ? AND role = ?) < 50",
      )
      .bind(
        input.id,
        id,
        role,
        input.kind,
        input.screen,
        message,
        room.demo ? 1 : 0,
        new Date().toISOString(),
        id,
        id,
        role,
      )
      .run();
    if (!result.meta.changes) {
      const duplicate = (await ownFeedback(id, role)).find(
        (x) => x.id === input.id,
      );
      if (
        !duplicate ||
        duplicate.message !== message ||
        duplicate.kind !== input.kind ||
        duplicate.screen !== input.screen
      )
        throw new HttpError(
          409,
          "Your space changed or its feedback storage is full. Remove an older message, then try again.",
        );
    }
    return json({ feedback: await ownFeedback(id, role) });
  } catch (error) {
    return failure(error);
  }
}
