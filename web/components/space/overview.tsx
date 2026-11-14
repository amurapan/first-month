"use client";
import { AnimatedMoney } from "@/components/motion";
import {
  currentMonth,
  currentSettlement,
  monthTotals,
  monthOutstanding,
} from "@/lib/domain/month.js";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  Clock,
  LockKeyhole,
  Plus,
  ReceiptText,
} from "lucide-react";
import type { SpaceState } from "@/lib/life-types";
import { ledgerFor, optionsFor } from "@/lib/planning";
import { HomeScene } from "@/components/home-scene";
import QuickComparison from "@/components/quick-comparison";
import { fullDate, money, names } from "./shared";
export default function Overview({
  state,
  busy,
  onNavigate,
  planLink,
  onInvite,
  onShare,
}: {
  state: SpaceState;
  busy: boolean;
  onNavigate: (
    tab: "home" | "months" | "decisions" | "reviews" | "settings",
    id?: string | null,
  ) => void;
  planLink: (step?: number) => string;
  onInvite: () => Promise<void>;
  onShare: () => Promise<unknown>;
}) {
  const pair = names(state),
    [method, setMethod] = useState(state.estimate?.method || "equal");
  const ledger = useMemo(() => ledgerFor(state), [state]);
  const active = state.householdDecisions.filter(
    (x) => !["completed", "archived"].includes(x.status),
  );
  const focus =
    active.find(
      (x) =>
        x.stale ||
        !x.answers[state.role]?.shared ||
        (!x.proposal && x.bothAnswered) ||
        x.proposal?.approvals[state.role] === "pending",
    ) || active[0];
  const thisMonth = state.months.find((x) => x.period === currentMonth()),
    actual = thisMonth ? monthTotals(thisMonth) : null;
  const pendingReceipts =
      thisMonth?.entries.filter(
        (e) => e.kind === "transfer" && !e.confirmed && e.author !== state.role,
      ).length || 0,
    receipt = thisMonth ? currentSettlement(thisMonth) : null,
    needsReceipt =
      receipt && !receipt.receivedAt && receipt.from !== state.role;
  const review = state.householdReviews.find(
    (x) => x.week === state.currentWeek,
  );
  const agreed =
    state.decisions.A === "accepted" && state.decisions.B === "accepted";
  const total = state.expenses.reduce((sum, x) => sum + x.amount, 0);
  let suggestion = "";
  if (focus?.bothAnswered && state.calculation) {
    try {
      const result = optionsFor(state, focus);
      suggestion =
        result.options.find((x) => x.id === result.suggestedId)?.title ||
        "Compare your options";
    } catch {}
  }
  const monthlyPeople =
    state.role === "A"
      ? [state.self, state.partner]
      : [state.partner, state.self];
  return (
    <>
      <div className="home-greeting">
        <div>
          <p className="eyebrow">
            {state.demo ? "YOUR SAMPLE HOUSEHOLD" : "YOUR SHARED HOME"}
            <span>{pair.join(" + ")}</span>
          </p>
          <h1>
            A little more
            <br />
            <span>on the same page.</span>
          </h1>
        </div>
        <button
          className="button secondary"
          onClick={() => onNavigate("decisions", "new")}
        >
          <Plus size={17} />
          New decision
        </button>
      </div>
      {!state.joined && (
        <section className="new-invite-strip">
          <div className="invite-duo">
            <span>{state.self.name[0]}</span>
            <span>+</span>
          </div>
          <div>
            <h2>Your side is a start.</h2>
            <p>
              Invite {state.partner.name} to add theirs. You can start a
              decision now.
            </p>
          </div>
          <button className="button primary" disabled={busy} onClick={onInvite}>
            Invite my partner
            <ArrowRight size={17} />
          </button>
        </section>
      )}
      {!state.self.shared && (
        <div className="notice">
          <LockKeyhole size={18} />
          <div>
            <strong>Your income is still private.</strong>
            <p>
              Sharing shows your saved income and optional details after your
              partner also shares. It does not approve a plan.
            </p>
          </div>
          <button
            className="button secondary"
            disabled={busy}
            onClick={onShare}
          >
            Share my side
          </button>
        </div>
      )}
      {state.joined && state.self.shared && !state.bothShared && (
        <div className="notice">
          <Clock size={18} />
          <p>
            Your side is ready. {state.partner.name} can share their own numbers
            when they’re comfortable.
          </p>
        </div>
      )}
      <div className="home-focus">
        <div className="home-focus-copy">
          <p className="eyebrow">
            {focus ? "YOUR NEXT CONVERSATION" : "ROOM FOR YOUR NEXT CHAPTER"}
          </p>
          <h2>{focus ? focus.title : "What’s next\nfor your home?"}</h2>
          <p>
            {focus
              ? focus.status === "agreed"
                ? "You both chose a plan. Keep an eye on the next step."
                : focus.bothAnswered
                  ? "Both perspectives are in. See where they meet, and compare the ways forward."
                  : "A little space for each of you to say what feels comfortable."
              : "A purchase, a shared subscription, or a goal you want to make room for. Start with what’s actually on your minds."}
          </p>
          {focus && (
            <div className="focus-facts">
              <strong>
                <AnimatedMoney
                  value={focus.proposal?.amount ?? focus.amount}
                  enter
                />
              </strong>
              <span>
                {focus.status === "agreed" ? (
                  <>
                    <CheckCheck size={16} />
                    Agreed together
                  </>
                ) : (
                  suggestion || "Add both perspectives"
                )}
              </span>
            </div>
          )}
          <button
            className="button primary"
            onClick={() => onNavigate("decisions", focus?.id || "new")}
          >
            {focus
              ? focus.status === "agreed"
                ? "Open our plan"
                : focus.bothAnswered
                  ? "See our options"
                  : "Add my perspective"
              : "Start a decision"}
            <ArrowUpRight size={18} />
          </button>
        </div>
        <div className="home-focus-scene">
          <HomeScene compact phase={focus?.status === "agreed" ? 2 : 1} />
          <span className="scene-caption">
            Make room for the life you’re building.
          </span>
        </div>
      </div>
      {state.bothShared && (
        <section className="home-month-strip">
          <ReceiptText size={30} />
          <div>
            <h3>
              {needsReceipt
                ? "Your partner reported a reimbursement."
                : pendingReceipts
                  ? "Your partner reported a transfer."
                  : thisMonth?.reopen[state.role === "A" ? "B" : "A"]
                    ? "Your partner asked to correct the month."
                    : thisMonth?.approvals[state.role === "A" ? "B" : "A"] &&
                        !thisMonth.approvals[state.role]
                      ? "Your partner has reviewed the month."
                      : thisMonth
                        ? thisMonth.status === "agreed"
                          ? "Your month, checked together."
                          : "How is the plan working in real life?"
                        : "Give your plan a little follow-through."}
            </h3>
            <p>
              {needsReceipt
                ? "Confirm whether you received " + money(receipt!.amount) + "."
                : pendingReceipts
                  ? "Confirm receipt to include it in the shared balance."
                  : actual
                    ? money(actual.total) +
                      " recorded in shared costs" +
                      (thisMonth!.status === "agreed" &&
                      monthOutstanding(thisMonth!) !== 0
                        ? " · A reimbursement is still outstanding."
                        : " · Compare your plan and what you actually covered.")
                    : "Record shared costs, see who covered what, and settle up together."}
            </p>
          </div>
          <button
            className="button secondary"
            onClick={() => onNavigate("months")}
          >
            {needsReceipt || pendingReceipts
              ? "Review the transfer"
              : thisMonth
                ? "Open this month"
                : "Start this month"}
            <ArrowRight size={16} />
          </button>
        </section>
      )}
      <div className="home-below-grid">
        <section className="home-money-panel">
          <div className="home-section-top">
            <div>
              <p className="eyebrow">YOUR MONTHLY PICTURE</p>
              <h2>Every plan counts.</h2>
            </div>
            <a
              className="round-link"
              href={planLink(2)}
              aria-label="Open monthly plan"
            >
              <ArrowUpRight size={21} />
            </a>
          </div>
          <div className="money-panel-totals">
            <div>
              <span>Monthly shared costs</span>
              <strong>
                <AnimatedMoney value={total} enter />
              </strong>
            </div>
            <span className={"status-tag " + (agreed ? "green" : "")}>
              {agreed ? "Confirmed together" : "Ready to review"}
            </span>
          </div>
          {state.bothShared && state.calculation ? (
            <>
              <div className="home-budget-people">
                {pair.map((name, i) => {
                  const person = monthlyPeople[i],
                    income = person.income || 0,
                    planned = state.calculation!.remainingCents[i],
                    other = ledger.totals[0][i],
                    remaining = planned - other,
                    included = income - planned;
                  return (
                    <article key={i}>
                      <div>
                        <span className={"person-orb person-" + i}>
                          {name[0]}
                        </span>
                        <strong>{name}</strong>
                        <span>
                          <AnimatedMoney value={remaining} enter />
                          <small>projected after plans</small>
                        </span>
                      </div>
                      <div
                        className="budget-track"
                        aria-label={name + " projected monthly allocation"}
                      >
                        <span
                          className="budget-costs"
                          style={{
                            width:
                              Math.max(
                                0,
                                Math.min(
                                  100,
                                  (included / Math.max(1, income)) * 100,
                                ),
                              ) + "%",
                          }}
                        />
                        <span
                          className={"person-" + i}
                          style={{
                            width:
                              Math.max(
                                0,
                                Math.min(
                                  100,
                                  (other / Math.max(1, income)) * 100,
                                ),
                              ) + "%",
                          }}
                        />
                      </div>
                      <p>
                        {money(other)} in other agreed plans
                        {person.refined === false
                          ? " · Personal costs not added"
                          : ""}
                        {remaining < 0 ? " · Plans exceed entered income" : ""}
                      </p>
                    </article>
                  );
                })}
              </div>
              <div className="budget-legend">
                <span>
                  <i />
                  Included monthly costs
                </span>
                <span>
                  <i />
                  Agreed plans
                </span>
                <span>
                  <i />
                  Projected remainder
                </span>
              </div>
              <p className="fine-print">
                A projection from the numbers you entered, not your bank
                balance.
              </p>
            </>
          ) : (
            <p className="budget-waiting">
              Both incomes appear here once you each choose to share. Until
              then, your own starting comparison stays private.
            </p>
          )}
          {ledger.rows.length > 0 && (
            <div className="home-commitments">
              <h3>Already in the picture</h3>
              {ledger.rows.slice(0, 4).map((row) => (
                <button
                  key={row.id}
                  onClick={() => onNavigate("decisions", row.id)}
                >
                  <span>
                    <i />
                    {row.title}
                    {row.overdue && <small>Overdue funding to resolve</small>}
                    {row.retained && (
                      <small>Earlier agreement still included</small>
                    )}
                  </span>
                  <strong>
                    <AnimatedMoney
                      value={row.allocations[0][0] + row.allocations[0][1]}
                      enter
                    />
                    <small>this month</small>
                  </strong>
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
          )}
          <a className="text-button" href={planLink(3)}>
            Review our monthly plan
            <ArrowRight size={16} />
          </a>
        </section>
        <section className="home-week-panel">
          <div className="week-circle">
            <CalendarDays size={28} />
          </div>
          <p className="eyebrow">A SMALL WEEKLY RITUAL</p>
          <h2>
            {review?.action?.completed
              ? "One small thing,\nfollowed through."
              : review?.action
                ? "A next step\nyou can come back to."
                : "How did\nthis week feel?"}
          </h2>
          <p>
            {review?.action?.text ||
              "What worked? What changed? A short check-in makes room for both answers."}
          </p>
          {review?.action && (
            <span className="week-action-date">
              {review.action.completed ? (
                <>
                  <CheckCheck size={16} />
                  Completed together
                </>
              ) : (
                <>Revisit {fullDate(review.action.due)}</>
              )}
            </span>
          )}
          <div className="week-person-status">
            {(["A", "B"] as const).map((side, i) => (
              <div key={side}>
                <span className={"person-orb person-" + i}>{pair[i][0]}</span>
                <span>{pair[i]}</span>
                {review?.answers[side]?.shared ? (
                  <span>
                    <Check size={14} />
                    Shared
                  </span>
                ) : (
                  <span>Still to come</span>
                )}
              </div>
            ))}
          </div>
          <button
            className="button secondary"
            onClick={() => onNavigate("reviews")}
          >
            {review?.bothAnswered ? "Open our check-in" : "Take a moment"}
            <ArrowRight size={17} />
          </button>
        </section>
      </div>
      {state.estimate && !state.bothShared && (
        <details className="home-starting-comparison">
          <summary>
            Your private starting comparison<span>Based on your estimate</span>
          </summary>
          <QuickComparison
            income={state.self.income}
            partnerIncome={state.estimate.partnerIncome}
            total={total}
            method={method}
            onMethod={setMethod}
          />
          <a href={planLink(2)} className="text-button">
            Edit this comparison
            <ArrowRight size={15} />
          </a>
        </details>
      )}
      <div className="home-history-link">
        <div>
          <CheckCheck size={25} />
          <h3>The things you’ve decided together.</h3>
        </div>
        <p>
          {state.planHistory.length
            ? state.planHistory.length +
              " accepted monthly " +
              (state.planHistory.length === 1 ? "plan" : "plans") +
              " in your history."
            : "Your accepted plans and completed decisions stay here as life changes."}
        </p>
        <button className="text-button" onClick={() => onNavigate("decisions")}>
          Open our decisions
          <ArrowRight size={17} />
        </button>
      </div>
    </>
  );
}
