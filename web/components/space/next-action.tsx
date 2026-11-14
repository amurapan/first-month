"use client";
import { ArrowRight, Check, Clock, LockKeyhole } from "lucide-react";
import type { SpaceState } from "@/lib/life-types";
import { nextStep } from "@/lib/domain/next-step.js";
type Tab = "home" | "budget" | "months" | "decisions" | "reviews" | "settings";
export default function NextAction({
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
    tab: Tab,
    id?: string | null,
    period?: string,
    entry?: "expense",
  ) => void;
  planLink: (step?: number) => string;
  onInvite: () => Promise<void>;
  onShare: () => Promise<unknown>;
}) {
  const step = nextStep(state),
    partner = state.partner.name;
  const copy: Record<string, [string, string, string]> = {
    invite: [
      "Your starting point is saved.",
      `Invite ${partner} to add their own side. Your estimate stays private, and nothing is agreed until you both confirm.`,
      "Invite my partner",
    ],
    share: [
      "Two people. Two perspectives.",
      "Your income is still private. Sharing reveals your saved profile only after your partner also shares; it does not approve a plan.",
      "Share my saved details",
    ],
    waiting: [
      "Your side is ready.",
      `${partner} hasn’t shared their profile yet. There’s nothing else you need to submit. You can refine your own bills and preferences while you wait.`,
      "Review my details",
    ],
    receipt: [
      "Did the transfer arrive?",
      "Your partner reported sending money. Check your own account before confirming receipt; reporting a transfer does not move money.",
      "Review the transfer",
    ],
    reopen: [
      "A month needs another look.",
      "Your partner asked to correct a confirmed month. Review the request together; the earlier agreement stays in your history.",
      "Review the request",
    ],
    "month-review": [
      "Your partner checked the month.",
      "Review the recorded costs and balance. Your confirmation is separate from theirs.",
      "Review the month",
    ],
    plan: [
      "Make the starting point yours.",
      "Compare both incomes, check the shared costs and review the split. Each of you confirms the same version separately.",
      "Review our monthly plan",
    ],
    "plan-waiting": [
      "You’ve confirmed your side.",
      `${partner} still needs to review this plan. You can record shared costs while you wait; the month will show that its starting plan is not yet confirmed together.`,
      "Open this month",
    ],
    decision: [
      "A decision is ready for you.",
      "Add your perspective or review the latest proposal. Each person gets a separate say.",
      "Open the decision",
    ],
    "month-start": [
      "Try the plan with a real expense.",
      "Add a shared bill and who covered it. You’ll see what you each contributed and what still needs balancing.",
      "Record our first expense",
    ],
    "check-in": [
      "How is the plan feeling?",
      "A short weekly check-in makes space for what worked and what you’d like to change.",
      "Start my check-in",
    ],
    "follow-through": [
      "One small thing to follow through.",
      "Return to the action from your weekly check-in and review what happened together.",
      "Open our next step",
    ],
    current: [
      "Your next step is everyday life.",
      "Keep adding shared costs as they happen. Your month stays open until you both review it.",
      "Open this month",
    ],
  };
  const [title, detail, defaultLabel] = copy[step.kind];
  const monthExists = state.months.some((x) => x.period === step.period);
  const label =
    step.kind === "month-start" && !monthExists
      ? "Start this month"
      : defaultLabel;
  const href =
    step.kind === "plan"
      ? planLink(2)
      : step.kind === "waiting"
        ? planLink(0)
        : undefined;
  const progress = [
    ["Starting point saved", true],
    ["Partner joined", state.joined],
    [
      "Plan confirmed together",
      state.decisions.A === "accepted" && state.decisions.B === "accepted",
    ],
  ] as const;
  function act() {
    if (step.kind === "invite") return onInvite();
    if (step.kind === "share") return onShare();
    if (step.kind === "decision") return onNavigate("decisions", step.id);
    if (["check-in", "follow-through"].includes(step.kind))
      return onNavigate("reviews");
    onNavigate(
      "months",
      null,
      step.period || undefined,
      step.kind === "month-start" && monthExists ? "expense" : undefined,
    );
  }
  return (
    <section className="next-action" aria-label="Your next step">
      <div className="next-action-main">
        <div className="next-action-copy">
          <p className="eyebrow">
            ONE NEXT STEP
            {step.period && (
              <span>
                {" "}
                ·{" "}
                {new Date(step.period + "-01T12:00:00Z").toLocaleDateString(
                  "en-US",
                  { month: "long", year: "numeric", timeZone: "UTC" },
                )}
              </span>
            )}
          </p>
          <h2>{title}</h2>
          <p>{detail}</p>
          {step.kind === "waiting" ? (
            <div className="next-waiting">
              <span>
                <Clock size={17} />
                No action needed from you
              </span>
              <a className="text-button" href={planLink(0)}>
                View my saved details <ArrowRight size={15} />
              </a>
            </div>
          ) : href ? (
            <a href={href} className="button primary">
              {label}
              <ArrowRight size={17} />
            </a>
          ) : (
            <button className="button primary" disabled={busy} onClick={act}>
              {label}
              <ArrowRight size={17} />
            </button>
          )}
          {step.kind === "share" && (
            <a className="text-button next-secondary" href={planLink(0)}>
              Review what I’m sharing
            </a>
          )}
        </div>
        <ol className="next-progress">
          {progress.map(([label, complete], i) => (
            <li key={label} className={complete ? "done" : ""}>
              <span aria-hidden="true">
                {complete ? <Check size={16} /> : `0${i + 1}`}
              </span>
              <div>
                <small>{complete ? "DONE" : "STILL TO COME"}</small>
                <strong>{label}</strong>
              </div>
            </li>
          ))}
        </ol>
      </div>
      {step.kind === "invite" && !state.self.shared && (
        <details className="next-privacy">
          <summary>
            <LockKeyhole size={14} />
            Your income is private · Sharing options
          </summary>
          <p>
            Your saved income and optional profile details appear only after
            both of you share. You can choose now or come back later. Sharing
            never accepts a plan.
          </p>
          <button className="text-button" disabled={busy} onClick={onShare}>
            Share my saved details <ArrowRight size={15} />
          </button>
          <a href={planLink(0)}>Review my details</a>
        </details>
      )}
    </section>
  );
}
