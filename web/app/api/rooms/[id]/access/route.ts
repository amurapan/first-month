import {
  authorize,
  body,
  database,
  failure,
  hash,
  HttpError,
  json,
  token,
} from "@/lib/room";
import { workspace, reviewView } from "@/lib/life";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params,
      input = await body(request),
      { row, room, role } = await authorize(request, id);
    if (input.action === "export") {
      const result = await workspace(request, id);
      const reviews = await database()
        .prepare(
          "SELECT * FROM household_reviews WHERE room_id = ? ORDER BY week DESC",
        )
        .bind(id)
        .all<any>();
      const history = await database()
        .prepare(
          "SELECT data FROM plan_history WHERE room_id = ? ORDER BY plan_version DESC",
        )
        .bind(id)
        .all<{ data: string }>();
      return json({
        format: "first-month-export-v1",
        exportedAt: new Date().toISOString(),
        ...result,
        householdReviews: reviews.results.map((r) =>
          reviewView(r, room, role, result.months),
        ),
        planHistory: result.bothShared
          ? history.results.map((x) => JSON.parse(x.data))
          : [],
      });
    }
    if (input.revision !== row.revision)
      throw new HttpError(
        409,
        "Your space changed. Refresh before continuing.",
      );
    if (input.action === "rotate") {
      const access = token(),
        column = role === "A" ? "token_a" : "token_b";
      const result = await database()
        .prepare(
          "UPDATE rooms SET " +
            column +
            " = ?, revision = revision + 1 WHERE id = ? AND revision = ?",
        )
        .bind(await hash(access), id, row.revision)
        .run();
      if (!result.meta.changes)
        throw new HttpError(409, "Your space changed. Try again.");
      return json({ token: access });
    }
    if (input.action === "delete") {
      if (input.confirmation !== "DELETE")
        throw new HttpError(
          400,
          "Type DELETE to confirm removal for both people.",
        );
      const tables = [
        "household_decisions",
        "household_reviews",
        "plan_history",
        "household_months",
      ];
      const statements = tables.map((table) =>
        database()
          .prepare(
            "DELETE FROM " +
              table +
              " WHERE room_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND revision = ?)",
          )
          .bind(id, id, row.revision),
      );
      statements.push(
        database()
          .prepare("DELETE FROM rooms WHERE id = ? AND revision = ?")
          .bind(id, row.revision),
      );
      const results = await database().batch(statements);
      if (!results.at(-1)?.meta.changes)
        throw new HttpError(
          409,
          "Your partner updated the space. Review their changes before deleting.",
        );
      return json({ deleted: true });
    }
    throw new HttpError(400, "Unknown access action.");
  } catch (error) {
    return failure(error);
  }
}
