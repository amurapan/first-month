"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  LockKeyhole,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { AnimatedMoney, PlanAssembly } from "@/components/motion";
import QuickComparison, {
  money,
  type QuickMethod,
} from "@/components/quick-comparison";
import { inputCents } from "@/lib/domain/preview.js";
import { clearDraft, readDraft, writeDraft } from "@/lib/browser-draft";

const storageKey = "fm:quick-draft:v1";
type Draft = {
  step: number;
  income: string;
  partnerIncome: string;
  unknown: boolean;
  total: string;
  detailed: boolean;
  rows: { id: string; label: string; value: string }[];
  method: QuickMethod;
  name: string;
  partnerName: string;
  moveDate: string;
};
const initial: Draft = {
  step: 0,
  income: "",
  partnerIncome: "",
  unknown: false,
  total: "",
  detailed: false,
  rows: [
    { id: "rent", label: "Rent", value: "" },
    { id: "utilities", label: "Utilities & internet", value: "" },
    { id: "groceries", label: "Groceries", value: "" },
    { id: "other", label: "Other shared costs", value: "" },
  ],
  method: "equal",
  name: "",
  partnerName: "",
  moveDate: "",
};
function validDraft(value: unknown): value is Draft {
  const v = value as Draft | null;
  return (
    !!v &&
    [0, 1, 2].includes(v.step) &&
    [
      "income",
      "partnerIncome",
      "total",
      "name",
      "partnerName",
      "moveDate",
    ].every((key) => typeof v[key as keyof Draft] === "string") &&
    typeof v.unknown === "boolean" &&
    typeof v.detailed === "boolean" &&
    ["equal", "proportional"].includes(v.method) &&
    Array.isArray(v.rows) &&
    v.rows.length > 0 &&
    v.rows.length <= 12 &&
    v.rows.every((row) =>
      ["id", "label", "value"].every(
        (key) => typeof row[key as keyof typeof row] === "string",
      ),
    )
  );
}
function expenses(draft: Draft) {
  if (!draft.detailed)
    return [
      {
        id: "shared",
        label: "Shared monthly expenses",
        amount: inputCents(draft.total),
      },
    ];
  const rows = draft.rows
    .filter((row) => row.value.trim() !== "")
    .map((row) => ({
      id: row.id,
      label: row.label.trim(),
      amount: inputCents(row.value),
    }));
  if (!rows.length || rows.some((row) => !row.label))
    throw new Error("Add at least one expense with a name and amount.");
  if (rows.reduce((sum, row) => sum + row.amount, 0) > 100_000_000)
    throw new Error("Use a total of $1,000,000 or less.");
  return rows;
}
function numbers(draft: Draft) {
  return {
    income: inputCents(draft.income),
    partnerIncome: draft.unknown ? null : inputCents(draft.partnerIncome),
  };
}

export default function StartWizard() {
  const [draft, setDraft] = useState<Draft>(initial),
    [ready, setReady] = useState(false),
    [persisted, setPersisted] = useState(true),
    [restored, setRestored] = useState(false),
    [busy, setBusy] = useState(false),
    [assembling, setAssembling] = useState(false),
    [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comparisonShown = useRef(false);
  useEffect(
    () => () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
    },
    [],
  );
  useEffect(() => {
    const saved = readDraft<unknown>(storageKey);
    if (validDraft(saved)) {
      let step = saved.step;
      try {
        numbers(saved);
      } catch {
        step = 0;
      }
      if (step === 2) {
        try {
          expenses(saved);
        } catch {
          step = 1;
        }
      }
      setDraft({ ...saved, step });
      comparisonShown.current = step === 2;
      setRestored(true);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) setPersisted(writeDraft(storageKey, draft));
  }, [draft, ready]);
  function change(values: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...values }));
    setError("");
  }
  function go(step: number) {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    setAssembling(false);
    change({ step });
    requestAnimationFrame(() => {
      heading.current?.focus();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }
  function next(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (assembling) return;
    try {
      if (draft.step === 0) {
        const n = numbers(draft);
        if (n.partnerIncome === null || n.income + n.partnerIncome === 0)
          change({ method: "equal" });
      } else {
        expenses(draft);
        if (
          !comparisonShown.current &&
          !matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          comparisonShown.current = true;
          setAssembling(true);
          window.scrollTo({ top: 0, behavior: "instant" });
          revealTimer.current = setTimeout(() => go(2), 1250);
          return;
        }
      }
      go(draft.step + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      const n = numbers(draft),
        rows = expenses(draft),
        method =
          draft.method === "proportional" &&
          (n.partnerIncome === null || n.income + n.partnerIncome === 0)
            ? "equal"
            : draft.method;
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim() || "Partner 1",
          partnerName: draft.partnerName.trim() || "Partner 2",
          moveDate: draft.moveDate || null,
          quickStart: { ...n, expenses: rows, method },
        }),
      });
      const data = (await response.json()) as {
        id: string;
        token: string;
        invite: string;
        error?: string;
      };
      if (!response.ok)
        throw new Error(
          data.error || "Your draft could not be saved. Please try again.",
        );
      const link = "/space/" + data.id + "#key=" + data.token;
      try {
        localStorage.setItem("fm:invite:" + data.id, data.invite);
        localStorage.setItem("fm:recent", link);
        writeDraft("fm:step:" + data.id + ":A", 2);
      } catch {
        /* The personal link still grants access. */
      }
      clearDraft(storageKey);
      location.assign(link);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  let result: {
    income: number;
    partnerIncome: number | null;
    total: number;
  } | null = null;
  if (draft.step === 2) {
    try {
      result = {
        ...numbers(draft),
        total: expenses(draft).reduce((sum, row) => sum + row.amount, 0),
      };
    } catch {
      /* Go back to the relevant input. */
    }
  }
  if (!ready)
    return (
      <div className="wizard-shell">
        <header>
          <Brand />
        </header>
        <main className="wizard-loading">Opening your starting point…</main>
      </div>
    );
  return (
    <div className="wizard-shell">
      <header className="wizard-header">
        <Brand />
        <a href="/" className="text-button">
          <ArrowLeft size={16} /> Back to home
        </a>
      </header>
      <main
        className={
          "wizard-main " + (draft.step === 2 ? "wizard-result-main" : "")
        }
      >
        <nav className="wizard-progress" aria-label="Your first calculation">
          {["Incomes", "Shared costs", "Your options"].map((label, index) => (
            <div
              key={label}
              className={
                index === draft.step
                  ? "current"
                  : index < draft.step
                    ? "complete"
                    : ""
              }
              aria-current={index === draft.step ? "step" : undefined}
            >
              <span>
                {index < draft.step ? <Check size={15} /> : index + 1}
              </span>
              {label}
            </div>
          ))}
        </nav>
        {restored && !assembling && (
          <p className="draft-restored">
            <Check size={14} /> Pick up where you left off.{" "}
            <button
              className="text-button"
              onClick={() => {
                clearDraft(storageKey);
                comparisonShown.current = false;
                setDraft(initial);
                setRestored(false);
                setError("");
              }}
            >
              Start fresh
            </button>
          </p>
        )}
        <div
          className="wizard-heading"
          key={"heading-" + draft.step}
          hidden={assembling}
        >
          <p className="eyebrow">
            {draft.step === 2
              ? "A STARTING POINT, BEFORE THE BIG TALK"
              : "A LITTLE CLARITY STARTS HERE"}
          </p>
          <h1 ref={heading} tabIndex={-1}>
            {
              [
                "What comes in each month?",
                "What will you share?",
                "Here’s what your split could look like.",
              ][draft.step]
            }
          </h1>
          <p>
            {
              [
                "Take-home pay, after tax. An estimate is enough to explore your options.",
                "Start with one monthly total. You can add the details together later.",
                "Compare contributions now. Your partner can add their own numbers before you agree.",
              ][draft.step]
            }
          </p>
        </div>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        {assembling && <PlanAssembly onSkip={() => go(2)} />}
        {draft.step < 2 && !assembling && (
          <form
            className="wizard-card"
            key={"form-" + draft.step}
            onSubmit={next}
          >
            {draft.step === 0 ? (
              <>
                <div className="wizard-income-fields">
                  <label>
                    <span className="field-person">
                      <span className="avatar">1</span>Your monthly income
                    </span>
                    <span className="money-input">
                      <span>$</span>
                      <input
                        autoFocus
                        name="income"
                        aria-label="Your monthly income"
                        inputMode="decimal"
                        type="number"
                        min="0"
                        max="1000000"
                        step="0.01"
                        placeholder="e.g. 4500"
                        value={draft.income}
                        onChange={(e) => change({ income: e.target.value })}
                        required
                      />
                      <span>/ month</span>
                    </span>
                  </label>
                  <label>
                    <span className="field-person">
                      <span className="avatar peach">2</span>Your partner’s
                      income <small>Estimate</small>
                    </span>
                    <span
                      className={
                        "money-input " + (draft.unknown ? "field-disabled" : "")
                      }
                    >
                      <span>$</span>
                      <input
                        name="partnerIncome"
                        aria-label="Your partner’s monthly income"
                        inputMode="decimal"
                        type="number"
                        min="0"
                        max="1000000"
                        step="0.01"
                        placeholder="e.g. 3000"
                        value={draft.partnerIncome}
                        disabled={draft.unknown}
                        onChange={(e) =>
                          change({ partnerIncome: e.target.value })
                        }
                        required={!draft.unknown}
                      />
                      <span>/ month</span>
                    </span>
                  </label>
                </div>
                <label className="unknown-income">
                  <input
                    type="checkbox"
                    checked={draft.unknown}
                    onChange={(e) =>
                      change({
                        unknown: e.target.checked,
                        ...(e.target.checked
                          ? { method: "equal" as const }
                          : {}),
                      })
                    }
                  />{" "}
                  I don’t know my partner’s income yet
                </label>
                <p className="wizard-reassurance">
                  <LockKeyhole size={16} /> These are your estimates. Nothing is
                  shared with your partner yet.
                </p>
              </>
            ) : (
              <>
                <label className="wizard-total-label">
                  Your shared monthly costs
                  {!draft.detailed && (
                    <span className="money-input">
                      <span>$</span>
                      <input
                        autoFocus
                        name="total"
                        aria-label="Shared monthly costs"
                        inputMode="decimal"
                        type="number"
                        min="0"
                        max="1000000"
                        step="0.01"
                        placeholder="e.g. 2800"
                        value={draft.total}
                        onChange={(e) => change({ total: e.target.value })}
                        required
                      />
                      <span>/ month</span>
                    </span>
                  )}
                  <small>
                    Rent, groceries, utilities, and anything else you plan to
                    share. Leave personal bills out.
                  </small>
                </label>
                <button
                  className="text-button breakdown-toggle"
                  type="button"
                  aria-expanded={draft.detailed}
                  onClick={() => change({ detailed: !draft.detailed })}
                >
                  {draft.detailed
                    ? "Use one total instead"
                    : "Need help adding it up?"}{" "}
                  <Plus size={16} />
                </button>
                {draft.detailed && (
                  <div className="wizard-breakdown">
                    <p>
                      Your itemized list replaces the single total. Leave unused
                      amounts blank.
                    </p>
                    {draft.rows.map((row) => (
                      <div className="wizard-expense-row" key={row.id}>
                        <input
                          aria-label="Expense name"
                          value={row.label}
                          maxLength={60}
                          onChange={(e) =>
                            change({
                              rows: draft.rows.map((item) =>
                                item.id === row.id
                                  ? { ...item, label: e.target.value }
                                  : item,
                              ),
                            })
                          }
                        />
                        <span className="money-input">
                          <span>$</span>
                          <input
                            aria-label={row.label + " amount"}
                            value={row.value}
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="0"
                            onChange={(e) =>
                              change({
                                rows: draft.rows.map((item) =>
                                  item.id === row.id
                                    ? { ...item, value: e.target.value }
                                    : item,
                                ),
                              })
                            }
                          />
                        </span>
                        <button
                          className="icon-button"
                          type="button"
                          aria-label={"Remove " + row.label}
                          disabled={draft.rows.length === 1}
                          onClick={() =>
                            change({
                              rows: draft.rows.filter(
                                (item) => item.id !== row.id,
                              ),
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-button"
                      disabled={draft.rows.length >= 12}
                      onClick={() =>
                        change({
                          rows: [
                            ...draft.rows,
                            { id: crypto.randomUUID(), label: "", value: "" },
                          ],
                        })
                      }
                    >
                      <Plus size={15} /> Add an expense
                    </button>
                    <div className="wizard-running-total">
                      <span>Your monthly total</span>
                      <strong>
                        {money(
                          draft.rows.reduce((sum, row) => {
                            try {
                              return sum + inputCents(row.value || "0");
                            } catch {
                              return sum;
                            }
                          }, 0),
                        )}
                      </strong>
                    </div>
                  </div>
                )}
                <div className="wizard-next-preview">
                  <span>Up next</span>
                  <p>
                    See what 50 / 50
                    {draft.unknown ? "" : " and an income-based split"} would
                    mean for both of you.
                  </p>
                </div>
              </>
            )}
            <div className="wizard-actions">
              {draft.step > 0 ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => go(0)}
                >
                  <ChevronLeft size={17} /> Back
                </button>
              ) : (
                <span>Two short steps. Then your comparison.</span>
              )}
              <button className="button primary large" type="submit">
                {draft.step === 0 ? "Next: shared costs" : "See our options"}
                <ArrowRight size={18} />
              </button>
            </div>
          </form>
        )}
        {draft.step === 2 && result && (
          <>
            <div className="wizard-result-summary">
              <span>
                Shared monthly costs
                <strong>
                  <AnimatedMoney value={result.total} enter />
                </strong>
              </span>
              <button className="text-button" onClick={() => go(0)}>
                <RotateCcw size={15} /> Edit the numbers
              </button>
            </div>
            <QuickComparison
              {...result}
              method={draft.method}
              onMethod={(method) => change({ method })}
            />
            <div className="wizard-save-card">
              <div>
                <p className="overline">MAKE IT A CONVERSATION</p>
                <h2>A starting point you can share.</h2>
                <p>
                  Keep this draft, then invite your partner. They’ll add their
                  own income, and you’ll both review the plan.
                </p>
              </div>
              <button
                className="button primary large"
                disabled={busy}
                onClick={save}
              >
                {busy ? "Saving your draft…" : "Keep this plan"}
                <ArrowRight size={18} />
              </button>
              <details className="wizard-personalize">
                <summary>
                  Add names or a move-in date <span>Optional</span>
                </summary>
                <div className="form-grid">
                  <label>
                    Your name
                    <input
                      autoComplete="given-name"
                      maxLength={60}
                      value={draft.name}
                      onChange={(e) => change({ name: e.target.value })}
                      placeholder="Partner 1"
                    />
                  </label>
                  <label>
                    Your partner’s name
                    <input
                      maxLength={60}
                      value={draft.partnerName}
                      onChange={(e) => change({ partnerName: e.target.value })}
                      placeholder="Partner 2"
                    />
                  </label>
                </div>
                <label>
                  Move-in date
                  <input
                    type="date"
                    value={draft.moveDate}
                    onChange={(e) => change({ moveDate: e.target.value })}
                  />
                </label>
              </details>
              <p className="fine-print">
                <LockKeyhole size={13} /> Saving creates your private access
                link. You choose when to share your answers.
              </p>
            </div>
            <button className="text-button wizard-back" onClick={() => go(1)}>
              <ChevronLeft size={16} /> Back to shared costs
            </button>
          </>
        )}
        <footer className="wizard-footer">
          <span>
            <LockKeyhole size={13} />
            {persisted
              ? "Draft saved in this browser"
              : "Browser storage unavailable — keep this page open"}
          </span>
          <button
            className="text-button"
            onClick={() => {
              if (revealTimer.current) clearTimeout(revealTimer.current);
              setAssembling(false);
              comparisonShown.current = false;
              clearDraft(storageKey);
              setDraft(initial);
              setRestored(false);
              setError("");
            }}
          >
            Clear draft
          </button>
        </footer>
      </main>
    </div>
  );
}
