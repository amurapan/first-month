import { currentMonth } from "./domain/month.js";
import type { MonthView } from "./month-types";
import { monthViews } from "./months";
import { z } from "zod";
import {
  authorize,
  body,
  calculate,
  database,
  HttpError,
  limit,
  shared,
  view,
} from "./room";
import type { Room, Role } from "./room";
import {
  activeResolution,
  commitmentLedger,
  planningMonth,
  projectOption,
  projectAgreement,
} from "./domain/planning.js";
import {
  approvalTransition,
  bothAnswersShared,
  decisionImpact,
  decisionStale,
  redactAnswers,
  resetProposal,
  weekStart,
} from "./domain/life.js";
import type {
  DecisionView,
  HouseholdDecision,
  HouseholdReview,
  ReviewView,
  PlanSnapshot,
} from "./life-types";
type RecordRow = {
  id: string;
  room_id: string;
  data: string;
  revision: number;
  created_at?: string;
  updated_at: string;
};
const amount = z.number().int().min(0).max(100_000_000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      Number.isFinite(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Choose a valid date.",
  );
const answerSchema = z.object({
  limit: amount.nullable(),
  timing: z.enum(["now", "save", "flexible"]),
  note: z.string().trim().max(1500),
  shared: z.boolean(),
});
export function decisionView(
  row: RecordRow,
  room: Room,
  role: Role,
  decisions: HouseholdDecision[] = [],
): DecisionView {
  const item = JSON.parse(row.data) as HouseholdDecision,
    visible = shared(room) && bothAnswersShared(item);
  return {
    ...item,
    answers: redactAnswers(item, role, visible),
    revision: row.revision,
    bothAnswered: visible,
    stale:
      decisionStale(item, room.planVersion) ||
      (!!item.proposal &&
        item.status === "open" &&
        item.proposal.commitmentKey !==
          commitmentLedger(
            decisions,
            room.expenses.map((x) => x.id),
            item.id,
          ).key),
    guide:
      visible &&
      item.guide?.key === room.planVersion + ":" + row.revision &&
      item.guide.contextKey ===
        commitmentLedger(
          decisions,
          room.expenses.map((x) => x.id),
          item.id,
        ).key
        ? item.guide.text
        : null,
  };
}
export function reviewView(
  row: RecordRow,
  room: Room,
  role: Role,
  months: MonthView[] = [],
): ReviewView {
  const item = JSON.parse(row.data) as HouseholdReview,
    visible = shared(room) && bothAnswersShared(item);
  return {
    ...item,
    answers: redactAnswers(item, role, visible),
    revision: row.revision,
    bothAnswered: visible,
    guide:
      visible &&
      item.guide?.key === room.planVersion + ":" + row.revision &&
      item.guide.contextKey ===
        currentMonth() +
          ":" +
          (months.find((m) => m.period === currentMonth())?.revision || 0)
        ? item.guide.text
        : null,
  };
}
export async function workspace(request: Request, id: string) {
  const { row, room, role } = await authorize(request, id);
  const [decisions, reviews, history, count, months] = await Promise.all([
    database()
      .prepare(
        "SELECT * FROM household_decisions WHERE room_id = ? ORDER BY updated_at DESC LIMIT 200",
      )
      .bind(id)
      .all<RecordRow>(),
    database()
      .prepare(
        "SELECT * FROM household_reviews WHERE room_id = ? ORDER BY week DESC LIMIT 104",
      )
      .bind(id)
      .all<RecordRow>(),
    database()
      .prepare(
        "SELECT data FROM plan_history WHERE room_id = ? ORDER BY plan_version DESC LIMIT 60",
      )
      .bind(id)
      .all<{ data: string }>(),
    database()
      .prepare(
        "SELECT COUNT(*) AS count FROM household_decisions WHERE room_id = ?",
      )
      .bind(id)
      .first<{ count: number }>(),
    monthViews(id, shared(room)),
  ]);
  const allDecisions = decisions.results.map(
    (x) => JSON.parse(x.data) as HouseholdDecision,
  );
  return {
    ...view(row, room, role),
    months,
    householdDecisions: decisions.results.map((x) =>
      decisionView(x, room, role, allDecisions),
    ),
    householdReviews: reviews.results.map((x) =>
      reviewView(x, room, role, months),
    ),
    decisionCount: count?.count || 0,
    planHistory: shared(room)
      ? history.results.map((x) => JSON.parse(x.data) as PlanSnapshot)
      : [],
    currentWeek: weekStart(),
  };
}
export async function getRecord(
  table: "household_decisions" | "household_reviews",
  roomId: string,
  id: string,
) {
  const row = await database()
    .prepare("SELECT * FROM " + table + " WHERE id = ? AND room_id = ?")
    .bind(id, roomId)
    .first<RecordRow>();
  if (!row)
    throw new HttpError(404, "This item is no longer available in your space.");
  return row;
}
export async function saveRecord(
  table: "household_decisions" | "household_reviews",
  row: RecordRow,
  item: HouseholdDecision | HouseholdReview,
  roomRevision: number,
) {
  const updatedAt = new Date().toISOString();
  const data = JSON.stringify(item);
  const update = database()
    .prepare(
      "UPDATE " +
        table +
        " SET data = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND room_id = ? AND revision = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND revision = ?)",
    )
    .bind(
      data,
      updatedAt,
      row.id,
      row.room_id,
      row.revision,
      row.room_id,
      roomRevision,
    );
  const result =
    table === "household_decisions"
      ? (
          await database().batch([
            update,
            database()
              .prepare(
                "UPDATE rooms SET revision = revision + 1 WHERE id = ? AND revision = ? AND EXISTS (SELECT 1 FROM household_decisions WHERE id = ? AND room_id = ? AND revision = ? AND data = ?)",
              )
              .bind(
                row.room_id,
                roomRevision,
                row.id,
                row.room_id,
                row.revision + 1,
                data,
              ),
          ])
        )[0]
      : await update.run();
  if (!result.meta.changes)
    throw new HttpError(
      409,
      "This item or your monthly plan changed. Review the latest version before saving.",
    );
  return {
    ...row,
    data: JSON.stringify(item),
    revision: row.revision + 1,
    updated_at: updatedAt,
  };
}
export async function householdRecords(id: string) {
  const rows = await database()
    .prepare("SELECT data FROM household_decisions WHERE room_id = ?")
    .bind(id)
    .all<{ data: string }>();
  return rows.results.map((x) => JSON.parse(x.data) as HouseholdDecision);
}
export function impactFor(
  room: Room,
  item: HouseholdDecision,
  decisions: HouseholdDecision[] = [],
  accepted = false,
) {
  if (!item.proposal) throw new HttpError(400, "Choose an option first.");
  const a = room.partners.A,
    b = room.partners.B,
    base = calculate(room);
  const context = {
    item,
    decisions,
    expenseIds: room.expenses.map((x) => x.id),
    incomes: [a.income, b.income],
    baseRemaining: base.remainingCents,
    refined: [a.refined !== false, b.refined !== false],
    reserves: [a.reserve, b.reserve],
    limits: [item.answers.A?.limit ?? null, item.answers.B?.limit ?? null],
  };
  return accepted
    ? projectAgreement(context)
    : projectOption(context, item.proposal);
}
function requireShared(room: Room) {
  if (!shared(room))
    throw new HttpError(
      400,
      "Both people need to share their income before comparing a joint decision.",
    );
}
export async function mutateWorkspace(request: Request, id: string) {
  const input = await body(request),
    { row: parent, room, role } = await authorize(request, id);
  if (parent.revision !== input.roomRevision)
    throw new HttpError(
      409,
      "Your monthly plan changed. Refresh before saving.",
    );
  await limit(
    "workspace:" + id + ":" + new Date().toISOString().slice(0, 13),
    180,
  );
  const now = new Date().toISOString();
  if (input.action === "createDecision") {
    const data = z
      .object({
        title: z.string().trim().min(1).max(100),
        kind: z.enum(["purchase", "recurring"]),
        amount,
        context: z.string().trim().max(1500),
      })
      .parse(input);
    const count = await database()
      .prepare(
        "SELECT COUNT(*) AS count FROM household_decisions WHERE room_id = ?",
      )
      .bind(id)
      .first<{ count: number }>();
    if ((count?.count || 0) >= 200)
      throw new HttpError(
        400,
        "This space has reached 200 decisions. Export your history before starting a new space.",
      );
    const item: HouseholdDecision = {
      ...data,
      id: crypto.randomUUID(),
      creator: role,
      status: "open",
      createdAt: now,
      updatedAt: now,
      answers: {},
      proposal: null,
      resolutions: [],
    };
    const saved = await database()
      .prepare(
        "INSERT INTO household_decisions (id,room_id,data,revision,created_at,updated_at) SELECT ?,?,?,1,?,? WHERE EXISTS (SELECT 1 FROM rooms WHERE id = ? AND revision = ?)",
      )
      .bind(item.id, id, JSON.stringify(item), now, now, id, parent.revision)
      .run();
    if (!saved.meta.changes)
      throw new HttpError(409, "Your space changed. Please try again.");
  } else if (
    [
      "answerDecision",
      "proposeDecision",
      "approveDecision",
      "completeDecision",
      "fundDecision",
      "applyRecurring",
      "archiveDecision",
      "reopenDecision",
    ].includes(input.action)
  ) {
    const row = await getRecord(
      "household_decisions",
      id,
      z.string().parse(input.id),
    );
    if (row.revision !== input.revision)
      throw new HttpError(
        409,
        "Your partner updated this decision. Review their changes first.",
      );
    let item = JSON.parse(row.data) as HouseholdDecision;
    const records = await householdRecords(id);
    const contextKey = commitmentLedger(
      records,
      room.expenses.map((x) => x.id),
      item.id,
    ).key;
    if (item.status === "completed")
      throw new HttpError(
        400,
        "Completed purchases stay in your history. Start a new decision for another purchase.",
      );
    if (
      ["completed", "archived"].includes(item.status) &&
      input.action !== "reopenDecision"
    )
      throw new HttpError(400, "Reopen this decision before changing it.");
    if (input.action === "answerDecision") {
      item.answers[role] = {
        ...answerSchema.parse(input.answer),
        updatedAt: now,
      };
      resetProposal(item);
      delete item.cancellation;
    } else if (input.action === "proposeDecision") {
      requireShared(room);
      if (!bothAnswersShared(item))
        throw new HttpError(
          400,
          "Both people need to share their answers first.",
        );
      const proposal = z
        .object({
          method: z.enum(["equal", "proportional", "custom"]),
          customA: amount,
          months: z.number().int().min(1).max(24),
          amount,
          notes: z.string().trim().max(1500),
          reviewDate: date,
        })
        .parse(input.proposal);
      item.proposal = {
        ...proposal,
        planVersion: room.planVersion,
        version: (item.proposal?.version || 0) + 1,
        author: role,
        approvals: { A: "pending", B: "pending" },
        commitmentKey: contextKey,
      };
      impactFor(room, item, records);
      delete item.cancellation;
      item.status = "open";
      delete item.guide;
    } else if (input.action === "approveDecision") {
      requireShared(room);
      if (
        input.decision === "accepted" &&
        item.proposal?.commitmentKey !== contextKey
      )
        throw new HttpError(
          409,
          "Other commitments or the planning month changed. Compare the updated options before agreeing.",
        );
      item = approvalTransition(
        item,
        role,
        input.decision,
        room.planVersion,
        input.proposalVersion,
      ) as HouseholdDecision;
      if (
        item.status === "agreed" &&
        !item.resolutions.some((x) => x.version === item.proposal!.version)
      ) {
        const impact = impactFor(room, item, records),
          p = item.proposal!;
        item.activeResolutionVersion = p.version;
        delete item.cancellation;
        item.resolutions.push({
          at: now,
          planVersion: room.planVersion,
          title: item.title,
          kind: item.kind,
          amount: p.amount,
          months: p.months,
          contributions: impact.contributions,
          firstMonth: impact.firstMonth,
          notes: p.notes,
          reviewDate: p.reviewDate,
          method: p.method,
          version: p.version,
        });
      }
    } else if (input.action === "fundDecision") {
      requireShared(room);
      if (
        item.kind !== "purchase" ||
        item.status !== "agreed" ||
        !item.proposal ||
        item.proposal.months < 2
      )
        throw new HttpError(400, "Confirm a savings proposal first.");
      const savedAmount = amount.parse(input.amount),
        resolution = activeResolution(item),
        index = role === "A" ? 0 : 1;
      if (!resolution)
        throw new HttpError(400, "Confirm a savings proposal first.");
      if (savedAmount > resolution.contributions[index])
        throw new HttpError(
          400,
          "Use an amount up to your agreed contribution.",
        );
      const currentMonth = planningMonth();
      const additions =
        item.fundingMonth === currentMonth
          ? item.fundedThisMonth || { A: 0, B: 0 }
          : { A: 0, B: 0 };
      item.fundedThisMonth = {
        ...additions,
        [role]: additions[role] + savedAmount - (item.funding?.[role] || 0),
      };
      item.fundingMonth = currentMonth;
      item.funding = {
        ...(item.funding || { A: 0, B: 0 }),
        [role]: savedAmount,
      };
      if (item.guide?.key === room.planVersion + ":" + row.revision)
        item.guide.key = room.planVersion + ":" + (row.revision + 1);
    } else if (input.action === "applyRecurring") {
      requireShared(room);
      if (
        item.kind !== "recurring" ||
        item.status !== "agreed" ||
        decisionStale(item, room.planVersion)
      )
        throw new HttpError(
          400,
          "Both people must agree to a current recurring-cost proposal first.",
        );
      const expenseId = "decision:" + item.id;
      if (room.expenses.some((x) => x.id === expenseId))
        throw new HttpError(
          400,
          "This recurring cost is already in your monthly plan.",
        );
      if (room.expenses.length >= 16)
        throw new HttpError(
          400,
          "Combine existing expense categories before adding another cost.",
        );
      const base = calculate(room),
        impact = impactFor(room, item, records);
      if (base.sharedCents + item.proposal!.amount > 100_000_000)
        throw new HttpError(
          400,
          "The monthly total must stay below $1,000,000.",
        );
      room.expenses.push({
        id: expenseId,
        label: item.title.slice(0, 60),
        amount: item.proposal!.amount,
      });
      room.plan = {
        ...room.plan,
        method: "custom",
        customA: base.contributionsCents[0] + impact.contributions[0],
      };
      room.planVersion += 1;
      room.decisions = { A: "pending", B: "pending" };
      delete room.guide;
      item.status = "completed";
      item.completedAt = now;
      item.updatedAt = now;
      const roomData = JSON.stringify(room);
      const result = await database().batch([
        database()
          .prepare(
            "UPDATE rooms SET data = ?, revision = revision + 1 WHERE id = ? AND revision = ? AND EXISTS (SELECT 1 FROM household_decisions WHERE id = ? AND room_id = ? AND revision = ?)",
          )
          .bind(roomData, id, parent.revision, item.id, id, row.revision),
        database()
          .prepare(
            "UPDATE household_decisions SET data = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND room_id = ? AND revision = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND revision = ? AND data = ?)",
          )
          .bind(
            JSON.stringify(item),
            now,
            item.id,
            id,
            row.revision,
            id,
            parent.revision + 1,
            roomData,
          ),
      ]);
      if (!result[0].meta.changes || !result[1].meta.changes)
        throw new HttpError(
          409,
          "Your plan or decision changed. Review it before adding the recurring cost.",
        );
      return workspace(request, id);
    } else if (input.action === "completeDecision") {
      requireShared(room);
      if (item.status !== "agreed" || decisionStale(item, room.planVersion))
        throw new HttpError(
          400,
          "Both people must agree to the current proposal before marking it complete.",
        );
      if (item.proposal!.months > 1) {
        const impact = activeResolution(item)!;
        if (
          (item.funding?.A || 0) < impact.contributions[0] ||
          (item.funding?.B || 0) < impact.contributions[1]
        )
          throw new HttpError(
            400,
            "Both people need to record their full saved contributions first.",
          );
      }
      item.status = "completed";
      item.completedAt = now;
    } else if (input.action === "archiveDecision") {
      if (activeResolution(item)) {
        item.cancellation = { ...item.cancellation, [role]: true };
        if (item.cancellation.A && item.cancellation.B) {
          item.status = "archived";
          item.activeResolutionVersion = null;
        }
      } else {
        item.status = "archived";
        item.activeResolutionVersion = null;
      }
    } else {
      item.status = "open";
      item.activeResolutionVersion = null;
      delete item.cancellation;
      resetProposal(item);
    }
    if (
      item.guide?.key === room.planVersion + ":" + row.revision &&
      ["approveDecision", "completeDecision", "archiveDecision"].includes(
        input.action,
      )
    )
      item.guide.key = room.planVersion + ":" + (row.revision + 1);
    item.updatedAt = now;
    await saveRecord("household_decisions", row, item, parent.revision);
  } else if (input.action === "answerReview") {
    const week = weekStart(),
      rid = id + ":" + week;
    const answer = z
      .object({
        feeling: z.enum(["comfortable", "mixed", "stretched"]),
        worked: z.string().trim().max(1200),
        change: z.string().trim().max(1200),
        shared: z.boolean(),
      })
      .parse(input.answer);
    const row = await database()
      .prepare("SELECT * FROM household_reviews WHERE id = ? AND room_id = ?")
      .bind(rid, id)
      .first<RecordRow>();
    if (row && row.revision !== input.revision)
      throw new HttpError(
        409,
        "Your partner updated this check-in. Refresh before saving.",
      );
    const item: HouseholdReview = row
      ? JSON.parse(row.data)
      : { id: rid, week, answers: {}, action: null };
    item.answers[role] = { ...answer, updatedAt: now };
    delete item.guide;
    if (item.action && !item.action.completed)
      item.action.approvals = { A: false, B: false };
    if (row) await saveRecord("household_reviews", row, item, parent.revision);
    else {
      const result = await database()
        .prepare(
          "INSERT OR IGNORE INTO household_reviews (id,room_id,week,data,revision,updated_at) SELECT ?,?,?,?,1,? WHERE EXISTS (SELECT 1 FROM rooms WHERE id = ? AND revision = ?)",
        )
        .bind(rid, id, week, JSON.stringify(item), now, id, parent.revision)
        .run();
      if (!result.meta.changes)
        throw new HttpError(
          409,
          "Your partner started this check-in. Refresh to add your answer.",
        );
    }
  } else if (
    ["reviewAction", "approveReview", "completeReview"].includes(input.action)
  ) {
    const row = await getRecord(
      "household_reviews",
      id,
      z.string().parse(input.id),
    );
    if (row.revision !== input.revision)
      throw new HttpError(
        409,
        "This check-in changed. Review the latest version.",
      );
    const item = JSON.parse(row.data) as HouseholdReview;
    requireShared(room);
    if (!bothAnswersShared(item))
      throw new HttpError(
        400,
        "Both people need to share their check-in first.",
      );
    if (input.action === "reviewAction") {
      const action = z
        .object({
          text: z.string().trim().min(1).max(500),
          owner: z.enum(["A", "B", "both"]),
          due: date,
        })
        .parse(input.nextAction);
      item.action = {
        ...action,
        approvals: { A: false, B: false },
        completed: false,
      };
    } else {
      if (!item.action)
        throw new HttpError(400, "Choose an action together first.");
      if (input.action === "approveReview") item.action.approvals[role] = true;
      else {
        if (!item.action.approvals.A || !item.action.approvals.B)
          throw new HttpError(
            400,
            "Both people must confirm this action first.",
          );
        item.action.completed = true;
      }
    }
    if (item.guide?.key === room.planVersion + ":" + row.revision)
      item.guide.key = room.planVersion + ":" + (row.revision + 1);
    await saveRecord("household_reviews", row, item, parent.revision);
  } else throw new HttpError(400, "Unknown household action.");
  return workspace(request, id);
}
