"use client";
import { ArrowRight, MessageCircle } from "lucide-react";
import { splitInsight } from "@/lib/domain/insight.js";
import { money } from "@/lib/money";
type Props = {
  names: string[];
  incomes: (number | null)[];
  total: number;
  method: string;
  contributions: number[];
  remaining: (number | null)[];
  personal?: number[];
  reserves?: number[];
  refined?: boolean[];
  estimate?: boolean;
  onCompareIncome?: () => void;
};
export default function SplitInsight(props: Props) {
  const insight = splitInsight(props),
    { names, incomes, method, estimate = false } = props;
  const affected = insight.deficits
    .map((n: number | null, i: number) =>
      n
        ? `${names[i]} ${names[i] === "You" ? "are" : "is"} ${money(n)} short`
        : null,
    )
    .filter(Boolean)
    .join("; ");
  const below = insight.gaps
    .map((n: number | null, i: number) =>
      n
        ? `${names[i]} ${names[i] === "You" ? "have" : "has"} ${money(n)} less than the amount ${names[i] === "You" ? "you" : "they"} want to keep`
        : null,
    )
    .filter(Boolean)
    .join("; ");
  const title =
    insight.status === "shortfall"
      ? "There’s a gap to work through."
      : insight.status === "preference"
        ? "The bills fit. A preference doesn’t yet."
        : insight.status === "unknown"
          ? "There’s one side still to add."
          : insight.status === "zero"
            ? "No shared costs are included yet."
            : insight.status === "different"
              ? "The same dollars can feel different."
              : method === "proportional"
                ? "The contributions follow your incomes."
                : "Here’s what this choice leaves open.";
  const detail =
    insight.status === "shortfall"
      ? `${affected} after the costs included here. ${insight.combinedShortfall ? `Together, the included costs exceed the entered incomes by ${money(insight.combinedShortfall)}; changing the split alone cannot close that gap.` : "A different contribution or a smaller shared budget is something to compare."}`
      : insight.status === "preference"
        ? `${below}. Compare a different split or shared budget before agreeing.`
        : insight.status === "unknown"
          ? "Your partner’s remaining money cannot be calculated without their income. An estimate can help you explore; they’ll enter their own answer when they join."
          : insight.status === "zero"
            ? "Add rent, groceries or another shared cost to make this comparison useful."
            : insight.status === "different"
              ? "About half each means similar contributions, but a different share of each entered income. Neither method decides what works for your relationship."
              : method === "proportional"
                ? "Each contribution uses roughly the same percentage of the entered income. Personal bills and priorities can still differ."
                : "The amounts left are a starting point for your conversation. Check personal bills, savings and anything missing before choosing together.";
  return (
    <section
      className={
        "split-insight " +
        (insight.status === "shortfall" || insight.status === "preference"
          ? "attention"
          : "")
      }
      aria-label="What this comparison means"
    >
      <p className="eyebrow">WHAT THE NUMBERS SAY</p>
      <h3>{title}</h3>
      <p>{detail}</p>
      {insight.status !== "zero" && (
        <div className="income-portions">
          {names.map((name, i) => (
            <div key={i}>
              <span>
                {name}
                {estimate && i === 1 ? " · estimate" : ""}
              </span>
              <strong>
                {incomes[i] === null
                  ? "Income unknown"
                  : incomes[i] === 0
                    ? "$0 income entered"
                    : `${insight.percentages[i]!.toFixed(1)}% of income`}
              </strong>
              <small>For the shared contribution</small>
            </div>
          ))}
        </div>
      )}
      <div className="insight-question">
        <MessageCircle size={18} />
        <p>
          {insight.status === "shortfall"
            ? "What could we change about the shared costs or contributions?"
            : insight.status === "preference"
              ? "What does each of us need to keep for ourselves?"
              : "What needs to fit into the money we each have left?"}
        </p>
      </div>
      {props.onCompareIncome &&
        insight.alternativeCovers &&
        (insight.status === "shortfall" || insight.status === "different") && (
          <button className="text-button" onClick={props.onCompareIncome}>
            Compare an income-based split <ArrowRight size={16} />
          </button>
        )}
      {estimate && (
        <small className="insight-scope">
          Your partner’s numbers are your estimate, not their answer.
        </small>
      )}
    </section>
  );
}
