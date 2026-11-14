import { weekStart } from "./domain/life.js";
import type { HouseholdDecision, HouseholdReview } from "./life-types";
// Seed inputs only in explicitly labelled, newly created fictional households.
export async function seedDemo(db: D1Database, roomId: string) {
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
  await db.batch([
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
