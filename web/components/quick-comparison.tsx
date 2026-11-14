"use client";
import { Check, CircleHelp, ArrowRight } from "lucide-react";
import { previewBudget } from "@/lib/domain/preview.js";

export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
export type QuickMethod = "equal" | "proportional";
type Props = {
  income: number;
  partnerIncome: number | null;
  total: number;
  method: QuickMethod;
  onMethod: (method: QuickMethod) => void;
  names?: [string, string];
  busy?: boolean;
};

export default function QuickComparison({
  income,
  partnerIncome,
  total,
  method,
  onMethod,
  names = ["You", "Your partner"],
  busy = false,
}: Props) {
  const proportionalAvailable =
    partnerIncome !== null && income + partnerIncome > 0;
  const active =
    method === "proportional" && !proportionalAvailable ? "equal" : method;
  const result = previewBudget({
    incomeCents: income,
    partnerIncomeCents: partnerIncome,
    sharedCents: total,
    method: active,
  });
  const equal = previewBudget({
    incomeCents: income,
    partnerIncomeCents: partnerIncome,
    sharedCents: total,
  });
  return (
    <div className="quick-comparison">
      <div
        className="quick-methods"
        role="group"
        aria-label="Compare ways to split"
      >
        <button
          type="button"
          disabled={busy}
          aria-pressed={active === "equal"}
          onClick={() => onMethod("equal")}
        >
          <span>50 / 50</span>
          <small>The same amount each</small>
          {active === "equal" && <Check size={17} />}
        </button>
        <button
          type="button"
          disabled={busy || !proportionalAvailable}
          aria-pressed={active === "proportional"}
          onClick={() => onMethod("proportional")}
        >
          <span>By income</span>
          <small>In proportion to take-home pay</small>
          {active === "proportional" && <Check size={17} />}
        </button>
      </div>
      {!proportionalAvailable && (
        <p className="quick-hint">
          <CircleHelp size={16} />
          {partnerIncome === null
            ? "Add your partner’s income estimate to unlock this comparison."
            : "Income-based splitting needs a positive combined income."}
        </p>
      )}
      <div className="quick-results" aria-live="polite">
        {names.map((name, index) => {
          const remaining = result.remainingAfterSharedCents[index],
            change =
              equal.contributionsCents[index] -
              result.contributionsCents[index];
          return (
            <article
              key={index}
              className={index ? "quick-person peach-person" : "quick-person"}
            >
              <div className="quick-person-name">
                <span className={"avatar " + (index ? "peach" : "")}>
                  {index ? "2" : "1"}
                </span>
                <strong>{name}</strong>
                {index === 1 && <small>ESTIMATE</small>}
              </div>
              <span className="contribution-label">
                Monthly shared contribution
              </span>
              <strong className="quick-contribution">
                {money(result.contributionsCents[index])}
              </strong>
              <p className="quick-delta">
                {change === 0
                  ? "The same as a 50 / 50 split"
                  : money(Math.abs(change)) +
                    (change > 0
                      ? " less to contribute"
                      : " more to contribute") +
                    " than 50 / 50"}
              </p>
              <div className="quick-left">
                <span>After this contribution</span>
                <strong>
                  {remaining === null ? "Income not added" : money(remaining)}
                </strong>
              </div>
              {remaining !== null && remaining < 0 && (
                <p className="attention">
                  This contribution is more than the income entered.
                </p>
              )}
            </article>
          );
        })}
      </div>
      <p className="quick-footnote">
        <ArrowRight size={15} /> Personal bills and savings haven’t been
        deducted. This is a starting estimate, ready to refine together.
      </p>
    </div>
  );
}
