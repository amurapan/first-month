"use client";
import { AnimatedMoney } from "@/components/motion";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Info,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import type {
  DecisionAnswer,
  DecisionView,
  SpaceAction,
  SpaceState,
} from "@/lib/life-types";
import { optionsFor, impactForOption } from "@/lib/planning";
import { money, names, afterDays } from "./shared";
export type Projection = ReturnType<typeof impactForOption>;
export function OptionImpact({
  projection,
  pair,
}: {
  projection: Projection;
  pair: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const count = expanded
    ? Math.max(
        projection.schedule[0].length,
        Math.min(
          6,
          projection.ledger.rows.reduce(
            (n, r) =>
              Math.max(
                n,
                r.allocations.findLastIndex((x) => x.some((v) => v > 0)) + 1,
              ),
            0,
          ),
        ),
      )
    : Math.min(3, Math.max(1, projection.schedule[0].length));
  return (
    <div className="option-impact">
      <div className="impact-heading">
        <span className="overline">WHAT IT MEANS FOR EACH OF YOU</span>
        <span>Projected monthly allocation</span>
      </div>
      <div className="impact-people">
        {pair.map((name, i) => (
          <article key={i} className={"impact-person person-" + i}>
            <div className="impact-person-top">
              <span className="person-orb">{name[0]}</span>
              <span>{name}</span>
              <strong>
                <AnimatedMoney value={projection.firstMonth[i]} />
                <small>
                  {projection.months > 1
                    ? "to set aside this month"
                    : projection.months === 1
                      ? "this month"
                      : ""}
                </small>
              </strong>
            </div>
            <dl>
              <div>
                <dt>Other agreed commitments</dt>
                <dd>{money(projection.ledger.totals[0][i])}</dd>
              </div>
              <div>
                <dt>After bills & these plans</dt>
                <dd className={projection.remaining[i] < 0 ? "attention" : ""}>
                  <AnimatedMoney value={projection.remaining[i]} />
                </dd>
              </div>
            </dl>
            <div className="impact-verdict">
              {projection.withinLimit[i] === false ? (
                <span className="attention">
                  Above the comfort amount shared
                </span>
              ) : projection.withinLimit[i] === null ? (
                <span>Comfort amount not set</span>
              ) : (
                <span>
                  <Check size={13} />
                  Within their comfort amount
                </span>
              )}
              {projection.preferenceMet[i] === false ? (
                <span className="attention">
                  Below the amount they want to keep
                </span>
              ) : projection.preferenceMet[i] === null ? (
                <span>Personal bills & saving preferences not included</span>
              ) : (
                <span>
                  <Check size={13} />
                  Keeps their stated buffer across the projection
                </span>
              )}
            </div>
            {projection.excess[i] > 0 && (
              <p className="fine-print">
                {money(projection.excess[i])} already set aside above this
                proposal. It stays with {name}.
              </p>
            )}
          </article>
        ))}
      </div>
      {projection.overdue && (
        <p className="notice warning">
          The original savings deadline has passed. Remaining funding is shown
          this month. Agree on a new timeline together if you need more time.
        </p>
      )}
      {(projection.months > 1 || projection.ledger.rows.length > 0) && (
        <details className="impact-schedule">
          <summary>See the monthly timeline</summary>
          <div className="projection-timeline">
            <div>
              <h4>The months ahead</h4>
              <span>For this option · {pair.join(" + ")}</span>
            </div>
            <div className="timeline-months">
              {projection.timeline.slice(0, count).map((row, i) => {
                const total =
                    row.option[0] + row.option[1] + row.other[0] + row.other[1],
                  max = Math.max(
                    1,
                    ...projection.timeline
                      .slice(0, count)
                      .map((x) =>
                        [...x.option, ...x.other].reduce((a, b) => a + b, 0),
                      ),
                  );
                return (
                  <div key={i}>
                    <span>{row.label}</span>
                    <div
                      className="timeline-stack"
                      aria-label={
                        row.label + " planned allocation " + money(total)
                      }
                    >
                      {row.option.map((v, side) => (
                        <i
                          key={side}
                          className={"person-" + side}
                          style={{ height: (v / max) * 78 + "px" }}
                        />
                      ))}
                      <i
                        className="other-commitments"
                        style={{
                          height:
                            ((row.other[0] + row.other[1]) / max) * 78 + "px",
                        }}
                      />
                    </div>
                    <strong>{money(total)}</strong>
                    <small>combined allocation</small>
                  </div>
                );
              })}
            </div>
            <div className="timeline-key">
              <span>
                <i className="person-0" />
                {pair[0]}
              </span>
              <span>
                <i className="person-1" />
                {pair[1]}
              </span>
              <span>
                <i className="other-commitments" />
                Other commitments
              </span>
            </div>
            {!expanded &&
              (projection.months > 3 || projection.ledger.rows.length > 0) && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setExpanded(true)}
                >
                  Show more months
                  <ChevronDown size={14} />
                </button>
              )}
          </div>
        </details>
      )}
      {projection.ledger.rows.length > 0 && (
        <details className="included-commitments">
          <summary>
            {projection.ledger.rows.length} other{" "}
            {projection.ledger.rows.length === 1 ? "commitment" : "commitments"}{" "}
            included
            <ChevronDown size={14} />
          </summary>
          {projection.ledger.rows.map((r) => (
            <div key={r.id}>
              <span>
                {r.title}
                {r.overdue && <small>Overdue funding to resolve</small>}
                {r.retained && (
                  <small>
                    Previous agreement retained while you review changes
                  </small>
                )}
              </span>
              <strong>
                {money(r.allocations[0][0] + r.allocations[0][1])}
                <small>this month</small>
              </strong>
            </div>
          ))}
        </details>
      )}
      <p className="projection-assumption">
        <Info size={14} />
        Based on your monthly plan and reported savings, not your bank balance.
        Income and bills are held constant. Unapproved ideas aren’t reserved.
        Expenses in Spending do not update this projection.
      </p>
    </div>
  );
}
export default function DecisionOptions({
  state,
  item,
  busy,
  act,
  onDone,
  onCustom,
}: {
  state: SpaceState;
  item: DecisionView;
  busy: boolean;
  act: SpaceAction;
  onDone: () => void;
  onCustom: () => void;
}) {
  const result = useMemo(() => optionsFor(state, item), [state, item]);
  const [choice, setChoice] = useState(result.suggestedId || "now");
  const selected =
      result.options.find((x) => x.id === choice) || result.options[0],
    pair = names(state);
  const answers = ["A", "B"].map(
    (side) => item.answers[side as "A" | "B"] as DecisionAnswer,
  );
  const opposite =
    answers[0].timing !== answers[1].timing &&
    answers.every((x) => x.timing !== "flexible");
  const now = result.options[0],
    over = now.withinLimit
      .map((v, i) => (v === false ? pair[i] : null))
      .filter(Boolean);
  return (
    <section className="decision-studio">
      <div className="decision-discovery">
        <div className="duo-orbits">
          <span>{pair[0][0]}</span>
          <span>{pair[1][0]}</span>
          <i>↔</i>
        </div>
        <div>
          <p className="overline">YOUR ANSWERS, BROUGHT TOGETHER</p>
          <h2>Compare your options.</h2>
          <p>
            {opposite
              ? `${pair[answers[0].timing === "now" ? 0 : 1]} would prefer sooner. ${pair[answers[0].timing === "save" ? 0 : 1]} would rather save first. You can compare the trade-offs without choosing for each other.`
              : over.length
                ? `A one-month plan goes above ${over.join(" and ")}’s stated comfort amount. A different price or timeline changes the picture.`
                : "These options use both of your answers and the commitments you have already made. Choosing an option starts a proposal; it never approves it for your partner."}
          </p>
        </div>
      </div>
      <p className="comparison-hint">
        Select an option to see what each of you would contribute and have left.
      </p>
      <div
        className="option-choices"
        role="group"
        aria-label="Calculated options"
      >
        {result.options.map((option) => (
          <button
            type="button"
            key={option.id}
            className={
              "option-choice " +
              (option.id === selected.id ? "selected " : "") +
              option.status
            }
            aria-pressed={option.id === selected.id}
            onClick={() => setChoice(option.id)}
          >
            <span className="option-choice-top">
              <span>
                {option.id === "now"
                  ? "01"
                  : option.id === "save"
                    ? "02"
                    : "03"}
              </span>
              {result.suggestedId === option.id ? (
                <span className="option-badge">
                  <Sparkles size={12} />
                  Fits your stated limits
                </span>
              ) : (
                <span className="option-badge">
                  {option.status === "strained"
                    ? "Needs a trade-off"
                    : option.status === "incomplete"
                      ? "Some details missing"
                      : "Within stated limits"}
                </span>
              )}
            </span>
            <strong>{option.title}</strong>
            <div className="option-choice-price">
              {money(option.amount)}
              <small>
                {item.kind === "recurring"
                  ? "/ month"
                  : option.id === "lower"
                    ? "price ceiling"
                    : "total price"}
              </small>
            </div>
            <div className="option-mini-split">
              {pair.map((name, i) => (
                <span key={i}>
                  <i className={"person-" + i} />
                  {name}
                  <b>{money(option.firstMonth[i])}</b>
                </span>
              ))}
            </div>
            <span className="option-choice-bottom">
              {option.id === "save"
                ? `Money set aside before buying · ${option.months} months`
                : option.method === "equal"
                  ? "Equal contributions"
                  : option.method === "proportional"
                    ? "Contributions based on income"
                    : "Your chosen contributions"}
              <span className="option-radio">
                {selected.id === option.id && <Check size={12} />}
              </span>
            </span>
          </button>
        ))}
      </div>
      {result.noRoom && (
        <div className="notice warning">
          There is no positive one-month price within the limits you entered.
          Saving may help; if the monthly budget itself is stretched, revisit it
          before adding a new commitment.
        </div>
      )}
      <OptionImpact projection={selected} pair={pair} />
      <div className="option-next">
        <div>
          <span className="overline">YOUR PROPOSAL</span>
          <strong>{selected.title}</strong>
          <span>
            {selected.status === "strained"
              ? "This option exceeds a stated limit. Both people will see the trade-off."
              : "Both people review and confirm separately."}
          </span>
        </div>
        <button
          className="button primary"
          disabled={busy}
          onClick={async () => {
            const r = await act("proposeDecision", {
              id: item.id,
              revision: item.revision,
              proposal: {
                amount: selected.amount,
                months: selected.months,
                method: selected.method,
                customA: selected.customA,
                notes: "",
                reviewDate: afterDays(30),
              },
            });
            if (r) onDone();
          }}
        >
          Continue with this option
          <ArrowRight size={18} />
        </button>
        <button className="text-button" onClick={onCustom}>
          <SlidersHorizontal size={15} />
          Fine-tune the numbers
        </button>
      </div>
    </section>
  );
}
