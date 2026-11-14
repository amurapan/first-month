"use client";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Clock,
  HeartHandshake,
  House,
  LockKeyhole,
  Plus,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import type { SpaceState } from "@/lib/life-types";
import { fullDate, money, names } from "./shared";
import QuickComparison from "@/components/quick-comparison";
import { useState } from "react";
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
    tab: "home" | "decisions" | "reviews" | "settings",
    id?: string | null,
  ) => void;
  planLink: (step?: number) => string;
  onInvite: () => Promise<void>;
  onShare: () => Promise<unknown>;
}) {
  const pair = names(state),
    total = state.expenses.reduce((n, x) => n + x.amount, 0),
    agreed =
      state.decisions.A === "accepted" && state.decisions.B === "accepted";
  const active = state.householdDecisions.filter(
      (x) => !["completed", "archived"].includes(x.status),
    ),
    review = state.householdReviews.find((x) => x.week === state.currentWeek),
    yourReview = review?.answers[state.role];
  const [method, setMethod] = useState(state.estimate?.method || "equal");
  const due = active.filter(
    (x) =>
      x.stale ||
      !x.answers[state.role]?.shared ||
      (x.bothAnswered &&
        (!x.proposal || x.proposal.approvals[state.role] !== "accepted")),
  );
  const completed = state.householdDecisions.filter(
    (x) => x.status === "completed",
  ).length;
  return (
    <>
      <div className="life-heading">
        <p className="eyebrow">YOUR EVERYDAY, TOGETHER</p>
        <h1>A home for the money conversations.</h1>
        <p>
          Your plan is a starting point. Make the next decision together, then
          come back to what you agreed.
        </p>
      </div>
      {!state.joined && (
        <section className="welcome-invite">
          <div className="section-icon">
            <HeartHandshake size={27} />
          </div>
          <div>
            <h2>Make room for {state.partner.name}.</h2>
            <p>
              Invite them to add their own numbers and perspective. You can
              start a decision while they get settled.
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
              Sharing makes your saved income and optional details visible once
              your partner also shares. It does not approve any plan.
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
            Your side is ready. {state.partner.name} can share theirs when
            they’re comfortable. Your estimates stay separate from their
            answers.
          </p>
        </div>
      )}
      <div className="home-metrics">
        <div>
          <span>Shared monthly plan</span>
          <strong>{money(total)}</strong>
          <small>
            {agreed ? "Confirmed by both of you" : "Ready to review together"}
          </small>
        </div>
        <button onClick={() => onNavigate("decisions")}>
          <span>Open conversations</span>
          <strong>{active.length.toString().padStart(2, "0")}</strong>
          <small>
            {due.length
              ? due.length + " waiting for your next step"
              : "Space for your next decision"}
            <ArrowRight size={14} />
          </small>
        </button>
        <button onClick={() => onNavigate("reviews")}>
          <span>This week’s check-in</span>
          <strong>
            {review?.bothAnswered
              ? "Together"
              : yourReview?.shared
                ? "Your side is in"
                : "A little time"}
          </strong>
          <small>
            {review?.action?.completed
              ? "Your action is complete"
              : review?.bothAnswered
                ? "Choose one thing to carry forward"
                : "Two short answers each"}
            <ArrowRight size={14} />
          </small>
        </button>
      </div>
      <div className="home-main-grid">
        <section className="surface next-step-card">
          <div className="section-label">
            <span className="overline">A GOOD NEXT STEP</span>
            <span className="small-flower">✳</span>
          </div>
          <h2>
            {due.length
              ? "A conversation needs your side."
              : active.length
                ? "Keep the conversation moving."
                : "What’s on your minds?"}
          </h2>
          <p>
            {due.length
              ? "Take a moment to read, add your perspective, or review what changed."
              : "A new sofa. A shared subscription. A change in what feels comfortable. Start with the decision you actually need to make."}
          </p>
          {due.slice(0, 3).map((item) => (
            <button
              className="next-step-row"
              key={item.id}
              onClick={() => onNavigate("decisions", item.id)}
            >
              <span className="section-icon small">
                <ShoppingBag size={18} />
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>
                  {item.stale
                    ? "Your monthly plan changed — revisit the numbers"
                    : !item.answers[state.role]?.shared
                      ? "Add your perspective"
                      : !item.proposal
                        ? "Compare your options"
                        : "Review the proposal"}
                </small>
              </span>
              <ChevronRight size={18} />
            </button>
          ))}
          <button
            className="button primary"
            onClick={() => onNavigate("decisions", "new")}
          >
            <Plus size={17} />
            Start a decision
          </button>
          <span className="fine-print">
            One purchase or recurring cost. Both perspectives. A clear next
            step.
          </span>
        </section>
        <section className="weekly-card">
          <CalendarDays size={28} />
          <p className="overline">SMALL CHECK-INS. FEWER SURPRISES.</p>
          <h2>How is this week feeling?</h2>
          <p>
            What worked? What would you change? Answer separately, then choose
            one action together.
          </p>
          <div className="weekly-partners">
            {(["A", "B"] as const).map((side, i) => (
              <span key={side}>
                <span className={"avatar " + (i ? "peach" : "")}>
                  {pair[i][0]}
                </span>
                <span>
                  {pair[i]}
                  <small>
                    {review?.answers[side]?.shared
                      ? "Ready to share"
                      : "A moment to reflect"}
                  </small>
                </span>
                {review?.answers[side]?.shared && <Check size={16} />}
              </span>
            ))}
          </div>
          <button
            className="button secondary"
            onClick={() => onNavigate("reviews")}
          >
            {yourReview?.shared ? "Open our check-in" : "Add my check-in"}
            <ArrowRight size={17} />
          </button>
        </section>
      </div>
      {state.estimate && !state.bothShared && (
        <section className="home-estimate">
          <div className="section-heading">
            <div>
              <p className="overline">YOUR STARTING NUMBERS</p>
              <h2>A first look, before you agree.</h2>
            </div>
            <a className="text-button" href={planLink(2)}>
              Edit assumptions
              <ArrowRight size={15} />
            </a>
          </div>
          <QuickComparison
            income={state.self.income}
            partnerIncome={state.estimate.partnerIncome}
            total={total}
            method={method}
            onMethod={setMethod}
            names={pair}
          />
        </section>
      )}
      {state.bothShared && state.calculation && (
        <section className="home-plan surface">
          <div className="section-heading">
            <div>
              <p className="overline">YOUR MONTHLY FOUNDATION</p>
              <h2>
                {agreed
                  ? "The plan you both said yes to."
                  : "Your current proposal."}
              </h2>
            </div>
            <span className={"status-tag " + (agreed ? "green" : "")}>
              {agreed ? "Agreed together" : "Awaiting both confirmations"}
            </span>
          </div>
          <div className="home-plan-people">
            {pair.map((name, i) => (
              <div key={i}>
                <span className={"avatar " + (i ? "peach" : "")}>
                  {name[0]}
                </span>
                <span>
                  {name}
                  <strong>
                    {money(state.calculation!.contributionsCents[i])}
                    <small>/ month</small>
                  </strong>
                </span>
              </div>
            ))}
          </div>
          <div className="home-plan-footer">
            <span>
              <CalendarDays size={16} />
              Next review {fullDate(state.plan.reviewDate)}
            </span>
            <a className="button secondary" href={planLink(agreed ? 3 : 2)}>
              {agreed ? "Open our agreement" : "Review our monthly plan"}
              <ArrowRight size={17} />
            </a>
          </div>
        </section>
      )}
      <section className="home-memory">
        <div>
          <CheckCheck size={22} />
          <h3>Decisions you can come back to.</h3>
          <p>
            {completed
              ? `${completed} completed ${completed === 1 ? "decision" : "decisions"} in your shared history. Keep the reason behind the choice, not just the amount.`
              : "Your confirmed choices will live here — including who contributes, when, and what you both wanted to protect."}
          </p>
        </div>
        <button className="text-button" onClick={() => onNavigate("decisions")}>
          See our decisions
          <ArrowRight size={16} />
        </button>
      </section>
    </>
  );
}
