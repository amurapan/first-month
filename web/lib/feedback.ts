import { database } from "./room";
export const feedbackKinds = [
  "confusing",
  "missing",
  "bug",
  "helpful",
] as const;
export const feedbackScreens = [
  "home",
  "months",
  "decisions",
  "reviews",
  "settings",
  "plan",
] as const;
export type FeedbackItem = {
  id: string;
  kind: string;
  screen: string;
  message: string;
  createdAt: string;
};
export async function ownFeedback(id: string, role: string) {
  return (
    await database()
      .prepare(
        "SELECT id, kind, screen, message, created_at AS createdAt FROM product_feedback WHERE room_id = ? AND role = ? ORDER BY created_at DESC LIMIT 50",
      )
      .bind(id, role)
      .all<FeedbackItem>()
  ).results;
}
