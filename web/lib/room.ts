import { env } from "cloudflare:workers";
import { z } from "zod";
import { calculateBudget } from "./domain/budget.js";
import { previewBudget } from "./domain/preview.js";

export type Role = "A" | "B";
export type Profile = {
  name: string;
  income: number;
  personal: number;
  reserve: number;
  priority: string;
  concern: string;
  shared: boolean;
  submitted: boolean;
  refined?: boolean;
};
export type Expense = { id: string; label: string; amount: number };
export type Plan = {
  method: "equal" | "proportional" | "custom";
  customA: number;
  payday: number;
  payer: Role;
  threshold: number;
  reviewDate: string;
  notes: string;
};
export type Room = {
  demo: boolean;
  moveDate: string | null;
  estimate?: { partnerIncome: number | null; method: "equal" | "proportional" };
  createdAt: string;
  partners: Record<Role, Profile>;
  expenses: Expense[];
  plan: Plan;
  planVersion: number;
  decisions: Record<Role, string>;
  checkins: {
    id: string;
    date: string;
    amount: number;
    note: string;
    role: Role;
  }[];
  guide?: { version: number; text: string };
  guideCount: number;
};
type Row = {
  id: string;
  token_a: string;
  token_b: string | null;
  invite: string | null;
  data: string;
  revision: number;
  created_at: string;
};
const cents = z.number().int().min(0).max(100_000_000);
const label = z.string().trim().min(1).max(60);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      !isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    "Choose a valid date",
  );
const profileSchema = z.object({
  name: label,
  income: cents,
  personal: cents,
  reserve: cents,
  priority: z.string().max(80),
  concern: z.string().max(800),
  shared: z.boolean(),
  refined: z.boolean().default(true),
});
const expensesSchema = z
  .array(z.object({ id: label, label, amount: cents }))
  .min(1)
  .max(16)
  .refine(
    (rows) => new Set(rows.map((row) => row.id)).size === rows.length,
    "Expense IDs must be unique",
  );
const planSchema = z.object({
  method: z.enum(["equal", "proportional", "custom"]),
  customA: cents,
  payday: z.number().int().min(1).max(28),
  payer: z.enum(["A", "B"]),
  threshold: cents,
  reviewDate: date,
  notes: z.string().max(1200),
});

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function database() {
  if (!env.DB)
    throw new HttpError(
      503,
      "The plan storage is temporarily unavailable. Please try again.",
    );
  return env.DB;
}
export function token() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
export async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
export async function body(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new HttpError(403, "This request must come from your plan.");
  const raw = await request.text();
  if (raw.length > 30_000)
    throw new HttpError(413, "This request is too large.");
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error();
    return parsed;
  } catch {
    throw new HttpError(400, "Please send a valid request.");
  }
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return json({ error: error.message }, error.status);
  if (error instanceof z.ZodError)
    return json(
      { error: error.issues[0]?.message || "Check your entries." },
      400,
    );
  if (error instanceof RangeError) return json({ error: error.message }, 400);
  console.error(
    "Plan operation failed",
    error instanceof Error ? error.name : "unknown",
  );
  return json(
    { error: "Something went wrong saving your plan. Please try again." },
    500,
  );
}
export async function findRoom(id: string): Promise<Row> {
  const row = await database()
    .prepare("SELECT * FROM rooms WHERE id = ?")
    .bind(id)
    .first<Row>();
  if (!row)
    throw new HttpError(
      404,
      "This plan could not be found. Check your link or start a new plan.",
    );
  return row;
}
export async function authorize(request: Request, id: string) {
  const access =
    request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (!/^[a-f0-9]{64}$/.test(access))
    throw new HttpError(401, "Open your personal link to access this plan.");
  const row = await findRoom(id),
    digest = await hash(access);
  const role: Role =
    digest === row.token_a
      ? "A"
      : digest === row.token_b
        ? "B"
        : (() => {
            throw new HttpError(
              403,
              "This link does not have access to the plan.",
            );
          })();
  return { row, role, room: JSON.parse(row.data) as Room };
}
export function shared(room: Room) {
  return room.partners.A.shared && room.partners.B.shared;
}
export function calculate(room: Room, method = room.plan.method) {
  const total = room.expenses.reduce((sum, item) => sum + item.amount, 0);
  return calculateBudget({
    sharedCents: total,
    incomeCents: [room.partners.A.income, room.partners.B.income],
    personalCommitmentsCents: [room.partners.A, room.partners.B].map(
      (person) => (person.refined === false ? 0 : person.personal),
    ),
    minimumRemainingCents: [room.partners.A, room.partners.B].map((person) =>
      person.refined === false ? 0 : person.reserve,
    ),
    method,
    customContributionsCents: [room.plan.customA, total - room.plan.customA],
  });
}
export function view(row: Row, room: Room, role: Role) {
  const partner: Role = role === "A" ? "B" : "A";
  const visible = shared(room),
    peer = room.partners[partner];
  let calculation = null;
  if (visible) {
    try {
      calculation = calculate(room);
    } catch {
      /* Select a valid method. */
    }
  }
  return {
    id: row.id,
    revision: row.revision,
    role,
    demo: room.demo,
    moveDate: room.moveDate,
    self: room.partners[role],
    partner: visible
      ? peer
      : { name: peer.name, submitted: peer.submitted, shared: peer.shared },
    bothShared: visible,
    joined: !!row.token_b,
    expenses: room.expenses,
    plan: room.plan,
    planVersion: room.planVersion,
    decisions: room.decisions,
    checkins: room.checkins,
    calculation,
    guide:
      visible && room.guide?.version === room.planVersion
        ? room.guide.text
        : null,
    estimate: role === "A" && !visible ? room.estimate || null : null,
  };
}
export async function save(row: Row, room: Room) {
  const result = await database()
    .prepare(
      "UPDATE rooms SET data = ?, revision = revision + 1 WHERE id = ? AND revision = ?",
    )
    .bind(JSON.stringify(room), row.id, row.revision)
    .run();
  if (!result.meta.changes)
    throw new HttpError(
      409,
      "Your partner just made a change. Refresh the plan and try again.",
    );
  return { ...row, data: JSON.stringify(room), revision: row.revision + 1 };
}
export async function limit(key: string, maximum: number) {
  const result = await database()
    .prepare(
      "INSERT INTO usage_limits (key, count) VALUES (?, 1) ON CONFLICT(key) DO UPDATE SET count = count + 1 WHERE count < ? RETURNING count",
    )
    .bind(key, maximum)
    .first();
  if (!result)
    throw new HttpError(429, "That is enough for now. Please try again later.");
}
function invalidate(room: Room) {
  room.planVersion += 1;
  room.decisions = { A: "pending", B: "pending" };
  delete room.guide;
}
export async function create(input: unknown) {
  const data = z
    .object({
      name: label.default("Partner 1"),
      partnerName: label.default("Partner 2"),
      moveDate: date.nullable().default(null),
      demo: z.boolean().default(false),
      quickStart: z
        .object({
          income: cents,
          partnerIncome: cents.nullable(),
          expenses: expensesSchema,
          method: z.enum(["equal", "proportional"]),
        })
        .optional(),
    })
    .refine(
      (value) => !(value.demo && value.quickStart),
      "Choose a sample or your own plan.",
    )
    .parse(input);
  const a = token(),
    b = data.demo ? token() : null,
    invitation = token(),
    id = crypto.randomUUID();
  const reviewDate = new Date(Date.now() + 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const profile = (name: string): Profile => ({
    name,
    income: 0,
    personal: 0,
    reserve: 0,
    priority: "A little breathing room",
    concern: "",
    shared: false,
    submitted: false,
  });
  const room: Room = {
    demo: data.demo,
    moveDate: data.moveDate,
    createdAt: new Date().toISOString(),
    partners: { A: profile(data.name), B: profile(data.partnerName) },
    expenses: [
      { id: "rent", label: "Rent", amount: 0 },
      { id: "utilities", label: "Utilities & internet", amount: 0 },
      { id: "groceries", label: "Groceries", amount: 0 },
      { id: "home", label: "Household essentials", amount: 0 },
    ],
    plan: {
      method: "equal",
      customA: 0,
      payday: 1,
      payer: "A",
      threshold: 10000,
      reviewDate,
      notes: "",
    },
    planVersion: 1,
    decisions: { A: "pending", B: "pending" },
    checkins: [],
    guideCount: 0,
  };
  if (data.quickStart) {
    const quick = data.quickStart,
      total = quick.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    if (total > 100_000_000)
      throw new HttpError(400, "Please use a monthly budget below $1,000,000.");
    previewBudget({
      incomeCents: quick.income,
      partnerIncomeCents: quick.partnerIncome,
      sharedCents: total,
      method: quick.method,
    });
    room.partners.A = {
      ...profile(data.name),
      income: quick.income,
      refined: false,
      priority: "",
      submitted: true,
    };
    room.partners.B = {
      ...profile(data.partnerName),
      refined: false,
      priority: "",
    };
    room.expenses = quick.expenses;
    room.plan.method = quick.method;
    room.estimate = {
      partnerIncome: quick.partnerIncome,
      method: quick.method,
    };
  }
  if (data.demo) {
    room.partners.A = {
      ...profile("Alex"),
      income: 600000,
      personal: 90000,
      reserve: 200000,
      concern: "I want us to keep some independence and a simple routine.",
      shared: true,
      submitted: true,
    };
    room.partners.B = {
      ...profile("Jordan"),
      income: 300000,
      personal: 30000,
      reserve: 120000,
      priority: "A plan I can keep up with",
      concern:
        "I want enough room to save without asking for help every month.",
      shared: true,
      submitted: true,
    };
    room.expenses.forEach(
      (item, i) => (item.amount = [240000, 25000, 60000, 15000][i]),
    );
  }
  await database()
    .prepare(
      "INSERT INTO rooms (id, token_a, token_b, invite, data, revision, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)",
    )
    .bind(
      id,
      await hash(a),
      b ? await hash(b) : null,
      await hash(invitation),
      JSON.stringify(room),
      room.createdAt,
    )
    .run();
  return { id, token: a, invite: invitation, demoPartnerToken: b };
}
export async function mutate(request: Request, id: string) {
  const input = await body(request);
  if (input.action === "join") {
    const invitation = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(input.invite);
    const access = token(),
      result = await database()
        .prepare(
          "UPDATE rooms SET token_b = ?, invite = NULL, revision = revision + 1 WHERE id = ? AND invite = ? AND token_b IS NULL",
        )
        .bind(await hash(access), id, await hash(invitation))
        .run();
    if (!result.meta.changes)
      throw new HttpError(
        410,
        "This invitation has already been used or is no longer available. Use your saved personal link.",
      );
    return { token: access };
  }
  const { row, room, role } = await authorize(request, id);
  if (input.revision !== row.revision)
    throw new HttpError(
      409,
      "The plan changed. Refresh to see the latest version before saving.",
    );
  if (input.action === "profile") {
    room.partners[role] = {
      ...profileSchema.parse(input.profile),
      submitted: true,
    };
    invalidate(room);
  } else if (input.action === "estimate") {
    if (role !== "A" || !room.estimate || shared(room))
      throw new HttpError(
        400,
        "Estimates can only be changed by their author before both people share.",
      );
    const estimate = z
      .object({
        partnerIncome: cents.nullable(),
        method: z.enum(["equal", "proportional"]),
      })
      .parse(input.estimate);
    previewBudget({
      incomeCents: room.partners.A.income,
      partnerIncomeCents: estimate.partnerIncome,
      sharedCents: room.expenses.reduce(
        (sum, expense) => sum + expense.amount,
        0,
      ),
      method: estimate.method,
    });
    room.estimate = estimate;
    room.plan.method = estimate.method;
    invalidate(room);
  } else if (input.action === "expenses") {
    room.expenses = expensesSchema.parse(input.expenses);
    if (
      room.expenses.reduce((total, item) => total + item.amount, 0) >
      100_000_000
    )
      throw new HttpError(400, "Please use a monthly budget below $1,000,000.");
    if (room.plan.method === "custom") room.plan.method = "equal";
    invalidate(room);
  } else if (input.action === "plan") {
    if (!shared(room))
      throw new HttpError(
        400,
        "Both people need to share their answers before comparing a plan.",
      );
    const nextPlan = planSchema.parse(input.plan);
    if (
      Object.keys(nextPlan).every(
        (key) => nextPlan[key as keyof Plan] === room.plan[key as keyof Plan],
      )
    )
      return view(row, room, role);
    room.plan = nextPlan;
    calculate(room);
    invalidate(room);
  } else if (input.action === "decision") {
    if (!shared(room))
      throw new HttpError(
        400,
        "Both people need to share their answers first.",
      );
    if (input.planVersion !== room.planVersion)
      throw new HttpError(409, "Review the current plan before deciding.");
    calculate(room);
    room.decisions[role] = z
      .enum(["accepted", "needs_changes"])
      .parse(input.decision);
  } else if (input.action === "checkin") {
    const checkin = z
      .object({ date, amount: cents, note: z.string().max(800) })
      .parse(input.checkin);
    room.checkins = [
      ...room.checkins,
      { ...checkin, id: crypto.randomUUID(), role },
    ].slice(-36);
  } else if (input.action === "invite") {
    if (role !== "A" || row.token_b)
      throw new HttpError(400, "Your partner already has access to this plan.");
    const invitation = token();
    const result = await database()
      .prepare(
        "UPDATE rooms SET invite = ?, revision = revision + 1 WHERE id = ? AND revision = ?",
      )
      .bind(await hash(invitation), id, row.revision)
      .run();
    if (!result.meta.changes)
      throw new HttpError(409, "Refresh and try again.");
    return { invite: invitation };
  } else throw new HttpError(400, "Unknown action.");
  const saved = await save(row, room);
  return view(saved, room, role);
}
