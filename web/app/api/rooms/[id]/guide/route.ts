import { env } from "cloudflare:workers";
import {
  authorize,
  body,
  calculate,
  failure,
  findRoom,
  HttpError,
  json,
  limit,
  save,
  shared,
} from "@/lib/room";
import type { Room } from "@/lib/room";
import {
  guideProvider,
  generateGuide,
  formatGuide,
  GuideError,
} from "@/lib/guide.js";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const input = await body(request);
    const { id } = await context.params;
    const { row, room } = await authorize(request, id);
    if (!shared(room))
      throw new HttpError(
        400,
        "Both people need to share before making a conversation guide.",
      );
    if (room.guide?.version === room.planVersion)
      return json({ text: room.guide.text });
    const provider = guideProvider(env);
    if (input.revision !== row.revision)
      throw new HttpError(
        409,
        "Your plan changed. Refresh before making a guide.",
      );
    if (room.guideCount >= 8)
      throw new HttpError(
        429,
        "You have reached the guide limit for this plan. Your saved guides and plan remain available.",
      );
    await limit("guides:" + new Date().toISOString().slice(0, 10), 100);
    room.guideCount += 1;
    await save(row, room);
    const calculated = calculate(room);
    const guideInput = {
      partners: [room.partners.A, room.partners.B].map((person, index) => ({
        name: person.name,
        priority: person.priority,
        note: person.concern,
        preferenceMet: calculated.minimumRemainingMet[index],
      })),
      sharedExpenseCategories: room.expenses.map((expense) => expense.label),
      allSharedExpensesCovered: true,
      personalRemaindersAreNotSharedMoney: true,
      proposedMethod: room.plan.method,
    };
    const text = formatGuide(
      guideInput,
      await generateGuide(provider, guideInput),
    );
    const latest = await findRoom(id),
      latestRoom = JSON.parse(latest.data) as Room;
    if (latestRoom.planVersion !== room.planVersion || !shared(latestRoom))
      throw new HttpError(
        409,
        "Your plan changed while the guide was being prepared. Please make a new guide for the current version.",
      );
    latestRoom.guide = { version: room.planVersion, text: text.slice(0, 8000) };
    await save(latest, latestRoom);
    return json({ text });
  } catch (error) {
    return failure(
      error instanceof GuideError
        ? new HttpError(error.status, error.message)
        : error,
    );
  }
}
