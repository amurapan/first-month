"use client";
import SharingStatus from "./sharing-status";
import { AnimatedMoney } from "@/components/motion";
import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  Download,
  LockKeyhole,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { SpaceAction, SpaceState } from "@/lib/life-types";
import type { MonthView, MonthEntry, MonthSnapshot } from "@/lib/month-types";
import {
  currentMonth,
  currentSettlement,
  monthOutstanding,
  monthTitle,
  monthTotals,
  refundable,
} from "@/lib/domain/month.js";
import { inputCents } from "@/lib/domain/preview.js";
import {
  downloadFile,
  DraftStatus,
  fullDate,
  MoneyInput,
  money,
  useSavedDraft,
} from "./shared";
type Props = {
  state: SpaceState;
  busy: boolean;
  act: SpaceAction;
  onError: (s: string) => void;
  planLink: (step?: number) => string;
  onShare: () => Promise<unknown>;
  onInvite: () => Promise<void>;
};
type Editor = {
  kind: "expense" | "refund" | "transfer";
  categoryId?: string;
  originalId?: string;
  entry?: MonthEntry;
};
function splitLabel(month: MonthView) {
  const { method, weights } = month.baseline;
  return method === "equal"
    ? "Equal shares"
    : (method === "custom"
        ? "Your planned contribution ratio"
        : "Income-based shares") +
        " · " +
        ((weights[0] / (weights[0] + weights[1])) * 100).toFixed(1) +
        "% / " +
        ((weights[1] / (weights[0] + weights[1])) * 100).toFixed(1) +
        "%";
}
function exportCsv(month: MonthView) {
  const pair = month.baseline.names,
    totals = monthTotals(month),
    outstanding = monthOutstanding(month),
    receipt = currentSettlement(month);
  const rows: unknown[][] = [
    ["First Month", monthTitle(month.period)],
    ["Status", month.status],
    ["Version", month.version],
    ["Recorded shared costs USD", totals.total / 100],
    ["Remaining reimbursement USD", Math.abs(outstanding) / 100],
    [
      "Reimbursement from",
      outstanding ? pair[outstanding > 0 ? 0 : 1] : "None",
    ],
    [
      "Title",
      "Type",
      "Date",
      "Category",
      "Amount USD",
      pair[0] + " amount USD",
      pair[1] + " amount USD",
      "Transfer confirmed",
      "Recorded by",
    ],
    ...month.entries.map((e) => [
      e.title,
      e.kind,
      e.date,
      month.baseline.expenses.find((x) => x.id === e.categoryId)?.label ||
        e.categoryId,
      ((e.kind === "refund" ? -1 : 1) * e.amount) / 100,
      ((e.kind === "refund" ? -1 : 1) * e.paidA) / 100,
      ((e.kind === "refund" ? -1 : 1) * (e.amount - e.paidA)) / 100,
      e.kind === "transfer" ? (e.confirmed ? "yes" : "pending") : "",
      pair[e.author === "A" ? 0 : 1],
    ]),
    ...(receipt
      ? [
          [
            "Final settlement for version " + receipt.version,
            "settlement",
            receipt.reportedAt.slice(0, 10),
            "transfer",
            receipt.amount / 100,
            receipt.from === "A" ? receipt.amount / 100 : 0,
            receipt.from === "B" ? receipt.amount / 100 : 0,
            receipt.receivedAt ? "yes" : "pending",
            pair[receipt.from === "A" ? 0 : 1],
          ],
        ]
      : []),
  ];
  const csv = rows
    .map((row) =>
      row
        .map((v) => {
          const s =
            typeof v === "string" && /^[=+\-@\t\r]/.test(v)
              ? "'" + v
              : String(v ?? "");
          return '"' + s.replaceAll('"', '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
  downloadFile(
    "first-month-" + month.period + ".csv",
    "\uFEFF" + csv,
    "text/csv",
  );
}
function statement(month: MonthView, snapshot?: MonthSnapshot) {
  const record = snapshot || month,
    t = monthTotals(record),
    pair = record.baseline.names,
    receipt = month.settlements.find((x) => x.version === record.version);
  return [
    "FIRST MONTH — " + monthTitle(month.period),
    "Version " +
      record.version +
      " · " +
      (snapshot || month.status === "agreed"
        ? "Confirmed by both people"
        : "Draft — not yet confirmed by both"),
    "",
    ...pair.map(
      (n, i) =>
        n +
        ": covered " +
        money(t.paid[i]) +
        ", share of costs " +
        money(t.shares[i]),
    ),
    "Recorded shared costs: " + money(t.total),
    "Planned shared costs: " + money(t.planned),
    "",
    t.balance
      ? (receipt?.receivedAt
          ? "Reimbursement completed: "
          : "Reimbursement: ") +
        pair[t.balance > 0 ? 0 : 1] +
        " to reimburse " +
        pair[t.balance > 0 ? 1 : 0] +
        ": " +
        money(Math.abs(t.balance))
      : "No reimbursement due.",
    receipt?.receivedAt
      ? "Final settlement received and confirmed " +
        fullDate(receipt.receivedAt)
      : receipt
        ? "Final settlement reported, awaiting recipient confirmation."
        : "",
    "Remaining reimbursement: " +
      money(receipt?.receivedAt ? 0 : Math.abs(t.balance)),
    "",
    ...record.entries.map(
      (e) =>
        e.date +
        " · " +
        e.title +
        " · " +
        e.kind +
        " · " +
        money(e.kind === "refund" ? -e.amount : e.amount) +
        (e.kind === "transfer"
          ? " · " +
            pair[e.paidA === e.amount ? 0 : 1] +
            " to " +
            pair[e.paidA === e.amount ? 1 : 0] +
            " · " +
            (e.confirmed ? "received" : "pending")
          : " · " +
            pair[0] +
            ": " +
            money(e.paidA) +
            ", " +
            pair[1] +
            ": " +
            money(e.amount - e.paidA)),
    ),
    "",
    "Self-reported records. First Month does not move or verify money.",
  ].join("\n");
}
export default function MonthBook({
  state,
  busy,
  act,
  onError,
  planLink,
  onShare,
  onInvite,
}: Props) {
  const [period, setPeriod] = useState(() => {
    if (typeof location === "undefined") return currentMonth();
    const p = new URL(location.href).searchParams.get("month");
    return p && /^\d{4}-(0[1-9]|1[0-2])$/.test(p) && p <= currentMonth()
      ? p
      : currentMonth();
  });
  const [editor, updateEditor] = useState<Editor | null>(() => {
      if (typeof location === "undefined") return null;
      const u = new URL(location.href),
        kind = u.searchParams.get("entry");
      if (kind === "edit") {
        const entry = state.months
          .find((x) => x.period === period)
          ?.entries.find((e) => e.id === u.searchParams.get("entryId"));
        return entry ? { kind: entry.kind, entry } : null;
      }
      return kind && ["expense", "refund", "transfer"].includes(kind)
        ? {
            kind: kind as Editor["kind"],
            categoryId: u.searchParams.get("category") || undefined,
            originalId: u.searchParams.get("original") || undefined,
          }
        : null;
    }),
    [search, setSearch] = useState(""),
    [removing, setRemoving] = useState(""),
    [startSplit, setStartSplit] = useState("plan");
  const setEditor = (next: Editor | null) => {
    updateEditor(next);
    const u = new URL(location.href);
    for (const k of ["entry", "entryId", "category", "original"])
      u.searchParams.delete(k);
    if (next) {
      u.searchParams.set("entry", next.entry ? "edit" : next.kind);
      if (next.entry) u.searchParams.set("entryId", next.entry.id);
      if (next.categoryId) u.searchParams.set("category", next.categoryId);
      if (next.originalId) u.searchParams.set("original", next.originalId);
    }
    history.replaceState({}, "", u);
  };
  useEffect(() => {
    if (editor) {
      requestAnimationFrame(() => {
        const form = document.querySelector(".month-entry-form");
        form?.scrollIntoView({
          block: "start",
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        });
        (form?.querySelector("input") as HTMLInputElement | null)?.focus({
          preventScroll: true,
        });
      });
    }
  }, [editor]);
  const [shown, setShown] = useState(10);
  const month = state.months.find((x) => x.period === period),
    pair = month?.baseline.names || [
      state.role === "A" ? state.self.name : state.partner.name,
      state.role === "B" ? state.self.name : state.partner.name,
    ];
  const periods = [
    ...new Set([
      ...Array.from({ length: 12 }, (_, n) => {
        const d = new Date();
        d.setUTCDate(1);
        d.setUTCMonth(d.getUTCMonth() - n);
        return currentMonth(d.toISOString());
      }),
      ...state.months.map((x) => x.period),
    ]),
  ]
    .sort()
    .reverse();
  const changePeriod = (next: string) => {
    setPeriod(next);
    setEditor(null);
    setSearch("");
    setShown(10);
    const url = new URL(location.href);
    url.searchParams.set("month", next);
    history.replaceState({}, "", url);
  };
  const run = (action: string, data: Record<string, unknown> = {}) =>
    act(action, { period, revision: month?.revision, ...data });
  if (!state.bothShared)
    return (
      <div className="spending-setup">
        <div className="life-heading">
          <p className="eyebrow">ACTUAL PAYMENTS</p>
          <h1>Shared spending.</h1>
          <p>
            Record what was paid, who covered it, and any money to settle
            between you.
          </p>
        </div>
        <SharingStatus
          state={state}
          busy={busy}
          onShare={onShare}
          onInvite={onInvite}
          editLink={planLink(0)}
          context="spending"
        />
      </div>
    );
  const older = state.months.find(
    (m) =>
      m.period < period && m.status === "agreed" && monthOutstanding(m) !== 0,
  );
  const totals = month ? monthTotals(month) : null,
    receipt = month ? currentSettlement(month) : undefined,
    outstanding = month ? monthOutstanding(month) : 0;
  const rows =
    month?.entries
      .filter((e) =>
        [
          e.title,
          e.kind,
          month.baseline.expenses.find((x) => x.id === e.categoryId)?.label ||
            "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
      .toSorted(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          b.createdAt.localeCompare(a.createdAt),
      ) || [];
  return (
    <div className="month-book">
      <p className="month-print-title">
        {monthTitle(period)}
        {state.demo ? " · Fictional sample household" : ""}
      </p>
      <div className="life-heading heading-with-action">
        <div>
          <p className="eyebrow">FROM THE PLAN TO REAL LIFE</p>
          <h1>
            Keep the month
            <br />
            <span>between you.</span>
          </h1>
          <p>
            What you spent. What each of you covered. A clear way to settle up.
          </p>
        </div>
        <div className="month-header-actions">
          {month?.status === "open" && (
            <button
              className="button primary"
              aria-label="Quick add expense"
              onClick={() => setEditor({ kind: "expense" })}
            >
              <Plus size={17} />
              Add expense
            </button>
          )}
          <label className="month-picker">
            Review month
            <select
              aria-label="Review month"
              value={period}
              onChange={(e) => changePeriod(e.target.value)}
            >
              {periods.map((p) => (
                <option key={p} value={p}>
                  {monthTitle(p)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {older && (
        <div className="notice month-older">
          <ReceiptText size={19} />
          <p>
            {money(Math.abs(monthOutstanding(older)))} is still outstanding for{" "}
            {monthTitle(older.period)}. It is kept separate from this month.
          </p>
          <button
            className="text-button"
            onClick={() => changePeriod(older.period)}
          >
            Review that month
            <ArrowRight size={15} />
          </button>
        </div>
      )}
      {!month ? (
        <section className="month-start surface">
          <div className="month-start-icon">
            <ReceiptText size={35} />
          </div>
          <p className="eyebrow">{monthTitle(period).toUpperCase()}</p>
          <h2>Start with the plan you have.</h2>
          <p>
            Your current categories and split become this month’s starting
            point. Add what you actually paid as you go; nothing is marked paid
            automatically.
          </p>
          <div className="month-start-facts">
            <span>
              Planned shared costs
              <strong>
                {money(state.expenses.reduce((n, x) => n + x.amount, 0))}
              </strong>
            </span>
            <span>
              Categories<strong>{state.expenses.length}</strong>
            </span>
          </div>
          <label>
            How should this month’s actual costs be split?
            <select
              value={startSplit}
              onChange={(e) => setStartSplit(e.target.value)}
            >
              <option value="plan">
                Use our current plan’s{" "}
                {state.plan.method === "proportional"
                  ? "income-based shares"
                  : state.plan.method === "custom"
                    ? "contribution ratio"
                    : "equal shares"}
              </option>
              <option value="equal">Use equal shares for this month</option>
            </select>
          </label>
          <p className="fine-print">
            {state.plan.method === "custom" && startSplit === "plan"
              ? "Actual costs will use the ratio of your planned contributions, not the same fixed dollar amounts. "
              : ""}
            You both review the final costs and split before confirming the
            month.
          </p>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => run("start", { split: startSplit })}
          >
            Start {monthTitle(period).split(" ")[0]}
            <ArrowRight size={17} />
          </button>
          <p className="month-scope">
            For shared costs paid from your personal money. Purchases from an
            already shared savings pot and payments from a joint account are
            outside this ledger.
          </p>
        </section>
      ) : (
        <>
          <div className="month-summary">
            <div className="month-summary-top">
              <span
                className={
                  "status-tag " + (month.status === "agreed" ? "green" : "")
                }
              >
                {month.status === "agreed"
                  ? "Confirmed together"
                  : "Month in progress"}
              </span>
              <span>{splitLabel(month)}</span>
            </div>
            <div className="month-stats">
              <div>
                <span>Shared costs recorded</span>
                <strong>
                  <AnimatedMoney value={totals!.total} enter />
                </strong>
                <small>
                  {totals!.expenseCount}{" "}
                  {totals!.expenseCount === 1 ? "expense" : "expenses"} · after
                  refunds
                </small>
              </div>
              <div>
                <span>Monthly plan</span>
                <strong>
                  <AnimatedMoney value={totals!.planned} enter />
                </strong>
                <small>Saved from plan v{month.baseline.planVersion}</small>
              </div>
              <div className={totals!.difference > 0 ? "over-budget" : ""}>
                <span>
                  {totals!.difference > 0
                    ? "Above the plan"
                    : "Not yet used in the plan"}
                </span>
                <strong>
                  <AnimatedMoney value={Math.abs(totals!.difference)} enter />
                </strong>
                <small>
                  {period === currentMonth()
                    ? "Month still underway · entries may be incomplete"
                    : "Based only on recorded expenses"}
                </small>
              </div>
              <div>
                <span>
                  {month.status === "agreed"
                    ? "Remaining reimbursement"
                    : "Projected reimbursement"}
                </span>
                <strong>
                  <AnimatedMoney value={Math.abs(outstanding)} enter />
                </strong>
                <small>
                  {outstanding
                    ? pair[outstanding > 0 ? 0 : 1] +
                      " → " +
                      pair[outstanding > 0 ? 1 : 0]
                    : totals!.expenseCount
                      ? "No reimbursement due"
                      : "Add costs to begin"}
                </small>
              </div>
            </div>
          </div>
          <div className="month-workspace">
            <div className="month-ledger-column">
              <div className="month-section-heading">
                <div>
                  <p className="eyebrow">THE NUMBERS BEHIND YOUR MONTH</p>
                  <h2>Your shared activity.</h2>
                </div>
                {month.status === "open" && !editor && (
                  <button
                    className="button primary"
                    onClick={() => setEditor({ kind: "expense" })}
                  >
                    <Plus size={17} />
                    Add expense
                  </button>
                )}
              </div>
              {month.status === "open" && !editor && (
                <div className="month-quick-categories">
                  {month.baseline.expenses.slice(0, 5).map((c) => (
                    <button
                      key={c.id}
                      onClick={() =>
                        setEditor({ kind: "expense", categoryId: c.id })
                      }
                    >
                      <Plus size={13} />
                      {c.label}
                    </button>
                  ))}
                  <button onClick={() => setEditor({ kind: "transfer" })}>
                    <ArrowUpRight size={14} />I sent money
                  </button>
                </div>
              )}
              {editor && month.status === "open" && (
                <EntryForm
                  key={
                    period +
                    ":" +
                    state.role +
                    ":" +
                    (editor.entry?.id || editor.originalId || editor.kind) +
                    ":" +
                    (editor.categoryId || "")
                  }
                  editor={editor}
                  month={month}
                  role={state.role}
                  busy={busy}
                  onSave={async (entry) => {
                    const result = await run(editor.entry ? "edit" : "add", {
                      entry,
                      expectedUpdatedAt: editor.entry?.updatedAt,
                    });
                    if (result) setEditor(null);
                    return result;
                  }}
                  onClose={() => setEditor(null)}
                  onError={onError}
                />
              )}
              {month.entries.length > 3 && (
                <label className="month-search">
                  <Search size={17} />
                  <input
                    aria-label="Search this month"
                    placeholder="Find an expense or transfer"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              )}
              {!month.entries.length ? (
                <div className="month-empty">
                  <ReceiptText size={31} />
                  <h3>Your first expense makes it real.</h3>
                  <p>
                    Add a bill or purchase either of you paid from personal
                    funds. Planned bills and saving goals don’t appear as
                    payments here.
                  </p>
                </div>
              ) : rows.length ? (
                <div className="month-entries">
                  {rows.slice(0, shown).map((e) => {
                    const isTransfer = e.kind === "transfer",
                      a = e.paidA === e.amount,
                      b = e.paidA === 0,
                      covered = a ? pair[0] : b ? pair[1] : "Both of you",
                      canEdit =
                        e.author === state.role &&
                        !e.locked &&
                        !e.confirmed &&
                        month.status === "open",
                      canRefund =
                        e.kind === "expense" &&
                        refundable(month.entries, e.id) > 0 &&
                        month.status === "open";
                    return (
                      <article key={e.id} className={"month-entry " + e.kind}>
                        <span className="entry-icon">
                          {isTransfer ? (
                            <ArrowUpRight size={18} />
                          ) : e.kind === "refund" ? (
                            <RotateCcw size={18} />
                          ) : (
                            <ReceiptText size={18} />
                          )}
                        </span>
                        <div className="entry-description">
                          <h3>{e.title}</h3>
                          <p>
                            {fullDate(e.date)} ·{" "}
                            {isTransfer
                              ? `${covered} → ${a ? pair[1] : pair[0]}`
                              : e.kind === "refund"
                                ? `Returned to ${covered}`
                                : `${covered} covered this`}
                          </p>
                          {!a && !b && !isTransfer && (
                            <small>
                              {pair[0]} {money(e.paidA)} · {pair[1]}{" "}
                              {money(e.amount - e.paidA)}
                            </small>
                          )}
                          <small>
                            Added by {pair[e.author === "A" ? 0 : 1]}
                            {e.locked ? " · From a confirmed settlement" : ""}
                          </small>
                          {isTransfer && (
                            <span
                              className={
                                "transfer-tag " +
                                (e.confirmed ? "confirmed" : "")
                              }
                            >
                              {e.confirmed
                                ? "Receipt confirmed"
                                : "Waiting for the recipient · not counted yet"}
                            </span>
                          )}
                          {isTransfer &&
                            !e.confirmed &&
                            e.author !== state.role &&
                            month.status === "open" && (
                              <div className="entry-actions">
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    run("confirmTransfer", { entryId: e.id })
                                  }
                                >
                                  <Check size={13} />I received this
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    run("rejectTransfer", { entryId: e.id })
                                  }
                                >
                                  I didn’t receive this
                                </button>
                              </div>
                            )}
                          {(canEdit || canRefund) && (
                            <div className="entry-actions">
                              {canEdit && (
                                <>
                                  <button
                                    onClick={() =>
                                      setEditor({ kind: e.kind, entry: e })
                                    }
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() =>
                                      setRemoving(removing === e.id ? "" : e.id)
                                    }
                                  >
                                    <Trash2 size={12} />
                                    Remove
                                  </button>
                                </>
                              )}
                              {canRefund && (
                                <button
                                  onClick={() =>
                                    setEditor({
                                      kind: "refund",
                                      originalId: e.id,
                                    })
                                  }
                                >
                                  Add a refund
                                </button>
                              )}
                            </div>
                          )}
                          {removing === e.id && (
                            <div className="entry-remove">
                              <span>Remove this entry for both of you?</span>
                              <button
                                disabled={busy}
                                onClick={async () => {
                                  if (await run("remove", { entryId: e.id }))
                                    setRemoving("");
                                }}
                              >
                                Remove entry
                              </button>
                              <button onClick={() => setRemoving("")}>
                                Keep it
                              </button>
                            </div>
                          )}
                        </div>
                        <strong className="entry-amount">
                          {e.kind === "refund" ? "−" : ""}
                          {money(e.amount)}
                        </strong>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="month-empty">No entries match “{search}”.</p>
              )}
              {rows.length > shown && (
                <button
                  className="button secondary month-show-more"
                  onClick={() => setShown((n) => n + 10)}
                >
                  Show more activity ({rows.length - shown} remaining)
                  <ChevronDown size={16} />
                </button>
              )}
              <div className="month-record-actions">
                <button
                  className="text-button"
                  onClick={() => exportCsv(month)}
                >
                  <Download size={15} />
                  Export CSV
                </button>
                <button
                  className="text-button"
                  onClick={() =>
                    downloadFile(
                      "first-month-" + period + ".txt",
                      statement(month),
                      "text/plain",
                    )
                  }
                >
                  <Download size={15} />
                  Save statement
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    setSearch("");
                    setShown(250);
                    setTimeout(() => window.print(), 100);
                  }}
                >
                  Print
                </button>
              </div>
            </div>
            <aside className="month-balance-column">
              <section className="month-balance">
                <p className="eyebrow">A LITTLE CLARITY BETWEEN YOU</p>
                <h2>
                  {!totals!.expenseCount
                    ? "Ready when you are."
                    : outstanding === 0
                      ? month.status === "agreed"
                        ? "All square, together."
                        : "Your recorded costs are balanced."
                      : `${pair[outstanding > 0 ? 0 : 1]} → ${pair[outstanding > 0 ? 1 : 0]}`}
                </h2>
                {totals!.expenseCount > 0 && (
                  <>
                    <strong className="balance-amount">
                      <AnimatedMoney value={Math.abs(outstanding)} enter />
                    </strong>
                    <p>
                      {month.status === "open"
                        ? "Projected reimbursement from the entries below. Both people still need to confirm the month."
                        : receipt?.receivedAt
                          ? "The recipient confirmed receiving the settlement."
                          : outstanding
                            ? "Costs confirmed. This reimbursement is still outstanding."
                            : "Costs confirmed. No reimbursement is due."}
                    </p>
                  </>
                )}
                <div className="month-person-totals">
                  {pair.map((n, i) => (
                    <div key={i}>
                      <span className={"person-orb person-" + i}>{n[0]}</span>
                      <strong>{n}</strong>
                      <dl>
                        <div>
                          <dt>Costs covered</dt>
                          <dd>
                            <AnimatedMoney value={totals!.paid[i]} enter />
                          </dd>
                        </div>
                        <div>
                          <dt>Share of costs</dt>
                          <dd>
                            <AnimatedMoney value={totals!.shares[i]} enter />
                          </dd>
                        </div>
                        <div>
                          <dt>Confirmed money sent</dt>
                          <dd>
                            <AnimatedMoney value={totals!.sent[i]} enter />
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
                <p className="fine-print">
                  Transfers reimburse a partner; they don’t increase your shared
                  spending. This is a record of what you report, not a payment
                  service.
                </p>
                {month.status === "agreed" && outstanding !== 0 && (
                  <div className="settlement-actions">
                    {receipt ? (
                      <>
                        <p>
                          <ClockNotice /> {pair[receipt.from === "A" ? 0 : 1]}{" "}
                          reported sending {money(receipt.amount)}. Awaiting
                          receipt confirmation.
                        </p>
                        {receipt.from === state.role ? (
                          <button
                            className="button secondary"
                            disabled={busy}
                            onClick={() => run("withdrawSettlement")}
                          >
                            Withdraw my report
                          </button>
                        ) : (
                          <>
                            <button
                              className="button primary"
                              disabled={busy}
                              onClick={() => run("receiveSettlement")}
                            >
                              <CheckCheck size={16} />I received{" "}
                              {money(receipt.amount)}
                            </button>
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() => run("rejectSettlement")}
                            >
                              I haven’t received this
                            </button>
                          </>
                        )}
                      </>
                    ) : state.role === (outstanding > 0 ? "A" : "B") ? (
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => run("reportSettlement")}
                      >
                        <ArrowUpRight size={17} />I sent{" "}
                        {money(Math.abs(outstanding))}
                      </button>
                    ) : (
                      <p>
                        Waiting for {pair[outstanding > 0 ? 0 : 1]} to report
                        the transfer.
                      </p>
                    )}
                  </div>
                )}
              </section>
              <section className="month-categories">
                <p className="eyebrow">PLAN AND REALITY</p>
                <h3>Where the month went.</h3>
                <div className="category-table-labels">
                  <span>Category</span>
                  <span>Recorded / planned</span>
                </div>
                {totals!.categories.map((c) => (
                  <div className="month-category" key={c.id}>
                    <div>
                      <strong>{c.label}</strong>
                      <span>
                        {money(c.actual)}
                        <small> / {money(c.planned)}</small>
                      </span>
                    </div>
                    <div className="category-track">
                      <i
                        className={c.actual > c.planned ? "over" : ""}
                        style={{
                          width:
                            Math.min(
                              100,
                              (c.actual / Math.max(1, c.planned, c.actual)) *
                                100,
                            ) + "%",
                        }}
                      />
                    </div>
                    {c.actual > c.planned && (
                      <small>{money(c.difference)} above plan</small>
                    )}
                  </div>
                ))}
                <p className="fine-print">
                  Unrecorded costs aren’t savings. Add the remaining bills
                  before drawing conclusions.
                </p>
              </section>
            </aside>
          </div>
          <section className="month-agreement">
            <div>
              <p className="eyebrow">ONE MONTH. TWO CONFIRMATIONS.</p>
              <h2>
                {month.status === "agreed"
                  ? "You’ve checked this together."
                  : "Does this match your month?"}
              </h2>
              <p>
                {month.status === "agreed"
                  ? "Your confirmed record stays in history. Reopening needs both people, and keeps this version."
                  : "Review the expenses, refunds, transfers and split. Confirming records your agreement; it never sends money."}
              </p>
              <div className="month-approvals">
                {pair.map((name, i) => (
                  <span
                    key={i}
                    className={
                      month.approvals[i === 0 ? "A" : "B"] ? "yes" : ""
                    }
                  >
                    {month.approvals[i === 0 ? "A" : "B"] ? (
                      <CheckCheck size={16} />
                    ) : (
                      <span className="approval-dot" />
                    )}
                    {name}:{" "}
                    {month.approvals[i === 0 ? "A" : "B"]
                      ? "confirmed"
                      : "still to review"}
                  </span>
                ))}
              </div>
            </div>
            <div className="month-confirm-controls">
              {month.status === "open" ? (
                <>
                  {month.approvals[state.role] ? (
                    <>
                      <p>
                        Your confirmation is saved. Waiting for your partner.
                      </p>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => run("withdrawApproval")}
                      >
                        Withdraw my confirmation
                      </button>
                    </>
                  ) : (
                    <button
                      className="button primary"
                      disabled={
                        busy ||
                        !totals!.expenseCount ||
                        totals!.pending > 0 ||
                        !!editor
                      }
                      onClick={() => run("approve")}
                    >
                      <Check size={17} />
                      Confirm this month
                    </button>
                  )}
                  {totals!.pending > 0 && (
                    <p className="fine-print">
                      Resolve {totals!.pending} pending transfer
                      {totals!.pending > 1 ? "s" : ""} first.
                    </p>
                  )}
                </>
              ) : (
                <>
                  {month.reopen[state.role] ? (
                    <>
                      <p>Waiting for your partner to reopen the month.</p>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => run("cancelReopen")}
                      >
                        Keep the month confirmed
                      </button>
                    </>
                  ) : (
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => run("requestReopen")}
                    >
                      <RotateCcw size={16} />
                      {Object.keys(month.reopen).length
                        ? "Agree to reopen"
                        : "Request a correction"}
                    </button>
                  )}
                </>
              )}
            </div>
          </section>
          <details className="month-plan-details">
            <summary>
              About this month’s plan <ChevronDown size={16} />
            </summary>
            <p>
              Captured {fullDate(month.baseline.capturedAt)} from plan v
              {month.baseline.planVersion}.{" "}
              {month.baseline.sourceConfirmed
                ? "The monthly plan was confirmed by both of you."
                : "The starting plan was a draft; confirming this month also confirms the displayed split for these recorded expenses."}
            </p>
            <p>
              {splitLabel(month)}. Changes to your monthly plan do not rewrite
              this record.{" "}
              {month.baseline.method === "custom"
                ? "The ratio of the planned contributions is applied to the actual total; dollar contributions can change."
                : ""}
            </p>
            <p>
              Only shared costs covered from personal money belong here.
              Joint-account payments and spending from an already shared savings
              pot are not supported. A separate month does not automatically
              carry over an unpaid balance.
            </p>
            {month.status === "open" && (
              <>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => run("refreshPlan", { split: "plan" })}
                >
                  Use our latest monthly plan
                </button>
                <span className="fine-print">
                  This updates the categories and split and clears both
                  confirmations.
                </span>
              </>
            )}
            <a className="text-button" href={planLink(2)}>
              Open monthly plan
              <ArrowRight size={15} />
            </a>
          </details>
          {month.history.length > 0 && (
            <details className="month-history">
              <summary>
                {month.history.length} confirmed{" "}
                {month.history.length === 1 ? "version" : "versions"} saved
                <ChevronDown size={16} />
              </summary>
              {[...month.history].reverse().map((h) => (
                <div key={h.version}>
                  <span>
                    <strong>
                      Version {h.version} · {fullDate(h.agreedAt)}
                    </strong>
                    <small>
                      {money(monthTotals(h).total)} in shared costs · Both
                      confirmed
                    </small>
                  </span>
                  <button
                    className="text-button"
                    onClick={() =>
                      downloadFile(
                        "first-month-" + period + "-v" + h.version + ".txt",
                        statement(month, h),
                        "text/plain",
                      )
                    }
                  >
                    <Download size={15} />
                    Save
                  </button>
                </div>
              ))}
            </details>
          )}
        </>
      )}
    </div>
  );
}
function ClockNotice() {
  return <span aria-hidden="true">◷</span>;
}
function EntryForm({
  editor,
  month,
  role,
  busy,
  onSave,
  onClose,
  onError,
}: {
  editor: Editor;
  month: MonthView;
  role: "A" | "B";
  busy: boolean;
  onSave: (entry: Record<string, unknown>) => Promise<unknown>;
  onClose: () => void;
  onError: (s: string) => void;
}) {
  const e = editor.entry,
    original = month.entries.find((x) => x.id === editor.originalId),
    pair = month.baseline.names;
  const end = new Date(
      Date.UTC(
        Number(month.period.slice(0, 4)),
        Number(month.period.slice(5, 7)),
        0,
        12,
      ),
    )
      .toISOString()
      .slice(0, 10),
    today = new Date().toISOString().slice(0, 10);
  const draft = useSavedDraft(
    "fm:month-entry:" +
      month.period +
      ":" +
      role +
      ":" +
      month.createdAt +
      ":" +
      (e?.id || editor.originalId || editor.kind) +
      ":" +
      (editor.categoryId || "other"),
    {
      id: e?.id || "",
      amount: e ? String(e.amount / 100) : "",
      categoryId: e?.categoryId || editor.categoryId || "other",
      payer: e
        ? e.paidA === e.amount
          ? "A"
          : e.paidA === 0
            ? "B"
            : "both"
        : role,
      paidA: e ? String(e.paidA / 100) : "",
      title:
        e?.title ||
        (editor.kind === "refund" ? "Refund: " + original?.title : ""),
      date: e?.date || (today < end ? today : end),
    },
  );
  const category = month.baseline.expenses.find(
      (x) => x.id === draft.value.categoryId,
    ),
    refunding = editor.kind === "refund",
    transferring = editor.kind === "transfer";
  return (
    <form
      className="month-entry-form"
      onSubmit={async (ev) => {
        ev.preventDefault();
        try {
          const amount = inputCents(draft.value.amount),
            paidA = transferring
              ? role === "A"
                ? amount
                : 0
              : draft.value.payer === "A"
                ? amount
                : draft.value.payer === "B"
                  ? 0
                  : inputCents(draft.value.paidA);
          const id = draft.value.id || crypto.randomUUID();
          draft.change({ id });
          const result = await onSave({
            id,
            kind: editor.kind,
            amount,
            paidA,
            title:
              draft.value.title.trim() ||
              (transferring
                ? "Transfer to " + pair[role === "A" ? 1 : 0]
                : category?.label || "Shared expense"),
            categoryId: transferring ? "transfer" : draft.value.categoryId,
            date: draft.value.date,
            originalId: e?.originalId || editor.originalId,
          });
          if (result) draft.reset();
        } catch (err) {
          onError((err as Error).message);
        }
      }}
    >
      <div className="entry-form-heading">
        <div>
          <p className="eyebrow">
            {e
              ? "EDIT YOUR ENTRY"
              : refunding
                ? "MONEY COMING BACK"
                : transferring
                  ? "BETWEEN THE TWO OF YOU"
                  : "A LITTLE LESS TO KEEP IN YOUR HEAD"}
          </p>
          <h3>
            {e
              ? "Update this entry."
              : refunding
                ? "Record a refund."
                : transferring
                  ? "Record money you sent."
                  : "Add a shared expense."}
          </h3>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Close entry form"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="entry-form-main">
        <MoneyInput
          label={
            refunding
              ? "Refund amount"
              : transferring
                ? "Amount sent"
                : "Amount paid"
          }
          value={draft.value.amount}
          onChange={(amount) => draft.change({ amount })}
        />
        {!refunding && !transferring && (
          <label>
            Category
            <select
              aria-label="Category"
              value={draft.value.categoryId}
              onChange={(ev) => draft.change({ categoryId: ev.target.value })}
            >
              {month.baseline.expenses.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
              <option value="other">Other shared costs</option>
            </select>
          </label>
        )}
      </div>
      {refunding && (
        <p className="fine-print">
          For{" "}
          {original?.title ||
            month.entries.find((x) => x.id === e?.originalId)?.title}
          . Up to{" "}
          {money(
            refundable(
              month.entries.filter((x) => x.id !== e?.id),
              editor.originalId || e?.originalId || "",
            ),
          )}{" "}
          can be refunded.
        </p>
      )}
      {!refunding &&
        !transferring &&
        category &&
        category.amount > 0 &&
        !draft.value.amount && (
          <button
            type="button"
            className="text-button planned-amount"
            onClick={() =>
              draft.change({ amount: String(category.amount / 100) })
            }
          >
            Use planned amount: {money(category.amount)}
          </button>
        )}
      {!transferring && (
        <fieldset className="entry-payer">
          <legend>
            {refunding ? "Who received the refund?" : "Who covered it?"}
          </legend>
          <div>
            {[
              ...pair.map((n, i) => ({ value: i === 0 ? "A" : "B", label: n })),
              { value: "both", label: "Both of us" },
            ].map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={draft.value.payer === p.value}
                onClick={() => draft.change({ payer: p.value })}
              >
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {!transferring && draft.value.payer === "both" && (
        <MoneyInput
          label={
            (refunding ? "Refund received by " : "Amount covered by ") + pair[0]
          }
          value={draft.value.paidA}
          onChange={(paidA) => draft.change({ paidA })}
          hint={
            "The rest is assigned to " +
            pair[1] +
            ". Enter what each person actually covered."
          }
        />
      )}
      <details className="entry-extra" open={!!e}>
        <summary>
          Date & description
          <ChevronDown size={14} />
        </summary>
        <div className="form-grid">
          <label>
            Date
            <input
              type="date"
              aria-label="Entry date"
              required
              min={month.period + "-01"}
              max={today < end ? today : end}
              value={draft.value.date}
              onChange={(ev) => draft.change({ date: ev.target.value })}
            />
          </label>
          <label>
            Description <span className="optional">Optional</span>
            <input
              aria-label="Description"
              maxLength={100}
              value={draft.value.title}
              onChange={(ev) => draft.change({ title: ev.target.value })}
              placeholder={
                transferring
                  ? "A reimbursement, not another expense"
                  : category?.label || "What was it for?"
              }
            />
          </label>
        </div>
      </details>
      <p className="fine-print">
        {transferring
          ? `${pair[role === "A" ? 1 : 0]} must confirm receiving this before it changes the balance. No money is sent by First Month.`
          : "This entry is shared with your partner. Add only costs paid from personal funds, not an already shared savings pot."}
      </p>
      <div className="form-actions">
        <button className="button primary" disabled={busy || draft.conflict}>
          {e
            ? "Save changes"
            : refunding
              ? "Save refund"
              : transferring
                ? "Report this transfer"
                : "Save expense"}
          <Check size={17} />
        </button>
        <button type="button" className="text-button" onClick={onClose}>
          Cancel
        </button>
      </div>
      <DraftStatus {...draft} onReset={() => draft.reset()} />
    </form>
  );
}
