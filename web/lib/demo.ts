import { captureBaseline } from "./months";
import type { HouseholdMonth } from "./month-types";
import { commitmentLedger, projectOption } from "./domain/planning.js";
import { calculate } from "./room";
import type { Room } from "./room";
import { weekStart } from "./domain/life.js";
import type { HouseholdDecision, HouseholdReview } from "./life-types";
// Seed inputs only in explicitly labelled, newly created fictional households.
export async function seedDemo(db: D1Database, roomId: string, room: Room) {
  const now = new Date().toISOString(),
    decision: HouseholdDecision = {
      id: crypto.randomUUID(),
      title: "A sofa for our living room",
      kind: "purchase",
      amount: 90000,
      context:
        "Our old sofa is worn out. We want something comfortable while keeping room for our summer trip.",
      creator: "A",
      status: "open",
      createdAt: now,
      updatedAt: now,
      answers: {
        A: {
          limit: 60000,
          timing: "now",
          note: "I would enjoy having it soon, but I am open to a plan that leaves us both comfortable.",
          shared: true,
          updatedAt: now,
        },
        B: {
          limit: 25000,
          timing: "save",
          note: "I want the sofa too. I would rather save a little each month so our trip stays possible.",
          shared: true,
          updatedAt: now,
        },
      },
      proposal: null,
      resolutions: [],
    };
  const trip: HouseholdDecision = {
    id: crypto.randomUUID(),
    title: "A weekend away",
    kind: "purchase",
    amount: 120000,
    context:
      "A trip we both want to keep saving for while furnishing our home.",
    creator: "B",
    status: "agreed",
    createdAt: now,
    updatedAt: now,
    answers: {
      A: {
        limit: 25000,
        timing: "save",
        note: "Keep a little room for travel.",
        shared: true,
        updatedAt: now,
      },
      B: {
        limit: 15000,
        timing: "save",
        note: "A small amount each month works for me.",
        shared: true,
        updatedAt: now,
      },
    },
    proposal: {
      amount: 120000,
      months: 4,
      method: "proportional",
      customA: 0,
      notes: "Save together before booking.",
      reviewDate: now.slice(0, 10),
      planVersion: room.planVersion,
      version: 1,
      author: "B",
      approvals: { A: "accepted", B: "accepted" },
      commitmentKey: commitmentLedger(
        [decision],
        room.expenses.map((x) => x.id),
      ).key,
    },
    resolutions: [],
    activeResolutionVersion: 1,
    funding: { A: 0, B: 0 },
  };
  const allocation = projectOption(
    {
      item: trip,
      decisions: [],
      expenseIds: [],
      incomes: [room.partners.A.income, room.partners.B.income],
      baseRemaining: calculate(room).remainingCents,
      refined: [true, true],
      reserves: [room.partners.A.reserve, room.partners.B.reserve],
      limits: [25000, 15000],
    },
    trip.proposal!,
  );
  trip.resolutions.push({
    at: now,
    planVersion: room.planVersion,
    title: trip.title,
    kind: trip.kind,
    amount: trip.amount,
    months: 4,
    contributions: allocation.contributions,
    firstMonth: allocation.firstMonth,
    notes: trip.proposal!.notes,
    reviewDate: trip.proposal!.reviewDate,
    method: "proportional",
    version: 1,
  });
  const week = weekStart(),
    review: HouseholdReview = {
      id: roomId + ":" + week,
      week,
      answers: {
        A: {
          feeling: "comfortable",
          worked: "We talked before buying things for the apartment.",
          change: "I would like a clearer plan for replacing the sofa.",
          shared: true,
          updatedAt: now,
        },
        B: {
          feeling: "mixed",
          worked: "The shared bill routine felt simpler.",
          change:
            "I want us to keep some room for our trip while making the apartment comfortable.",
          shared: true,
          updatedAt: now,
        },
      },
      action: null,
    };
  const period = now.slice(0, 7),
    day = now.slice(0, 10);
  const month: HouseholdMonth = {
    period,
    baseline: captureBaseline(room),
    entries: [
      {
        id: crypto.randomUUID(),
        kind: "expense",
        amount: 240000,
        paidA: 240000,
        categoryId: room.expenses[0].id,
        title: room.expenses[0].label,
        date: day,
        author: "A",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        kind: "expense",
        amount: 26000,
        paidA: 0,
        categoryId: room.expenses[1].id,
        title: room.expenses[1].label,
        date: day,
        author: "B",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        kind: "expense",
        amount: 32000,
        paidA: 0,
        categoryId: room.expenses[2].id,
        title: "Groceries for our first two weeks",
        date: day,
        author: "B",
        createdAt: now,
        updatedAt: now,
      },
    ],
    version: 1,
    status: "open",
    approvals: { A: false, B: false },
    reopen: {},
    history: [],
    settlements: [],
    createdAt: now,
    updatedAt: now,
  };
  await db.batch([
    db
      .prepare(
        "INSERT INTO household_months (id,room_id,period,data,revision,updated_at) VALUES (?,?,?,?,1,?)",
      )
      .bind(roomId + ":" + period, roomId, period, JSON.stringify(month), now),
    db
      .prepare(
        "INSERT INTO household_decisions (id,room_id,data,revision,created_at,updated_at) VALUES (?,?,?,1,?,?)",
      )
      .bind(trip.id, roomId, JSON.stringify(trip), now, now),
    db
      .prepare(
        "INSERT INTO household_decisions (id,room_id,data,revision,created_at,updated_at) VALUES (?,?,?,1,?,?)",
      )
      .bind(decision.id, roomId, JSON.stringify(decision), now, now),
    db
      .prepare(
        "INSERT INTO household_reviews (id,room_id,week,data,revision,updated_at) VALUES (?,?,?,?,1,?)",
      )
      .bind(review.id, roomId, week, JSON.stringify(review), now),
  ]);
}
