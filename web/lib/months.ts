import { z } from "zod";
import { authorize, body, database, HttpError, limit, shared } from "./room";
import type { Room, Role } from "./room";
import type {
  HouseholdMonth,
  MonthBaseline,
  MonthEntry,
  MonthView,
} from "./month-types";
import {
  changeMonth,
  currentMonth,
  currentSettlement,
  monthTotals,
  refundable,
} from "./domain/month.js";
type Row = {
  id: string;
  room_id: string;
  period: string;
  data: string;
  revision: number;
  updated_at: string;
};
const cents = z.number().int().min(0).max(100_000_000);
const periodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .refine(
    (x) => x >= "2020-01" && x <= currentMonth(),
    "Choose this month or an earlier month.",
  );
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (x) =>
      Number.isFinite(Date.parse(x)) &&
      new Date(x).toISOString().slice(0, 10) === x &&
      x <= new Date().toISOString().slice(0, 10),
    "Choose a real date, no later than today.",
  );
const entrySchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["expense", "refund", "transfer"]),
  amount: cents.refine((x) => x > 0, "Enter an amount above zero."),
  paidA: cents,
  categoryId: z.string().max(100).default("other"),
  title: z.string().trim().min(1).max(100),
  date: day,
  originalId: z.string().optional(),
});
export function captureBaseline(room: Room, equal = false): MonthBaseline {
  const a = room.partners.A,
    b = room.partners.B,
    total = room.expenses.reduce((n, x) => n + x.amount, 0),
    method = equal ? "equal" : room.plan.method;
  const weights =
    method === "equal"
      ? [1, 1]
      : method === "proportional"
        ? [a.income, b.income]
        : [room.plan.customA, total - room.plan.customA];
  if (weights.some((x) => x < 0) || weights[0] + weights[1] === 0)
    throw new HttpError(
      400,
      "This split needs positive amounts. Choose an equal split for this month or update your monthly plan.",
    );
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a),
    divisor = gcd(weights[0], weights[1]);
  return {
    planVersion: room.planVersion,
    capturedAt: new Date().toISOString(),
    names: [a.name, b.name],
    expenses: structuredClone(room.expenses),
    method,
    weights: weights.map((x) => x / divisor),
    sourceConfirmed:
      !equal &&
      room.decisions.A === "accepted" &&
      room.decisions.B === "accepted",
  };
}
export async function monthViews(
  roomId: string,
  visible: boolean,
): Promise<MonthView[]> {
  if (!visible) return [];
  const rows = await database()
    .prepare(
      "SELECT * FROM household_months WHERE room_id = ? ORDER BY period DESC LIMIT 120",
    )
    .bind(roomId)
    .all<Row>();
  return rows.results.map((r) => ({
    ...JSON.parse(r.data),
    revision: r.revision,
  }));
}
async function saveMonth(
  row: Row,
  item: HouseholdMonth,
  parentRevision: number,
) {
  const data = JSON.stringify(item),
    now = new Date().toISOString();
  const result = await database().batch([
    database()
      .prepare(
        "UPDATE household_months SET data = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND room_id = ? AND revision = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND revision = ?)",
      )
      .bind(
        data,
        now,
        row.id,
        row.room_id,
        row.revision,
        row.room_id,
        parentRevision,
      ),
    database()
      .prepare(
        "UPDATE rooms SET revision = revision + 1 WHERE id = ? AND revision = ? AND EXISTS (SELECT 1 FROM household_months WHERE id = ? AND room_id = ? AND revision = ? AND data = ?)",
      )
      .bind(
        row.room_id,
        parentRevision,
        row.id,
        row.room_id,
        row.revision + 1,
        data,
      ),
  ]);
  if (!result[0].meta.changes)
    throw new HttpError(
      409,
      "Your month changed. Review the latest entries before saving.",
    );
}
function ensureOpen(item: HouseholdMonth) {
  if (item.status !== "open")
    throw new HttpError(
      400,
      "This month is confirmed. Both people must reopen it before changing entries.",
    );
}
export async function mutateMonth(request: Request, roomId: string) {
  const input = await body(request),
    { row: parent, room, role } = await authorize(request, roomId),
    period = periodSchema.parse(input.period),
    now = new Date().toISOString();
  if (!shared(room))
    throw new HttpError(
      400,
      "Both people need to share their numbers to use the monthly review.",
    );
  await limit("months:" + roomId + ":" + now.slice(0, 13), 240);
  const row = await database()
    .prepare("SELECT * FROM household_months WHERE room_id = ? AND period = ?")
    .bind(roomId, period)
    .first<Row>();
  if (input.action === "start") {
    if (row) return;
    if (input.roomRevision !== parent.revision)
      throw new HttpError(
        409,
        "Your plan changed. Review it before starting this month.",
      );
    const count = await database()
      .prepare(
        "SELECT COUNT(*) AS count FROM household_months WHERE room_id = ?",
      )
      .bind(roomId)
      .first<{ count: number }>();
    if ((count?.count || 0) >= 120)
      throw new HttpError(
        400,
        "This space has reached its 120-month limit. Your saved history remains available.",
      );
    const baseline = captureBaseline(room, input.split === "equal");
    const item: HouseholdMonth = {
      period,
      baseline,
      entries: [],
      version: 1,
      status: "open",
      approvals: { A: false, B: false },
      reopen: {},
      history: [],
      settlements: [],
      createdAt: now,
      updatedAt: now,
    };
    const id = roomId + ":" + period,
      data = JSON.stringify(item);
    const result = await database().batch([
      database()
        .prepare(
          "INSERT INTO household_months (id,room_id,period,data,revision,updated_at) SELECT ?,?,?,?,1,? WHERE EXISTS (SELECT 1 FROM rooms WHERE id = ? AND revision = ?)",
        )
        .bind(id, roomId, period, data, now, roomId, parent.revision),
      database()
        .prepare(
          "UPDATE rooms SET revision = revision + 1 WHERE id = ? AND revision = ? AND EXISTS (SELECT 1 FROM household_months WHERE id = ? AND data = ?)",
        )
        .bind(roomId, parent.revision, id, data),
    ]);
    if (!result[0].meta.changes)
      throw new HttpError(
        409,
        "Your plan changed. Try starting the month again.",
      );
    return;
  }
  if (!row) throw new HttpError(404, "Start this month before adding entries.");
  const item = JSON.parse(row.data) as HouseholdMonth;
  // A stable client ID makes retrying a successful add safe after a network interruption.
  if (input.action === "add" && input.entry?.id) {
    const existing = item.entries.find((x) => x.id === input.entry.id);
    if (existing) {
      const candidate = entrySchema.parse(input.entry);
      if (existing.author !== role)
        throw new HttpError(403, "This entry belongs to your partner.");
      const fields = [
        "kind",
        "amount",
        "paidA",
        "title",
        "date",
        "originalId",
      ] as const;
      if (
        fields.some((k) => existing[k] !== candidate[k]) ||
        (candidate.kind === "expense" &&
          existing.categoryId !== candidate.categoryId)
      )
        throw new HttpError(
          409,
          "That saved entry is different. Edit it instead of adding it again.",
        );
      return;
    }
  }
  if (input.roomRevision !== parent.revision || input.revision !== row.revision)
    throw new HttpError(
      409,
      "Your partner updated the space. Review the latest month before saving.",
    );
  if (input.action === "add" || input.action === "edit") {
    ensureOpen(item);
    const data = entrySchema.parse(input.entry),
      existing = item.entries.find((x) => x.id === data.id);
    if (input.action === "edit" && !existing)
      throw new HttpError(404, "This entry no longer exists.");
    if (
      existing &&
      input.action === "edit" &&
      input.expectedUpdatedAt !== existing.updatedAt
    )
      throw new HttpError(
        409,
        "This entry changed on another device. Reopen it to review the saved details before editing.",
      );
    if (
      existing &&
      (existing.author !== role || existing.locked || existing.confirmed)
    )
      throw new HttpError(
        403,
        "Only your own unconfirmed entries can be edited.",
      );
    if (existing && existing.kind !== data.kind)
      throw new HttpError(400, "Keep the entry type when editing.");
    if (existing && item.entries.some((x) => x.originalId === existing.id))
      throw new HttpError(
        400,
        "Remove the related refund first, or add another expense for the difference.",
      );
    if (item.entries.length >= 250 && !existing)
      throw new HttpError(
        400,
        "This month has reached 250 entries. You can still review and export them.",
      );
    if (data.date.slice(0, 7) !== period)
      throw new HttpError(400, "Use a date within this month.");
    if (data.paidA > data.amount)
      throw new HttpError(
        400,
        "The amount covered by the first person cannot exceed the total.",
      );
    if (data.kind === "transfer") {
      if (data.paidA !== (role === "A" ? data.amount : 0))
        throw new HttpError(
          400,
          "You can record a transfer that you sent. Your partner confirms receiving it.",
        );
      data.categoryId = "transfer";
      data.originalId = undefined;
    } else if (data.kind === "refund") {
      const original = item.entries.find(
        (x) => x.id === data.originalId && x.kind === "expense",
      );
      const available = refundable(
        item.entries.filter((x) => x.id !== data.id),
        data.originalId || "",
      );
      if (!original || data.amount > available)
        throw new HttpError(
          400,
          "The refund must reference an expense and cannot exceed its unrefunded amount.",
        );
      if (data.date < original.date)
        throw new HttpError(
          400,
          "A refund cannot come before its original expense.",
        );
      data.categoryId = original.categoryId;
    } else {
      if (
        !item.baseline.expenses.some((x) => x.id === data.categoryId) &&
        data.categoryId !== "other"
      )
        throw new HttpError(400, "Choose a category in this month’s plan.");
      data.originalId = undefined;
    }
    const entry: MonthEntry = {
      ...data,
      author: role,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      ...(data.kind === "transfer" ? { confirmed: false } : {}),
    };
    item.entries = existing
      ? item.entries.map((x) => (x.id === data.id ? entry : x))
      : [...item.entries, entry];
    changeMonth(item);
  } else if (input.action === "remove") {
    ensureOpen(item);
    const e = item.entries.find((x) => x.id === input.entryId);
    if (!e) throw new HttpError(404, "This entry no longer exists.");
    if (e.author !== role || e.confirmed || e.locked)
      throw new HttpError(
        403,
        "Only your own unconfirmed entries can be removed. Confirmed transfers stay in the record.",
      );
    if (item.entries.some((x) => x.originalId === e.id))
      throw new HttpError(
        400,
        "Remove the related refund before removing this expense.",
      );
    item.entries = item.entries.filter((x) => x.id !== e.id);
    changeMonth(item);
  } else if (
    input.action === "confirmTransfer" ||
    input.action === "rejectTransfer"
  ) {
    ensureOpen(item);
    const e = item.entries.find(
      (x) => x.id === input.entryId && x.kind === "transfer",
    );
    if (!e) throw new HttpError(404, "That transfer is no longer available.");
    if (e.author === role)
      throw new HttpError(
        403,
        "The receiving partner needs to confirm the transfer.",
      );
    if (e.confirmed)
      throw new HttpError(400, "This transfer was already confirmed.");
    if (input.action === "rejectTransfer")
      item.entries = item.entries.filter((x) => x.id !== e.id);
    else {
      e.confirmed = true;
      e.confirmedAt = now;
      e.updatedAt = now;
    }
    changeMonth(item);
  } else if (input.action === "refreshPlan") {
    ensureOpen(item);
    const baseline = captureBaseline(room, input.split === "equal");
    // Keep retired categories available for entries already recorded this month.
    for (const old of item.baseline.expenses)
      if (
        !baseline.expenses.some((x) => x.id === old.id) &&
        item.entries.some((x) => x.categoryId === old.id)
      )
        baseline.expenses.push({ ...old, amount: 0 });
    item.baseline = baseline;
    changeMonth(item);
  } else if (input.action === "approve") {
    ensureOpen(item);
    if (!item.entries.some((x) => x.kind === "expense"))
      throw new HttpError(
        400,
        "Add at least one shared expense before confirming the month.",
      );
    if (monthTotals(item).pending)
      throw new HttpError(
        400,
        "Confirm or remove pending transfers before agreeing to this month.",
      );
    if (item.history.length >= 12)
      throw new HttpError(
        400,
        "This month has reached its 12-version history limit. Your earlier records remain available.",
      );
    item.approvals[role] = true;
    if (item.approvals.A && item.approvals.B) {
      item.status = "agreed";
      item.reopen = {};
      item.history.push({
        version: item.version,
        baseline: structuredClone(item.baseline),
        entries: structuredClone(item.entries),
        agreedAt: now,
        approvals: { A: true, B: true },
      });
    }
  } else if (input.action === "withdrawApproval") {
    ensureOpen(item);
    item.approvals[role] = false;
  } else if (input.action === "reportSettlement") {
    if (item.status !== "agreed")
      throw new HttpError(400, "Both people need to confirm the month first.");
    const balance = monthTotals(item).balance,
      from: Role = balance > 0 ? "A" : "B";
    if (!balance) throw new HttpError(400, "This month is already balanced.");
    if (role !== from)
      throw new HttpError(
        403,
        "The person sending the money reports this transfer.",
      );
    if (currentSettlement(item))
      throw new HttpError(400, "This settlement is already recorded.");
    item.settlements.push({
      version: item.version,
      from,
      amount: Math.abs(balance),
      reportedAt: now,
    });
  } else if (
    ["receiveSettlement", "rejectSettlement", "withdrawSettlement"].includes(
      input.action,
    )
  ) {
    const receipt = currentSettlement(item);
    if (item.status !== "agreed" || !receipt || receipt.receivedAt)
      throw new HttpError(400, "There is no pending settlement to update.");
    if ((input.action === "withdrawSettlement") !== (receipt.from === role))
      throw new HttpError(
        403,
        "Only the sender can withdraw a report; only the recipient can confirm or reject it.",
      );
    if (input.action === "receiveSettlement") receipt.receivedAt = now;
    else item.settlements = item.settlements.filter((x) => x !== receipt);
  } else if (input.action === "requestReopen") {
    if (item.status !== "agreed")
      throw new HttpError(400, "This month is already open.");
    if (item.history.length >= 12)
      throw new HttpError(
        400,
        "This month has reached its 12-version history limit.",
      );
    const receipt = currentSettlement(item);
    if (receipt && !receipt.receivedAt)
      throw new HttpError(
        400,
        "Resolve the pending settlement report before reopening this month.",
      );
    item.reopen[role] = true;
    if (item.reopen.A && item.reopen.B) {
      if (receipt?.receivedAt) {
        if (item.entries.length >= 250)
          throw new HttpError(
            400,
            "There is no room to carry the confirmed settlement into this month.",
          );
        item.entries.push({
          id: "settlement:" + item.version,
          kind: "transfer",
          amount: receipt.amount,
          paidA: receipt.from === "A" ? receipt.amount : 0,
          categoryId: "transfer",
          title: "Confirmed settlement from version " + item.version,
          date: receipt.receivedAt.slice(0, 10),
          author: receipt.from,
          createdAt: receipt.reportedAt,
          updatedAt: receipt.receivedAt,
          confirmed: true,
          confirmedAt: receipt.receivedAt,
          locked: true,
        });
      }
      item.status = "open";
      changeMonth(item);
    }
  } else if (input.action === "cancelReopen") {
    if (item.status !== "agreed")
      throw new HttpError(400, "This month is already open.");
    delete item.reopen[role];
  } else throw new HttpError(400, "Unknown monthly review action.");
  monthTotals(item);
  item.updatedAt = now;
  await saveMonth(row, item, parent.revision);
}
