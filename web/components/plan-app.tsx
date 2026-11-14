"use client";
import SplitInsight from "./split-insight";
import SplitResult from "./split-result";
import { AnimatedMoney, PlanAssembly } from "@/components/motion";
import { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  Check,
  CheckCheck,
  CircleHelp,
  House,
  LockKeyhole,
  Plus,
  Trash2,
  Users,
  Download,
  MessageCircle,
  Sparkles,
  Printer,
} from "lucide-react";
import SavedPreview from "@/components/saved-preview";
import { readDraft, writeDraft, clearDraft } from "@/lib/browser-draft";
import { calculateBudget } from "@/lib/domain/budget.js";
import type { Profile, Expense, Plan, Role } from "@/lib/room";

import type { SpaceState } from "@/lib/life-types";
import { sections } from "@/lib/navigation";
import SharingStatus from "./space/sharing-status";
type State = SpaceState;
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
const dollars = (cents: number) => (cents / 100).toString();
function parseMoney(value: FormDataEntryValue | string | null) {
  const raw = String(value || "0").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw))
    throw new Error(
      "Enter a positive dollar amount with up to two decimal places.",
    );
  const [whole, decimal = ""] = raw.split(".");
  const amount = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount > 100_000_000)
    throw new Error("Please enter an amount below $1,000,000.");
  return amount;
}
const fullDate = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
function download(name: string, contents: string, mime = "text/plain") {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function comparisonChanged(plan: Plan, method: Plan["method"], custom: string) {
  if (method !== plan.method) return true;
  if (method !== "custom") return false;
  try {
    return parseMoney(custom) !== plan.customA;
  } catch {
    return true;
  }
}

function savedComparison(state: State) {
  const draft = readDraft<{
    version: number;
    method: Plan["method"];
    custom: string;
  }>("fm:split-draft:" + state.id + ":" + state.role);
  return draft &&
    draft.version === state.planVersion &&
    ["equal", "proportional", "custom"].includes(draft.method) &&
    typeof draft.custom === "string"
    ? draft
    : null;
}
export default function PlanApp({
  state,
  busy,
  section,
  onSection,
  onMutate,
  onGuide,
  onInvite,
  onSpending,
  onError,
}: {
  state: State;
  busy: boolean;
  section: number | null;
  onSection: (step: number) => void;
  onMutate: (
    action: string,
    payload?: Record<string, unknown>,
  ) => Promise<State | null>;
  onGuide: (plan: Plan) => Promise<unknown>;
  onInvite: () => Promise<void>;
  onSpending: () => void;
  onError: (message: string) => void;
}) {
  const agreed =
    state.decisions.A === "accepted" && state.decisions.B === "accepted";
  const step =
    section ?? (agreed ? 3 : state.bothShared || state.estimate ? 2 : 0);
  const [editingProfile, setEditingProfile] = useState(false),
    [editingCosts, setEditingCosts] = useState(false),
    [guideBusy, setGuideBusy] = useState(false);
  const previousStep = useRef(step);
  const [, refreshComparison] = useState(0);
  const comparison = savedComparison(state);
  const unsavedComparison =
    !!comparison &&
    comparisonChanged(state.plan, comparison.method, comparison.custom);
  useEffect(() => {
    if (previousStep.current !== step) {
      setEditingProfile(false);
      setEditingCosts(false);
      previousStep.current = step;
    }
  }, [step]);
  const a = state.role === "A" ? state.self : state.partner,
    b = state.role === "B" ? state.self : state.partner;
  const total = state.expenses.reduce((sum, item) => sum + item.amount, 0);
  const share = () =>
    onMutate("profile", { profile: { ...state.self, shared: true } });
  const editProfile = () => {
    previousStep.current = 0;
    onSection(0);
    setEditingProfile(true);
  };
  const savedPlan = () =>
    [
      "FIRST MONTH — " + a.name + " & " + b.name,
      "Version " +
        state.planVersion +
        " · " +
        (agreed ? "Agreed by both" : "Draft; not agreed by both"),
      "",
      "SHARED EXPENSES",
      ...state.expenses.map((item) => item.label + ": " + money(item.amount)),
      "Total: " + money(total),
      "",
      "CONTRIBUTIONS",
      ...[a, b].map(
        (person, i) =>
          person.name +
          ": " +
          money(state.calculation?.contributionsCents[i] || 0) +
          " · Remaining: " +
          money(state.calculation?.remainingCents[i] || 0) +
          (person.refined === false ? " (personal bills not included)" : ""),
      ),
      "Method: " + state.plan.method,
      "Bill payer: " + (state.plan.payer === "A" ? a.name : b.name),
      "Transfer day: " + state.plan.payday + " of each month",
      "Discuss unplanned shared purchases from " + money(state.plan.threshold),
      "Next review: " + fullDate(state.plan.reviewDate),
      "",
      state.plan.notes,
      "",
      "Any changes need both people to review again.",
    ].join("\n");
  const sharing = (
    <SharingStatus
      state={state}
      busy={busy}
      onShare={share}
      onInvite={onInvite}
      onEdit={step === 0 ? undefined : editProfile}
    />
  );
  return (
    <div className="budget-workspace">
      <div className="life-heading budget-heading">
        <div>
          <p className="eyebrow">PLAN AHEAD</p>
          <h1>Our monthly budget.</h1>
          <p>
            Decide what you each plan to contribute. Record actual payments in{" "}
            <button className="text-button" onClick={onSpending}>
              Spending <ArrowRight size={14} />
            </button>
            .
          </p>
        </div>
        <span className={"status-tag " + (agreed ? "green" : "")}>
          {!state.bothShared
            ? "Waiting for shared details"
            : agreed
              ? "Saved plan · agreed by both"
              : "Saved proposal · " +
                [state.decisions.A, state.decisions.B].filter(
                  (value) => value === "accepted",
                ).length +
                " of 2 agreed"}
        </span>
      </div>
      <nav className="budget-sections" aria-label="Budget sections">
        {sections.map((label, i) => (
          <button
            key={label}
            aria-current={i === step ? "page" : undefined}
            onClick={() => onSection(i)}
          >
            <span>{label}</span>
            {((i === 0 && state.self.submitted) || (i === 3 && agreed)) && (
              <Check size={14} />
            )}
          </button>
        ))}
      </nav>
      <section className="budget-section" aria-label={sections[step]}>
        {step === 0 && (
          <>
            {editingProfile || !state.self.submitted ? (
              <>
                <div className="budget-edit-heading">
                  <h2>Edit your details</h2>
                  {state.self.submitted && (
                    <button
                      className="text-button"
                      onClick={() => setEditingProfile(false)}
                    >
                      Back to saved details
                    </button>
                  )}
                </div>
                <ProfileForm
                  state={state}
                  busy={busy}
                  onError={onError}
                  onSave={async (profile) => {
                    const result = await onMutate("profile", { profile });
                    if (result) {
                      clearDraft(
                        "fm:profile-draft:" + state.id + ":" + state.role,
                      );
                      setEditingProfile(false);
                      onSection(
                        (profile as Profile).shared && result.bothShared
                          ? 2
                          : 0,
                      );
                    }
                  }}
                />
              </>
            ) : (
              <>
                <div className="budget-saved-profile surface">
                  <div className="budget-saved-heading">
                    <div>
                      <p className="eyebrow">YOUR SAVED DETAILS</p>
                      <h2>{state.self.name}</h2>
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => setEditingProfile(true)}
                    >
                      Edit my details
                    </button>
                  </div>
                  <dl>
                    <div>
                      <dt>Monthly take-home income</dt>
                      <dd>
                        <AnimatedMoney value={state.self.income} />
                      </dd>
                    </div>
                    <div>
                      <dt>Personal monthly bills</dt>
                      <dd>
                        {state.self.refined === false
                          ? "Not added"
                          : money(state.self.personal)}
                      </dd>
                    </div>
                    <div>
                      <dt>Money you want to keep</dt>
                      <dd>
                        {state.self.refined === false
                          ? "Not added"
                          : money(state.self.reserve)}
                      </dd>
                    </div>
                  </dl>
                  {(state.self.priority || state.self.concern) && (
                    <details className="budget-own-notes">
                      <summary>My saved priority & note</summary>
                      <p>{state.self.priority}</p>
                      <p>{state.self.concern}</p>
                    </details>
                  )}
                  <p className="budget-save-state">
                    <Check size={15} />
                    These details are saved. Edit only if something has changed.
                  </p>
                </div>
                {!state.bothShared ? (
                  sharing
                ) : (
                  <div className="budget-saved-next">
                    <p>
                      You’ve both shared your details. Review how the costs are
                      divided.
                    </p>
                    <button
                      className="button primary"
                      onClick={() => onSection(2)}
                    >
                      Compare our split <ArrowRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
        {step === 1 && (
          <>
            {editingCosts ? (
              <>
                <div className="budget-edit-heading">
                  <h2>Edit planned costs</h2>
                  <button
                    className="text-button"
                    onClick={() => setEditingCosts(false)}
                  >
                    Back to saved costs
                  </button>
                </div>
                <ExpensesForm
                  state={state}
                  busy={busy}
                  onError={onError}
                  onSave={async (expenses) => {
                    const result = await onMutate("expenses", { expenses });
                    if (result) {
                      clearDraft(
                        "fm:expenses-draft:" + state.id + ":" + state.role,
                      );
                      setEditingCosts(false);
                      onSection(2);
                    }
                  }}
                />
              </>
            ) : (
              <section className="surface budget-costs-summary">
                <div className="budget-saved-heading">
                  <div>
                    <p className="eyebrow">PLANNED EACH MONTH</p>
                    <h2>Your shared costs</h2>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => setEditingCosts(true)}
                  >
                    Edit costs
                  </button>
                </div>
                <dl>
                  {state.expenses.map((item) => (
                    <div key={item.id}>
                      <dt>{item.label}</dt>
                      <dd>{money(item.amount)}</dd>
                    </div>
                  ))}
                  <div className="budget-cost-total">
                    <dt>Total planned</dt>
                    <dd>
                      <AnimatedMoney value={total} />
                    </dd>
                  </div>
                </dl>
                <p>
                  These are estimates for your budget. They do not record a
                  payment.
                </p>
                <button className="button primary" onClick={() => onSection(2)}>
                  Compare our split <ArrowRight size={16} />
                </button>
              </section>
            )}
          </>
        )}
        {step >= 2 && !state.bothShared && sharing}
        {step === 2 && state.estimate && (
          <details className="budget-estimate" open>
            <summary>
              Your private starting comparison{" "}
              <span>Uses your partner-income estimate</span>
            </summary>
            <SavedPreview
              income={state.self.income}
              total={total}
              names={[state.self.name, state.partner.name]}
              estimate={state.estimate}
              busy={busy}
              joined={state.joined}
              shared={state.self.shared}
              showInvitation={false}
              onSave={(estimate) => onMutate("estimate", { estimate })}
              onInvite={onInvite}
              onProfile={editProfile}
              onExpenses={() => {
                previousStep.current = 1;
                onSection(1);
                setEditingCosts(true);
              }}
              onError={onError}
            />
          </details>
        )}
        {step === 2 && state.bothShared && (
          <Balance
            key={state.planVersion}
            state={state}
            busy={busy}
            guideBusy={guideBusy}
            onGuide={async (plan) => {
              setGuideBusy(true);
              try {
                await onGuide(plan);
              } finally {
                setGuideBusy(false);
              }
            }}
            onRefine={editProfile}
            onSave={async (plan) => {
              if (await onMutate("plan", { plan })) {
                clearDraft("fm:split-draft:" + state.id + ":" + state.role);
                onSection(3);
              }
            }}
            onError={onError}
          />
        )}
        {step === 3 && state.bothShared && unsavedComparison && (
          <section className="surface comparison-unsaved">
            <p className="eyebrow">YOUR COMPARISON IS STILL A DRAFT</p>
            <h2>You tried a different split.</h2>
            <p>
              That choice is saved in this browser. Use it from Compare splits
              before confirming, or keep the split already saved to your shared
              budget.
            </p>
            <div>
              <button className="button primary" onClick={() => onSection(2)}>
                Return to my comparison <ArrowRight size={16} />
              </button>
              <button
                className="text-button"
                onClick={() => {
                  clearDraft("fm:split-draft:" + state.id + ":" + state.role);
                  refreshComparison((n) => n + 1);
                }}
              >
                Keep the saved split
              </button>
            </div>
          </section>
        )}
        {step === 3 && state.bothShared && !unsavedComparison && (
          <>
            <Agreement
              key={state.planVersion}
              state={state}
              busy={busy}
              onSave={(plan) => onMutate("plan", { plan })}
              onDecision={(decision) =>
                onMutate("decision", {
                  decision,
                  planVersion: state.planVersion,
                })
              }
              onError={onError}
            />
            <div className="page-actions agreement-actions">
              <div className="download-actions">
                <button className="text-button" onClick={() => window.print()}>
                  <Printer size={17} />
                  Print / save PDF
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    if (state.calculation)
                      download("our-first-month.txt", savedPlan());
                    else onError("Choose a valid contribution method first.");
                  }}
                >
                  <Download size={17} />
                  Download {agreed ? "our plan" : "draft"}
                </button>
              </div>
              {agreed && (
                <button className="button primary" onClick={onSpending}>
                  Track shared spending <ArrowRight size={17} />
                </button>
              )}
            </div>
            {state.checkins.length > 0 && (
              <details className="budget-previous-notes">
                <summary>
                  Earlier monthly notes ({state.checkins.length})
                </summary>
                {state.checkins.map((item) => (
                  <article key={item.id}>
                    <strong>
                      {fullDate(item.date)} · {money(item.amount)}
                    </strong>
                    <p>{item.note}</p>
                  </article>
                ))}
              </details>
            )}
          </>
        )}
      </section>
    </div>
  );
}
function MoneyField({
  label,
  name,
  value,
  hint,
  disabled = false,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  hint?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <span className="money-input">
        <span>$</span>
        <input
          name={name}
          aria-label={label}
          type="number"
          min="0"
          max="1000000"
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={!disabled}
          disabled={disabled}
        />
        <span>/ month</span>
      </span>
      {hint && <small>{hint}</small>}
    </label>
  );
}
function ProfileForm({
  state,
  busy,
  onSave,
  onError,
}: {
  state: State;
  busy: boolean;
  onSave: (profile: unknown) => Promise<void>;
  onError: (error: string) => void;
}) {
  const key = "fm:profile-draft:" + state.id + ":" + state.role;
  const base = useRef(JSON.stringify(state.self));
  const defaults = {
    name: /^Partner [12]$/.test(state.self.name) ? "" : state.self.name,
    income: state.self.submitted ? dollars(state.self.income) : "",
    personal: dollars(state.self.personal),
    reserve: dollars(state.self.reserve),
    refined: state.self.refined !== false,
    priority: state.self.priority,
    concern: state.self.concern,
  };
  const [draft, setDraft] = useState(() => {
    const saved = readDraft<{ base: string; values: typeof defaults }>(key);
    return saved?.base === base.current &&
      saved.values &&
      ["name", "income", "personal", "reserve", "priority", "concern"].every(
        (field) =>
          typeof saved.values[field as keyof typeof defaults] === "string",
      ) &&
      typeof saved.values.refined === "boolean"
      ? saved.values
      : defaults;
  });
  const [persisted, setPersisted] = useState(true);
  useEffect(() => {
    setPersisted(writeDraft(key, { base: base.current, values: draft }));
  }, [draft, key]);
  function change(value: Partial<typeof defaults>) {
    setDraft((current) => ({ ...current, ...value }));
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (base.current !== JSON.stringify(state.self)) {
      onError(
        "Your saved details changed while you were editing. Your draft is still here. Go back to saved details to review the latest version before saving.",
      );
      return;
    }
    const share =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") !==
      "private";
    try {
      await onSave({
        name: draft.name.trim() || state.self.name,
        income: parseMoney(draft.income),
        personal: draft.refined ? parseMoney(draft.personal) : 0,
        reserve: draft.refined ? parseMoney(draft.reserve) : 0,
        refined: draft.refined,
        priority: draft.priority,
        concern: draft.concern,
        shared: share,
      });
    } catch (error) {
      onError((error as Error).message);
    }
  }
  const choices = [
    "A little breathing room",
    "A plan I can keep up with",
    "Keeping some independence",
    "Saving for our next step",
    "Less money admin",
  ];
  return (
    <div className="profile-layout">
      <form className="surface form-surface simple-profile" onSubmit={submit}>
        <div className="panel-heading">
          <span className="avatar">{state.role === "A" ? "1" : "2"}</span>
          <div>
            <h3>Your side of the plan.</h3>
            <p>Start with your take-home income. Add detail when it helps.</p>
          </div>
        </div>
        <MoneyField
          name="income"
          label="Your monthly take-home income"
          value={draft.income}
          onChange={(income) => change({ income })}
          hint="After tax. An estimate is okay; you can update it later."
        />
        <label>
          Your first name <span className="optional">Optional</span>
          <input
            name="name"
            autoComplete="given-name"
            maxLength={60}
            value={draft.name}
            onChange={(event) => change({ name: event.target.value })}
            placeholder={state.self.name}
          />
        </label>
        <details
          className="profile-extra"
          open={draft.refined}
          onToggle={(event) => {
            if (event.currentTarget.open !== draft.refined)
              change({ refined: event.currentTarget.open });
          }}
        >
          <summary>
            Include personal bills & savings <span>Optional</span>
          </summary>
          <p>
            Use these to check what remains after all your costs. Close this
            section to compare shared contributions only.
          </p>
          <MoneyField
            disabled={!draft.refined}
            name="personal"
            label="Personal monthly bills"
            value={draft.personal}
            onChange={(personal) => change({ personal })}
            hint="Your own debt payments, transport, or other commitments."
          />
          <MoneyField
            disabled={!draft.refined}
            name="reserve"
            label="Money you want to keep"
            value={draft.reserve}
            onChange={(reserve) => change({ reserve })}
            hint="For your own spending and saving, after all bills are paid."
          />
        </details>
        <details className="profile-extra" open={undefined}>
          <summary>
            Add what matters to you <span>Optional</span>
          </summary>
          <p>
            Choose a priority or leave a note to help start the conversation.
          </p>
          <div
            className="priority-choices"
            role="group"
            aria-label="Your priority"
          >
            {choices.map((choice) => (
              <button
                type="button"
                key={choice}
                aria-pressed={draft.priority === choice}
                onClick={() =>
                  change({ priority: draft.priority === choice ? "" : choice })
                }
              >
                {choice}
              </button>
            ))}
          </div>
          <label>
            Anything you’d like your partner to understand?
            <textarea
              name="concern"
              maxLength={800}
              rows={3}
              value={draft.concern}
              onChange={(event) => change({ concern: event.target.value })}
              placeholder="I’d like us to keep some independence while sharing a home."
            />
          </label>
        </details>
        <div className="sharing-choice">
          <LockKeyhole size={18} />
          <p>
            <strong>You choose when to share.</strong> Sharing makes your saved
            income, included personal details, priority, and note visible to{" "}
            {state.partner.name} once you both choose to share.
          </p>
        </div>
        <div className="profile-submit">
          <button
            className="button primary"
            type="submit"
            value="share"
            disabled={busy}
          >
            {busy
              ? "Saving…"
              : state.self.shared
                ? "Save changes"
                : "Save & share details"}
            <ArrowRight size={17} />
          </button>
          <button
            className="text-button"
            type="submit"
            value="private"
            disabled={busy}
          >
            {state.self.shared ? "Save and make private" : "Save privately"}
          </button>
        </div>
        <p className="fine-print">
          {persisted
            ? "Edits are saved in this browser until you choose one of the actions above."
            : "Browser storage is unavailable. Save before leaving this page."}
        </p>
      </form>
    </div>
  );
}
function ExpensesForm({
  state,
  busy,
  onSave,
  onError,
}: {
  state: State;
  busy: boolean;
  onSave: (expenses: Expense[]) => Promise<void>;
  onError: (message: string) => void;
}) {
  const draftKey = "fm:expenses-draft:" + state.id + ":" + state.role;
  const originalExpenses = useRef(JSON.stringify(state.expenses));
  const [rows, setRows] = useState(() => {
    const saved = readDraft<{
      base: string;
      rows: (Expense & { value: string })[];
    }>(draftKey);
    return saved?.base === originalExpenses.current &&
      Array.isArray(saved.rows) &&
      saved.rows.length > 0 &&
      saved.rows.every(
        (row) => typeof row.value === "string" && typeof row.label === "string",
      )
      ? saved.rows
      : state.expenses.map((row) => ({ ...row, value: dollars(row.amount) }));
  });
  useEffect(() => {
    writeDraft(draftKey, { base: originalExpenses.current, rows });
  }, [rows, draftKey]);
  const total = rows.reduce((sum, row) => sum + (Number(row.value) || 0), 0);
  function change(id: string, key: string, value: string) {
    setRows(
      rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    );
  }
  return (
    <form
      className="surface expenses-surface"
      onSubmit={(event) => {
        event.preventDefault();
        if (originalExpenses.current !== JSON.stringify(state.expenses)) {
          onError(
            "Your partner changed the shared expenses while you were editing. Reopen this step to review their changes.",
          );
          return;
        }
        try {
          onSave(
            rows.map(({ id, label, value }) => ({
              id,
              label: label.trim(),
              amount: parseMoney(value),
            })),
          );
        } catch (error) {
          onError((error as Error).message);
        }
      }}
    >
      <div className="panel-heading">
        <span className="section-icon small">
          <House size={22} />
        </span>
        <div>
          <h3>The things you’ll share</h3>
          <p>Monthly estimates in USD. You can change them together later.</p>
        </div>
      </div>
      <div className="expense-table">
        <div className="expense-table-head">
          <span>SHARED EXPENSE</span>
          <span>PER MONTH</span>
          <span />
        </div>
        {rows.map((row) => (
          <div className="expense-row" key={row.id}>
            <input
              aria-label="Expense name"
              value={row.label}
              maxLength={60}
              onChange={(e) => change(row.id, "label", e.target.value)}
              required
            />
            <span className="money-input">
              <span>$</span>
              <input
                aria-label={row.label + " monthly amount"}
                value={row.value}
                onChange={(e) => change(row.id, "value", e.target.value)}
                type="number"
                min="0"
                step="0.01"
                required
              />
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label={"Remove " + row.label}
              disabled={rows.length === 1}
              onClick={() => setRows(rows.filter((item) => item.id !== row.id))}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="text-button add-expense"
        disabled={rows.length >= 16}
        onClick={() =>
          setRows([
            ...rows,
            { id: crypto.randomUUID(), label: "", amount: 0, value: "" },
          ])
        }
      >
        <Plus size={16} /> Add a shared expense
      </button>
      <div className="expense-total">
        <span>Our monthly shared budget</span>
        <strong>
          <AnimatedMoney value={Math.round(total * 100)} enter />
        </strong>
      </div>
      <div className="soft-note">
        <CircleHelp size={18} />
        <p>
          What counts as shared? Talk about groceries, meals out, subscriptions,
          and personal treats. Include only what you both intend to share.
        </p>
      </div>
      <div className="form-bottom">
        <span className="small-text muted">
          Changes will ask both of you to review again.
        </span>
        <button className="button primary" disabled={busy}>
          {busy ? "Saving…" : "Compare our options"}
          <ArrowRight size={17} />
        </button>
      </div>
    </form>
  );
}
function Balance({
  state,
  busy,
  guideBusy,
  onGuide,
  onRefine,
  onSave,
  onError,
}: {
  state: State;
  busy: boolean;
  guideBusy: boolean;
  onGuide: (plan: Plan) => Promise<void>;
  onRefine: () => void;
  onSave: (plan: Plan) => Promise<void>;
  onError: (message: string) => void;
}) {
  const a = (state.role === "A" ? state.self : state.partner) as Profile,
    b = (state.role === "B" ? state.self : state.partner) as Profile;
  const total = state.expenses.reduce((sum, row) => sum + row.amount, 0);
  const stored = useRef(savedComparison(state)).current;
  const [method, setMethod] = useState<Plan["method"]>(
      stored?.method || state.plan.method,
    ),
    [custom, setCustom] = useState(
      stored?.custom ??
        dollars(
          state.plan.method === "custom"
            ? state.plan.customA
            : Math.round(total / 2),
        ),
    );
  const [draftSaved, setDraftSaved] = useState(true);
  const [guideExpanded, setGuideExpanded] = useState(
    guideBusy || !!state.guide,
  );
  useEffect(() => {
    if (guideBusy) setGuideExpanded(true);
  }, [guideBusy]);
  useEffect(() => {
    setDraftSaved(
      writeDraft("fm:split-draft:" + state.id + ":" + state.role, {
        version: state.planVersion,
        method,
        custom,
      }),
    );
  }, [method, custom, state.planVersion, state.id, state.role]);
  const calc = (choice: Plan["method"]) =>
    calculateBudget({
      sharedCents: total,
      incomeCents: [a.income, b.income],
      personalCommitmentsCents: [a, b].map((person) =>
        person.refined === false ? 0 : person.personal,
      ),
      minimumRemainingCents: [a, b].map((person) =>
        person.refined === false ? 0 : person.reserve,
      ),
      method: choice,
      customContributionsCents:
        choice === "custom"
          ? [parseMoney(custom), total - parseMoney(custom)]
          : undefined,
    });
  let selected: ReturnType<typeof calculateBudget> | null = null;
  let problem = "";
  try {
    selected = calc(method);
  } catch (error) {
    problem = (error as Error).message;
  }
  const equal = calc("equal");
  const names = {
    equal: "Equal shares",
    proportional: "By income",
    custom: "Your own split",
  };
  const draft = () => ({
    ...state.plan,
    method,
    customA: method === "custom" ? parseMoney(custom) : state.plan.customA,
  });
  const changed = comparisonChanged(state.plan, method, custom);
  const agreed =
    state.decisions.A === "accepted" && state.decisions.B === "accepted";
  const acceptedCount = [state.decisions.A, state.decisions.B].filter(
    (x) => x === "accepted",
  ).length;
  const combinedRemaining = selected
    ? selected.remainingCents[0] + selected.remainingCents[1]
    : 0;
  return (
    <div className="compact-budget">
      <section
        className="balance-result"
        aria-label="What this split means for you"
      >
        <div className="compact-budget-heading">
          <div>
            <p className="overline">COMPARE SPLITS</p>
            <h2>What would you each pay?</h2>
          </div>
          <div className="compact-budget-total">
            <span>Shared costs / month</span>
            <strong>
              <AnimatedMoney value={total} />
            </strong>
          </div>
        </div>
        <div
          className="split-methods"
          role="group"
          aria-label="Ways to share your expenses"
        >
          {(["equal", "proportional", "custom"] as const).map((choice, i) => (
            <button
              key={choice}
              aria-pressed={method === choice}
              disabled={busy || guideBusy}
              onClick={() => setMethod(choice)}
            >
              <span>{names[choice]}</span>
              <small>
                {
                  [
                    "The same amount each",
                    "The same % of income",
                    "Choose the amounts",
                  ][i]
                }
              </small>
            </button>
          ))}
        </div>
        {method === "custom" && (
          <div className="custom-split compact-custom">
            <label>
              {a.name}’s monthly contribution
              <span className="money-input">
                <span>$</span>
                <input
                  aria-label="Custom contribution"
                  value={custom}
                  disabled={busy || guideBusy}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  max={total / 100}
                  onChange={(e) => setCustom(e.target.value)}
                />
              </span>
            </label>
            <div>
              <span>{b.name} covers the rest</span>
              <strong>
                {selected ? (
                  <AnimatedMoney value={selected.contributionsCents[1]} />
                ) : (
                  "—"
                )}
              </strong>
            </div>
          </div>
        )}
        {problem && (
          <div className="alert error" role="alert">
            {problem}
          </div>
        )}
        {selected && (
          <>
            <SplitResult
              people={[a, b]}
              role={state.role}
              contributions={selected.contributionsCents}
              remaining={selected.remainingCents}
            />
            {combinedRemaining < 0 && (
              <p className="split-budget-warning">
                The included costs exceed your combined incomes by{" "}
                {money(-combinedRemaining)}. Changing the split alone cannot
                close this gap.
              </p>
            )}
            <p className="split-scope">
              {[a, b].some((p) => p.refined === false)
                ? "Personal bills and savings aren’t included for " +
                  [a, b]
                    .filter((p) => p.refined === false)
                    .map((p) => p.name)
                    .join(" and ") +
                  "."
                : "Money left is after the shared contribution and personal bills you’ve entered. Savings still come from this amount."}
              {state.self.refined === false && (
                <>
                  {" "}
                  <button className="text-button" onClick={onRefine}>
                    Add your personal costs <ArrowRight size={13} />
                  </button>
                </>
              )}
            </p>
          </>
        )}
        <div className="proposal-action">
          <div className="proposal-status" aria-live="polite">
            <strong>
              {changed
                ? "Trying an option"
                : agreed
                  ? "Agreed by both"
                  : "Saved proposal · " + acceptedCount + " of 2 agreed"}
            </strong>
            <p>
              {changed
                ? "Only your comparison has changed. Save it for your partner to review."
                : agreed
                  ? "This matches the plan you both confirmed."
                  : "Review the details next. You each confirm separately."}
            </p>
            {!draftSaved && (
              <p className="attention">
                Browser drafts are unavailable. Keep this page open to preserve
                this comparison.
              </p>
            )}
          </div>
          <button
            className="button primary"
            disabled={busy || guideBusy || !selected}
            onClick={() => {
              try {
                onSave(draft());
              } catch (error) {
                onError((error as Error).message);
              }
            }}
          >
            {busy
              ? "Saving…"
              : changed
                ? "Save this proposal"
                : agreed
                  ? "View agreed plan"
                  : "Review & confirm"}
            <ArrowRight size={17} />
          </button>
        </div>
      </section>
      {selected && (
        <details className="budget-extra budget-math">
          <summary>
            <span>
              How these numbers work
              <small>
                Income, personal bills, and the difference from equal shares
              </small>
            </span>
            <Plus size={18} />
          </summary>
          <div className="budget-extra-content">
            <div className="math-people">
              {[a, b].map((person, i) => {
                const change =
                  selected!.remainingCents[i] - equal.remainingCents[i];
                return (
                  <div key={i}>
                    <strong>{person.name}</strong>
                    <dl>
                      <div>
                        <dt>Take-home income</dt>
                        <dd>{money(person.income)}</dd>
                      </div>
                      <div>
                        <dt>Personal bills</dt>
                        <dd>
                          {person.refined === false
                            ? "Not added"
                            : "− " + money(person.personal)}
                        </dd>
                      </div>
                      <div>
                        <dt>Shared contribution</dt>
                        <dd>− {money(selected!.contributionsCents[i])}</dd>
                      </div>
                      <div>
                        <dt>Left after included costs</dt>
                        <dd>{money(selected!.remainingCents[i])}</dd>
                      </div>
                    </dl>
                    <p>
                      {change === 0
                        ? "The same amount left as an equal split."
                        : money(Math.abs(change)) +
                          (change > 0 ? " more" : " less") +
                          " left than an equal split."}
                    </p>
                    {person.refined !== false && (
                      <p>
                        Wants to keep {money(person.reserve)} for personal
                        spending and savings.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <SplitInsight
              names={[a.name, b.name]}
              incomes={[a.income, b.income]}
              total={total}
              method={method}
              contributions={selected.contributionsCents}
              remaining={selected.remainingCents}
              personal={[a.personal, b.personal]}
              reserves={[a.reserve, b.reserve]}
              refined={[a, b].map((p) => p.refined !== false)}
              onCompareIncome={
                busy || guideBusy ? undefined : () => setMethod("proportional")
              }
            />
          </div>
        </details>
      )}
      {[a, b].some((person) => person.priority || person.concern) && (
        <details className="budget-extra">
          <summary>
            <span>
              Your priorities, side by side
              <small>What each of you wants this plan to make room for</small>
            </span>
            <Plus size={18} />
          </summary>
          <div className="shared-priorities budget-extra-content">
            {[a, b].map((person, i) => (
              <div key={i}>
                <span className={"avatar " + (i ? "peach" : "")}>
                  {person.name[0]}
                </span>
                <div>
                  <span className="overline">{person.name}’S PRIORITY</span>
                  <strong>{person.priority || "No priority added yet"}</strong>
                  {person.concern && <p>“{person.concern}”</p>}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      <details
        className="budget-extra budget-conversation"
        open={guideExpanded}
        onToggle={(event) => setGuideExpanded(event.currentTarget.open)}
      >
        <summary>
          <span>
            Help us talk about it
            <small>Optional questions based on what you’ve both shared</small>
          </span>
          <Plus size={18} />
        </summary>
        <section className="conversation-box budget-extra-content">
          <div>
            <span className="overline">
              <Sparkles size={15} /> YOUR NEXT CONVERSATION
            </span>
            <h3>A little help finding the words.</h3>
            <p>
              Get three questions and a starting sentence for this split. Only
              the answers you both chose to share are sent to our AI provider,
              Groq.
            </p>
          </div>
          {(!state.guide || changed || guideBusy) && (
            <button
              className="button secondary"
              onClick={() => {
                try {
                  onGuide(draft());
                } catch (error) {
                  onError((error as Error).message);
                }
              }}
              disabled={guideBusy || busy || !selected}
            >
              {guideBusy
                ? "Preparing your guide…"
                : "Make our conversation guide"}
              <ArrowRight size={16} />
            </button>
          )}
          {changed && (
            <p className="guide-save-note">
              Preparing a guide saves this split as a new proposal for both of
              you to review. It does not confirm agreement.
            </p>
          )}
          {guideBusy && <PlanAssembly compact kind="guide" />}
          {state.guide && !changed && (
            <div className="guide-output" aria-label="Your conversation guide">
              <div className="guide-heading">
                <MessageCircle size={19} />
                <strong>
                  A starting point for {a.name} & {b.name}
                </strong>
              </div>
              {state.guide.split(/\n\s*\n/).map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
              <span className="fine-print">
                A generated conversation aid. Keep what fits, change what
                doesn’t.
              </span>
            </div>
          )}
        </section>
      </details>
    </div>
  );
}
function Agreement({
  state,
  busy,
  onSave,
  onDecision,
  onError,
}: {
  state: State;
  busy: boolean;
  onSave: (plan: Plan) => Promise<unknown>;
  onDecision: (decision: string) => Promise<unknown>;
  onError: (message: string) => void;
}) {
  const a = state.role === "A" ? state.self : state.partner,
    b = state.role === "B" ? state.self : state.partner;
  const agreed =
    state.decisions.A === "accepted" && state.decisions.B === "accepted";
  const [dirty, setDirty] = useState(false);
  const formRevision = useRef(state.planVersion);
  const stale = formRevision.current !== state.planVersion && dirty;
  return (
    <div className="agreement-layout">
      <section className="surface agreement-paper">
        <div className="agreement-title">
          <span className="paper-symbol">
            <House size={22} />
          </span>
          <span className={"pill " + (agreed ? "success" : "")}>
            {agreed
              ? "AGREED TOGETHER"
              : "SAVED PROPOSAL · VERSION " + state.planVersion}
          </span>
        </div>
        <p className="overline">OUR FIRST MONTH</p>
        <h2>
          {a.name} & {b.name}
        </h2>
        <p className="muted">
          {state.moveDate
            ? "Moving in " + fullDate(state.moveDate) + " · "
            : ""}
          Plan version {state.planVersion}
        </p>
        <div className="agreement-amounts">
          {[a, b].map((person, i) => (
            <div key={i}>
              <span>{person.name} contributes</span>
              <strong>
                {state.calculation
                  ? money(state.calculation.contributionsCents[i])
                  : "Choose a split"}
              </strong>
              <small>per month</small>
              {state.calculation && (
                <p>
                  <AnimatedMoney
                    value={state.calculation.remainingCents[i]}
                    enter
                  />{" "}
                  {person.refined === false
                    ? "after shared costs; personal bills not included"
                    : "after their included bills"}
                </p>
              )}
            </div>
          ))}
        </div>
        <p className="overline">WHAT THIS COVERS</p>
        <div className="agreed-expenses">
          {state.expenses.map((row) => (
            <div key={row.id}>
              <span>{row.label}</span>
              <span>{money(row.amount)}</span>
            </div>
          ))}
          <div className="agreement-total">
            <strong>Shared monthly total</strong>
            <strong>
              {money(
                state.expenses.reduce((sum, item) => sum + item.amount, 0),
              )}
            </strong>
          </div>
        </div>
        <p className="small-text muted">
          Personal bills, spending, and savings remain separate.
        </p>
        <div className="agreement-routine">
          <p className="overline">HOW WE’LL MAKE IT WORK</p>
          <div>
            <span className="routine-number">01</span>
            <p>
              <strong>One simple transfer</strong>
              {state.plan.payer === "A" ? b.name : a.name} transfers{" "}
              {state.calculation
                ? money(
                    state.calculation.contributionsCents[
                      state.plan.payer === "A" ? 1 : 0
                    ],
                  )
                : "their contribution"}{" "}
              to {state.plan.payer === "A" ? a.name : b.name} by day{" "}
              {state.plan.payday} each month.{" "}
              {state.plan.payer === "A" ? a.name : b.name} pays the shared
              bills.
            </p>
          </div>
          <div>
            <span className="routine-number">02</span>
            <p>
              <strong>Talk before a shared extra</strong>Discuss unplanned
              shared purchases of {money(state.plan.threshold)} or more.
            </p>
          </div>
          <div>
            <span className="routine-number">03</span>
            <p>
              <strong>Make room to revisit</strong>Check in on{" "}
              {fullDate(state.plan.reviewDate)}.
            </p>
          </div>
          {state.plan.notes && <blockquote>{state.plan.notes}</blockquote>}
        </div>
        <div className="decision-list">
          {(["A", "B"] as Role[]).map((role, i) => (
            <div key={role}>
              <span className={"avatar " + (i ? "peach" : "")}>
                {[a, b][i].name?.[0]}
              </span>
              <strong>{[a, b][i].name}</strong>
              <span
                className={
                  state.decisions[role] === "accepted" ? "approved" : "muted"
                }
              >
                {state.decisions[role] === "accepted"
                  ? "Agreed ✓"
                  : state.decisions[role] === "needs_changes"
                    ? "Wants to discuss"
                    : "Still reviewing"}
              </span>
            </div>
          ))}
        </div>
        {state.decisions[state.role] !== "accepted" ? (
          <button
            className="button primary full"
            disabled={busy || dirty || !state.calculation}
            onClick={() => onDecision("accepted")}
          >
            <Check size={17} /> I agree to version {state.planVersion}
          </button>
        ) : (
          <div className="accepted-message">
            <CheckCheck size={18} />
            {agreed
              ? "You both said yes. This is your starting plan."
              : "Your yes is saved. Waiting for " + state.partner.name + "."}
          </div>
        )}
        <p className="agreement-footnote">
          A shared household plan you can revisit together.
        </p>
        <button
          className="text-button full discussion-button"
          disabled={busy}
          onClick={() => onDecision("needs_changes")}
        >
          <MessageCircle size={16} /> I’d like to talk about this
        </button>
        {dirty && (
          <p className="fine-print attention">
            Save the details before confirming this version.
          </p>
        )}
      </section>
      <form
        className="surface agreement-details"
        onChange={() => setDirty(true)}
        onSubmit={async (event) => {
          event.preventDefault();
          if (stale) {
            onError(
              "Your partner changed these details while you were editing. Reopen this step to review the latest version.",
            );
            return;
          }
          const f = new FormData(event.currentTarget);
          try {
            const result = await onSave({
              ...state.plan,
              payday: Number(f.get("payday")),
              payer: f.get("payer") as Role,
              threshold: parseMoney(f.get("threshold")),
              reviewDate: String(f.get("reviewDate")),
              notes: String(f.get("notes")),
            });
            if (result) {
              setDirty(false);
              formRevision.current = state.planVersion + 1;
            }
          } catch (error) {
            onError((error as Error).message);
          }
        }}
      >
        <p className="overline">MAKE IT PRACTICAL</p>
        <h3>The everyday details</h3>
        <p className="muted small-text">
          Save your routine. The document updates, then you both confirm the
          same version.
        </p>
        <label>
          Who pays the shared bills?
          <select name="payer" defaultValue={state.plan.payer}>
            <option value="A">{a.name}</option>
            <option value="B">{b.name}</option>
          </select>
          <small>
            The other person transfers their monthly contribution to this
            person.
          </small>
        </label>
        <label>
          When should the transfer arrive?
          <select name="payday" defaultValue={state.plan.payday}>
            {Array.from({ length: 28 }, (_, i) => (
              <option key={i} value={i + 1}>
                Day {i + 1} of each month
              </option>
            ))}
          </select>
        </label>
        <label>
          Discuss unplanned shared purchases from
          <span className="money-input">
            <span>$</span>
            <input
              name="threshold"
              type="number"
              min="0"
              step="0.01"
              defaultValue={dollars(state.plan.threshold)}
              required
            />
          </span>
          <small>For shared purchases. Personal spending stays personal.</small>
        </label>
        <label>
          Our next check-in
          <input
            name="reviewDate"
            type="date"
            defaultValue={state.plan.reviewDate}
            required
          />
        </label>
        <label>
          Anything else we agreed?
          <textarea
            name="notes"
            maxLength={1200}
            rows={3}
            defaultValue={state.plan.notes}
            placeholder="How will we handle grocery overspending? What would make us revisit this sooner?"
          />
        </label>
        {stale && (
          <p className="error">
            A newer version is available. Reopen this step before saving.
          </p>
        )}
        <button className="button secondary full" disabled={busy || stale}>
          {busy ? "Saving…" : "Save these details"}
          <Check size={16} />
        </button>
        <p className="fine-print">
          Saving a change creates a new version for both of you to review.
        </p>
      </form>
    </div>
  );
}
