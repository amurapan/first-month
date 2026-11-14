"use client";
import { useState } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Clock,
  LockKeyhole,
  Plus,
  ShoppingBag,
  Search,
  Wallet,
} from "lucide-react";
import type {
  DecisionAnswer,
  DecisionView,
  SpaceAction,
  SpaceState,
} from "@/lib/life-types";
import type { Profile } from "@/lib/room";
import { impactForOption, impactForAgreement } from "@/lib/planning";
import DecisionOptions, { OptionImpact } from "./decision-options";
import { inputCents } from "@/lib/domain/preview.js";
import {
  afterDays,
  Approval,
  DraftStatus,
  fullDate,
  GuideCard,
  MoneyInput,
  money,
  names,
  ShareNote,
  useSavedDraft,
} from "./shared";

type Props = {
  state: SpaceState;
  busy: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
  act: SpaceAction;
  onGuide: (item: DecisionView) => Promise<unknown>;
  onError: (message: string) => void;
  planLink: (step?: number) => string;
};
const starters = [
  {
    id: "furniture",
    title: "Something for our home",
    kind: "purchase",
    label: "For our home",
  },
  {
    id: "trip",
    title: "A trip together",
    kind: "purchase",
    label: "A trip or goal",
  },
  {
    id: "subscription",
    title: "A shared subscription",
    kind: "recurring",
    label: "A monthly cost",
  },
];
const statusLabel = (item: DecisionView) =>
  item.stale
    ? "Needs a fresh look"
    : item.status === "agreed"
      ? "Agreed together"
      : item.status === "completed"
        ? "Completed"
        : item.status === "archived"
          ? "Put aside"
          : item.proposal
            ? "Review the proposal"
            : item.bothAnswered
              ? "Ready to compare"
              : "Add both perspectives";
export default function Decisions(props: Props) {
  const { state, busy, selected, onSelect, act, onError } = props,
    [filter, setFilter] = useState("active"),
    [search, setSearch] = useState("");
  if (selected?.startsWith("new"))
    return (
      <CreateDecision
        key={selected}
        template={starters.find((x) => selected === "new:" + x.id)}
        state={state}
        busy={busy}
        act={act}
        onSelect={onSelect}
        onError={onError}
      />
    );
  const item = state.householdDecisions.find((x) => x.id === selected);
  if (item)
    return (
      <DecisionDetail key={item.id + ":" + state.role} {...props} item={item} />
    );
  const items = state.householdDecisions.filter(
    (x) =>
      (x.title + " " + x.context)
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "active"
          ? !["completed", "archived"].includes(x.status)
          : ["completed", "archived"].includes(x.status))),
  );
  return (
    <>
      <div className="life-heading heading-with-action">
        <div>
          <p className="eyebrow">THE THINGS YOU DECIDE TOGETHER</p>
          <h1>A little space before a big yes.</h1>
          <p>
            Bring a purchase or recurring cost into the open. Find an option you
            both feel ready to choose.
          </p>
        </div>
        <button className="button primary" onClick={() => onSelect("new")}>
          <Plus size={17} />
          New decision
        </button>
      </div>
      <div className="decision-starters">
        {starters.map((t) => (
          <button key={t.id} onClick={() => onSelect("new:" + t.id)}>
            <Plus size={14} />
            {t.label}
          </button>
        ))}
      </div>
      {state.householdDecisions.length > 3 && (
        <label className="decision-search">
          <Search size={18} />
          <input
            aria-label="Search decisions"
            placeholder="Find a decision or agreement"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      )}
      <div className="filter-tabs" role="group" aria-label="Filter decisions">
        {[
          ["active", "In progress"],
          ["history", "Our history"],
          ["all", "Everything"],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {items.length ? (
        <div className="decision-list">
          {items.map((d) => (
            <button
              className="surface decision-list-card"
              key={d.id}
              onClick={() => onSelect(d.id)}
            >
              <span
                className={
                  "decision-icon " + (d.kind === "recurring" ? "peach-bg" : "")
                }
              >
                {d.kind === "recurring" ? (
                  <CalendarDays size={23} />
                ) : (
                  <ShoppingBag size={23} />
                )}
              </span>
              <div>
                <span className="overline">
                  {d.kind === "recurring"
                    ? "A RECURRING COST"
                    : "A ONE-TIME PURCHASE"}
                </span>
                <h2>{d.title}</h2>
                <p>
                  {d.context || "Two perspectives. One considered decision."}
                </p>
                <span
                  className={
                    "status-tag " +
                    (["agreed", "completed"].includes(d.status) && !d.stale
                      ? "green"
                      : "")
                  }
                >
                  {statusLabel(d)}
                </span>
              </div>
              <div className="decision-list-amount">
                <strong>{money(d.proposal?.amount ?? d.amount)}</strong>
                <small>
                  {d.kind === "recurring" ? "/ month" : "planned cost"}
                </small>
                <ChevronRight size={20} />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <section className="surface empty-state">
          <ShoppingBag size={34} />
          <h2>
            {filter === "history"
              ? "Your decisions will have a home here."
              : "Start with what’s actually on your mind."}
          </h2>
          <p>
            {filter === "history"
              ? "Completed and put-aside decisions stay available so you can remember what you chose and why."
              : "Furniture, a trip, a shared subscription, or another household purchase. Add the cost, then make room for both perspectives."}
          </p>
          <button className="button primary" onClick={() => onSelect("new")}>
            Start our first decision
            <ArrowRight size={17} />
          </button>
        </section>
      )}
    </>
  );
}
function CreateDecision({
  template,
  state,
  busy,
  act,
  onSelect,
  onError,
}: Pick<Props, "state" | "busy" | "act" | "onSelect" | "onError"> & {
  template?: (typeof starters)[number];
}) {
  const draft = useSavedDraft(
    "fm:new-decision:" +
      state.id +
      ":" +
      state.role +
      ":" +
      (template?.id || "custom"),
    {
      title: template?.title || "",
      kind: template?.kind || "purchase",
      amount: "",
      context: "",
    },
  );
  return (
    <>
      <button className="text-button back-link" onClick={() => onSelect(null)}>
        <ArrowLeft size={16} />
        All decisions
      </button>
      <div className="life-heading">
        <p className="eyebrow">A DECISION WORTH TALKING ABOUT</p>
        <h1>What are you considering?</h1>
        <p>
          Start with the decision and its cost. Each of you will add your own
          perspective next.
        </p>
      </div>
      <form
        className="surface decision-create"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const before = new Set(state.householdDecisions.map((x) => x.id));
            const result = await act("createDecision", {
              ...draft.value,
              amount: inputCents(draft.value.amount),
            });
            if (result) {
              draft.reset();
              onSelect(
                result.householdDecisions.find((x) => !before.has(x.id))?.id ||
                  null,
              );
            }
          } catch (error) {
            onError((error as Error).message);
          }
        }}
      >
        <label>
          What is it?
          <input
            name="title"
            required
            autoFocus
            maxLength={100}
            placeholder="A sofa for our living room"
            value={draft.value.title}
            onChange={(e) => draft.change({ title: e.target.value })}
          />
        </label>
        <div className="choice-pair" role="group" aria-label="Type of cost">
          <button
            type="button"
            aria-pressed={draft.value.kind === "purchase"}
            onClick={() => draft.change({ kind: "purchase" })}
          >
            <ShoppingBag size={20} />
            <strong>One-time purchase</strong>
            <small>Pay now or save together first</small>
          </button>
          <button
            type="button"
            aria-pressed={draft.value.kind === "recurring"}
            onClick={() => draft.change({ kind: "recurring" })}
          >
            <CalendarDays size={20} />
            <strong>Recurring cost</strong>
            <small>An ongoing monthly commitment</small>
          </button>
        </div>
        <MoneyInput
          label={
            draft.value.kind === "recurring"
              ? "Expected monthly cost"
              : "Expected total cost"
          }
          value={draft.value.amount}
          onChange={(amount) => draft.change({ amount })}
        />
        <label>
          Why are you considering it? <span className="optional">Optional</span>
          <textarea
            rows={3}
            maxLength={1500}
            placeholder="What would it change for your home? What is worth discussing?"
            value={draft.value.context}
            onChange={(e) => draft.change({ context: e.target.value })}
          />
        </label>
        <p className="fine-print">
          The title, cost, and context are visible to both of you. Your personal
          perspective comes next and has its own sharing choice.
        </p>
        <div className="form-actions">
          <button className="button primary" disabled={busy}>
            {busy ? "Starting…" : "Make room for both sides"}
            <ArrowRight size={17} />
          </button>
        </div>
        <DraftStatus {...draft} onReset={() => draft.reset()} />
      </form>
    </>
  );
}
function DecisionDetail({
  item,
  state,
  busy,
  onSelect,
  act,
  onGuide,
  onError,
  planLink,
}: Props & { item: DecisionView }) {
  const pair = names(state),
    own = item.answers[state.role] as DecisionAnswer | undefined;
  const [editing, setEditing] = useState(!own),
    [comparing, setComparing] = useState(!item.proposal),
    [custom, setCustom] = useState(false);
  const closed = ["completed", "archived"].includes(item.status);
  let proposalImpact: ReturnType<typeof impactForOption> | null = null;
  if (item.proposal && item.bothAnswered && !closed) {
    try {
      proposalImpact =
        item.status === "agreed"
          ? impactForAgreement(state, item)
          : impactForOption(state, item, item.proposal);
    } catch {}
  }
  return (
    <>
      <button className="text-button back-link" onClick={() => onSelect(null)}>
        <ArrowLeft size={16} />
        All decisions
      </button>
      <div className="life-heading decision-detail-heading">
        <p className="eyebrow">
          {item.kind === "recurring"
            ? "A RECURRING COMMITMENT"
            : "A ONE-TIME PURCHASE"}
        </p>
        <h1>{item.title}</h1>
        <div>
          <strong>
            {money(item.proposal?.amount ?? item.amount)}
            {item.kind === "recurring" && <small>/ month</small>}
          </strong>
          <span
            className={
              "status-tag " + (item.status === "agreed" ? "green" : "")
            }
          >
            {statusLabel(item)}
          </span>
        </div>
        {item.context && <p>{item.context}</p>}
      </div>
      {item.status === "completed" && item.kind === "recurring" && (
        <div className="notice">
          <CheckCheck size={20} />
          <p>
            This cost is now in your monthly plan. Both of you can review and
            confirm the updated budget.
          </p>
          <a className="button secondary" href={planLink(3)}>
            Review monthly plan
            <ArrowRight size={16} />
          </a>
        </div>
      )}
      {item.stale && (
        <div className="notice warning">
          <Clock size={20} />
          <p>
            Your budget, other commitments, or the planning month changed.
            Compare the updated numbers before confirming this proposal.
          </p>
        </div>
      )}
      {item.status === "open" && item.activeResolutionVersion && (
        <div className="notice">
          <Clock size={18} />
          <p>
            Your earlier agreement stays in the shared plan while you review
            these changes. It is replaced only after both people approve the new
            terms.
          </p>
        </div>
      )}
      {!state.bothShared && (
        <div className="notice">
          <LockKeyhole size={18} />
          <p>
            You can add your perspective now. Both people must share their
            income before comparing the financial impact.
          </p>
          <a href={planLink(0)} className="text-button">
            Review my sharing
            <ArrowRight size={15} />
          </a>
        </div>
      )}
      {!closed && (editing || !own) ? (
        <DecisionAnswerForm
          key={item.id + ":answer"}
          item={item}
          state={state}
          busy={busy}
          act={act}
          onDone={() => setEditing(false)}
          onError={onError}
        />
      ) : (
        <details className="decision-perspectives" open={!item.bothAnswered}>
          <summary>
            Your two perspectives
            <span>
              {item.bothAnswered ? "Both shared" : "Waiting for both sides"}
            </span>
          </summary>
          <section className="surface perspectives">
            <div className="section-heading">
              <div>
                <p className="overline">BOTH SIDES OF THE CONVERSATION</p>
                <h2>What matters to each of you.</h2>
              </div>
              {!closed && (
                <button
                  className="text-button"
                  onClick={() => setEditing(true)}
                >
                  Edit my answer
                </button>
              )}
            </div>
            <div className="perspective-grid">
              {(["A", "B"] as const).map((side, i) => {
                const answer = item.answers[side],
                  visible = answer && "timing" in answer;
                return (
                  <article key={side}>
                    <span className={"avatar " + (i ? "peach" : "")}>
                      {pair[i][0]}
                    </span>
                    <h3>{pair[i]}</h3>
                    {visible ? (
                      <>
                        <span className="status-tag">
                          {answer.timing === "now"
                            ? "Would prefer sooner"
                            : answer.timing === "save"
                              ? "Would rather save first"
                              : "Flexible on timing"}
                        </span>
                        <p className="perspective-limit">
                          {answer.limit === null
                            ? "No monthly comfort amount added"
                            : money(answer.limit) +
                              " / month feels comfortable"}
                        </p>
                        <p>{answer.note || "No extra note added."}</p>
                        {!answer.shared && (
                          <small>
                            <LockKeyhole size={12} />
                            Only you can see this answer
                          </small>
                        )}
                      </>
                    ) : (
                      <p>
                        {answer
                          ? "Their answer is saved privately. It appears after both people share."
                          : "A little space for their perspective."}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
            {!item.bothAnswered && !closed && (
              <p className="waiting-note">
                <Clock size={16} />
                Both perspectives appear together once you each choose to share.
              </p>
            )}
          </section>
        </details>
      )}
      {item.bothAnswered && !closed && (
        <>
          {comparing || !item.proposal || item.stale ? (
            custom ? (
              <ProposalBuilder
                key={
                  item.id +
                  ":" +
                  item.proposal?.version +
                  ":" +
                  state.planVersion
                }
                item={item}
                state={state}
                busy={busy}
                act={act}
                onDone={() => {
                  setComparing(false);
                  setCustom(false);
                }}
                onError={onError}
              />
            ) : (
              <DecisionOptions
                state={state}
                item={item}
                busy={busy}
                act={act}
                onDone={() => setComparing(false)}
                onCustom={() => setCustom(true)}
              />
            )
          ) : null}
        </>
      )}
      {item.proposal && (!comparing || closed) && (
        <section className="surface proposal-summary">
          <div className="section-heading">
            <div>
              <p className="overline">
                PROPOSAL {item.proposal.version} · MONTHLY PLAN{" "}
                {item.proposal.planVersion}
              </p>
              <h2>
                {item.status === "completed"
                  ? "A decision followed through."
                  : item.status === "agreed"
                    ? "You both said yes."
                    : "An option to consider together."}
              </h2>
            </div>
            {!closed && (
              <button
                className="text-button"
                onClick={() => setComparing(true)}
              >
                Explore another option
              </button>
            )}
          </div>
          <div className="proposal-summary-amounts">
            {pair.map((name, i) => {
              const p = item.proposal!;
              const res = item.resolutions.find((x) => x.version === p.version);
              let value = res?.contributions[i];
              if (
                value === undefined &&
                item.bothAnswered &&
                state.calculation
              ) {
                try {
                  value = impactForOption(state, item, p).contributions[i];
                } catch {}
              }
              return (
                <div key={name + i}>
                  <span>{name} contributes</span>
                  <strong>
                    {value === undefined ? "Share both answers" : money(value)}
                  </strong>
                  <small>
                    {p.months > 1
                      ? "saved over " + p.months + " months"
                      : item.kind === "recurring"
                        ? "each month"
                        : "one time"}
                  </small>
                </div>
              );
            })}
          </div>
          <p>{item.proposal.notes || "No extra conditions added."}</p>
          <p className="small-text muted">
            <CalendarDays size={14} />
            Revisit on {fullDate(item.proposal.reviewDate)} ·{" "}
            {item.proposal.method === "proportional"
              ? "Split by income"
              : item.proposal.method === "custom"
                ? "Your own split"
                : "Equal contributions"}
          </p>
          {proposalImpact && (
            <OptionImpact projection={proposalImpact} pair={pair} />
          )}
          <Approval state={state} approvals={item.proposal.approvals} />
          {!closed && item.bothAnswered && !item.stale && (
            <div className="form-actions">
              {item.status === "agreed" ? (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    act(
                      item.kind === "recurring"
                        ? "applyRecurring"
                        : "completeDecision",
                      {
                        id: item.id,
                        revision: item.revision,
                      },
                    )
                  }
                >
                  <CheckCheck size={18} />
                  {item.kind === "recurring"
                    ? "Add to our monthly plan"
                    : item.proposal.months > 1
                      ? "Mark saving plan completed"
                      : "Mark as purchased"}
                </button>
              ) : item.proposal.approvals[state.role] !== "accepted" ? (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    act("approveDecision", {
                      id: item.id,
                      revision: item.revision,
                      proposalVersion: item.proposal!.version,
                      decision: "accepted",
                    })
                  }
                >
                  <Check size={17} />I agree to this proposal
                </button>
              ) : (
                <span className="accepted-message">
                  <Check size={17} />
                  Your yes is saved. Waiting for your partner.
                </span>
              )}
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  act("approveDecision", {
                    id: item.id,
                    revision: item.revision,
                    proposalVersion: item.proposal!.version,
                    decision: "changes",
                  })
                }
              >
                I’d like a change
              </button>
            </div>
          )}
          <p className="fine-print">
            This records your choice without moving money. Adding a recurring
            cost updates your monthly plan and asks both of you to confirm its
            new version.
          </p>
        </section>
      )}
      {item.status === "agreed" &&
        item.kind === "purchase" &&
        item.proposal &&
        item.proposal.months > 1 && (
          <SavingsProgress
            item={item}
            state={state}
            busy={busy}
            act={act}
            onError={onError}
          />
        )}
      {item.bothAnswered && !closed && (
        <details className="conversation-help">
          <summary>
            Find the words for this conversation<span>Optional</span>
          </summary>
          <GuideCard
            text={item.guide}
            busy={busy}
            onGenerate={() => void onGuide(item)}
          />
        </details>
      )}
      {item.cancellation && !closed && (
        <div className="notice warning">
          One of you asked to put this decision aside. Its agreed allocation
          stays in the plan until both people confirm cancellation.
        </div>
      )}
      {item.resolutions.length > 0 && (
        <details className="decision-history">
          <summary>
            <Clock size={16} />
            Previous agreements ({item.resolutions.length})
          </summary>
          {[...item.resolutions].reverse().map((r, i) => (
            <article key={i}>
              <strong>
                {fullDate(r.at)} · {money(r.amount)}
              </strong>
              <p>
                {pair[0]}: {money(r.contributions[0])} · {pair[1]}:{" "}
                {money(r.contributions[1])}
                {r.months > 1 ? " · Saving over " + r.months + " months" : ""}
              </p>
              <p>{r.notes || "No extra conditions."}</p>
            </article>
          ))}
        </details>
      )}
      <div className="decision-bottom">
        {item.status === "completed" ? (
          <button className="text-button" onClick={() => onSelect("new")}>
            Start another decision
            <ArrowRight size={16} />
          </button>
        ) : closed ? (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => {
              void act("reopenDecision", {
                id: item.id,
                revision: item.revision,
              });
              setComparing(true);
            }}
          >
            Reopen the conversation
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            className="text-button"
            disabled={busy || !!item.cancellation?.[state.role]}
            onClick={() =>
              act("archiveDecision", { id: item.id, revision: item.revision })
            }
          >
            <Archive size={15} />
            {item.cancellation?.[state.role]
              ? "Waiting for your partner to set it aside"
              : item.cancellation
                ? "Agree to set this aside"
                : "Put this decision aside"}
          </button>
        )}
        <span>Created {fullDate(item.createdAt)}</span>
      </div>
    </>
  );
}
function DecisionAnswerForm({
  item,
  state,
  busy,
  act,
  onDone,
  onError,
}: {
  item: DecisionView;
  state: SpaceState;
  busy: boolean;
  act: SpaceAction;
  onDone: () => void;
  onError: (s: string) => void;
}) {
  const own = item.answers[state.role] as DecisionAnswer | undefined;
  const initial = {
    limit: own?.limit == null ? "" : String(own.limit / 100),
    timing: own?.timing || "flexible",
    note: own?.note || "",
  };
  const draft = useSavedDraft(
    "fm:decision-answer:" + item.id + ":" + state.role,
    initial,
  );
  return (
    <form
      className="surface decision-answer"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const shared =
            (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") !==
            "private";
          const result = await act("answerDecision", {
            id: item.id,
            revision: item.revision,
            answer: {
              ...draft.value,
              limit:
                draft.value.limit === "" ? null : inputCents(draft.value.limit),
              shared,
            },
          });
          if (result) {
            draft.reset(draft.value);
            onDone();
          }
        } catch (error) {
          onError((error as Error).message);
        }
      }}
    >
      <p className="overline">YOUR PERSPECTIVE</p>
      <h2>What would feel comfortable?</h2>
      <MoneyInput
        label="What could you comfortably add per month?"
        optional
        value={draft.value.limit}
        onChange={(limit) => draft.change({ limit })}
        hint="This is your comfort amount for this decision, on top of your current shared costs. It is not a promise."
      />
      <fieldset className="timing-field">
        <legend>How do you feel about timing?</legend>
        <div className="segmented-options">
          {[
            ["now", "Sooner"],
            ["save", "Save first"],
            ["flexible", "Flexible"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={draft.value.timing === value}
              onClick={() =>
                draft.change({ timing: value as typeof initial.timing })
              }
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <label>
        What do you want your partner to understand?{" "}
        <span className="optional">Optional</span>
        <textarea
          rows={3}
          maxLength={1500}
          value={draft.value.note}
          onChange={(e) => draft.change({ note: e.target.value })}
          placeholder="I like the idea. I also want to protect what we’re saving for our trip."
        />
      </label>
      <ShareNote />
      <div className="form-actions">
        <button
          className="button primary"
          value="share"
          disabled={busy || draft.conflict}
        >
          Share my perspective
          <ArrowRight size={17} />
        </button>
        <button
          className="text-button"
          value="private"
          disabled={busy || draft.conflict}
        >
          Save privately
        </button>
      </div>
      <DraftStatus {...draft} onReset={() => draft.reset()} />
    </form>
  );
}
function ProposalBuilder({
  item,
  state,
  busy,
  act,
  onDone,
  onError,
}: {
  item: DecisionView;
  state: SpaceState;
  busy: boolean;
  act: SpaceAction;
  onDone: () => void;
  onError: (s: string) => void;
}) {
  const p = item.proposal,
    pair = names(state),
    draft = useSavedDraft("fm:proposal:" + item.id + ":" + state.role, {
      amount: String((p?.amount ?? item.amount) / 100),
      method: p?.method || "proportional",
      months: String(p?.months || 1),
      customA: String((p?.customA || 0) / 100),
      notes: p?.notes || "",
      reviewDate: p?.reviewDate || afterDays(30),
    });
  let impact: ReturnType<typeof impactForOption> | null = null,
    problem = "";
  try {
    if (!state.calculation)
      throw new Error(
        "Choose a valid monthly split before comparing this decision.",
      );
    impact = impactForOption(state, item, {
      amount: inputCents(draft.value.amount),
      months: Number(draft.value.months),
      method: draft.value.method,
      customA: inputCents(draft.value.customA),
    });
  } catch (e) {
    problem = (e as Error).message;
  }
  return (
    <form
      className="surface proposal-builder"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const result = await act("proposeDecision", {
            id: item.id,
            revision: item.revision,
            proposal: {
              ...draft.value,
              amount: inputCents(draft.value.amount),
              months: Number(draft.value.months),
              customA: inputCents(draft.value.customA),
            },
          });
          if (result) {
            draft.reset(draft.value);
            onDone();
          }
        } catch (error) {
          onError((error as Error).message);
        }
      }}
    >
      <p className="overline">EXPLORE THE CONSEQUENCES</p>
      <h2>Find an option to bring back to each other.</h2>
      <div className="proposal-controls">
        <MoneyInput
          label={
            item.kind === "recurring"
              ? "Proposed monthly cost"
              : "Proposed total cost"
          }
          value={draft.value.amount}
          onChange={(amount) => draft.change({ amount })}
        />
        {item.kind === "purchase" && (
          <label>
            When would you fund it?
            <select
              value={draft.value.months}
              onChange={(e) => draft.change({ months: e.target.value })}
            >
              {[1, 2, 3, 4, 6, 9, 12, 18, 24].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "This month" : "Save over " + n + " months"}
                </option>
              ))}
            </select>
            <small>Saving before buying. No loan or interest assumed.</small>
          </label>
        )}
      </div>
      <div
        className="segmented-options"
        role="group"
        aria-label="Contribution method"
      >
        {[
          ["equal", "50 / 50"],
          ["proportional", "By income"],
          ["custom", "Our own split"],
        ].map(([method, label]) => (
          <button
            key={method}
            type="button"
            aria-pressed={draft.value.method === method}
            onClick={() =>
              draft.change({ method: method as typeof draft.value.method })
            }
          >
            {label}
          </button>
        ))}
      </div>
      {draft.value.method === "custom" && (
        <MoneyInput
          label={pair[0] + "’s total contribution"}
          value={draft.value.customA}
          onChange={(customA) => draft.change({ customA })}
          hint="The rest goes to the other partner. Both still need to agree."
        />
      )}
      {problem && <p className="notice warning">{problem}</p>}
      {impact && (
        <div className="impact-grid" aria-live="polite">
          {pair.map((name, i) => (
            <article key={name + i}>
              <span>{name}</span>
              <strong>
                {money(impact!.firstMonth[i])}
                <small>
                  {Number(draft.value.months) > 1
                    ? "saved in month one"
                    : item.kind === "recurring"
                      ? "/ month"
                      : "this month"}
                </small>
              </strong>
              <dl>
                <div>
                  <dt>Total contribution</dt>
                  <dd>{money(impact!.contributions[i])}</dd>
                </div>
                <div>
                  <dt>After included monthly costs</dt>
                  <dd>{money(impact!.remaining[i])}</dd>
                </div>
              </dl>
              <p
                className={impact!.withinLimit[i] === false ? "attention" : ""}
              >
                {impact!.withinLimit[i] === null
                  ? "No comfort amount added"
                  : impact!.withinLimit[i]
                    ? "Within the comfort amount shared"
                    : "Above the comfort amount shared"}
              </p>
              <p
                className={
                  impact!.preferenceMet[i] === false ? "attention" : "muted"
                }
              >
                {impact!.preferenceMet[i] === null
                  ? "Personal bills and savings preferences are not included yet."
                  : impact!.preferenceMet[i]
                    ? "Preserves the amount they want to keep."
                    : "Leaves less than they want to keep."}
              </p>
            </article>
          ))}
        </div>
      )}
      {impact && Number(draft.value.months) > 1 && (
        <details className="savings-details">
          <summary>See the savings schedule</summary>
          <div className="schedule-table">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  {pair.map((name, i) => (
                    <th key={i}>{name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {impact.schedule[0].map((_, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{money(impact!.schedule[0][i])}</td>
                    <td>{money(impact!.schedule[1][i])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <p className="fine-print">
        Other agreed commitments are included. Unapproved ideas are not
        reserved. This projects allocations from your monthly plan and reported
        savings; it does not show your bank balance or track spending outside
        this plan.
      </p>
      <div className="proposal-controls">
        <label>
          When will you revisit it?
          <input
            type="date"
            required
            value={draft.value.reviewDate}
            onChange={(e) => draft.change({ reviewDate: e.target.value })}
          />
        </label>
        <label>
          Conditions you want to agree on{" "}
          <span className="optional">Optional</span>
          <textarea
            rows={2}
            maxLength={1500}
            value={draft.value.notes}
            onChange={(e) => draft.change({ notes: e.target.value })}
            placeholder="We’ll buy once both contributions are saved."
          />
        </label>
      </div>
      <div className="form-actions">
        <button
          className="button primary"
          disabled={busy || !impact || draft.conflict}
        >
          Propose this option
          <ArrowRight size={17} />
        </button>
        <span className="fine-print">Both of you confirm separately next.</span>
      </div>
      <DraftStatus {...draft} onReset={() => draft.reset()} />
    </form>
  );
}

function SavingsProgress({
  item,
  state,
  busy,
  act,
  onError,
}: {
  item: DecisionView;
  state: SpaceState;
  busy: boolean;
  act: SpaceAction;
  onError: (s: string) => void;
}) {
  const pair = names(state),
    resolution = item.resolutions.find(
      (x) => x.version === item.proposal?.version,
    ),
    [amount, setAmount] = useState(
      String((item.funding?.[state.role] || 0) / 100),
    );
  if (!resolution) return null;
  return (
    <section className="surface savings-progress">
      <p className="overline">FOLLOW THROUGH, AT YOUR PACE</p>
      <h2>A little closer to the thing you chose.</h2>
      <div className="savings-progress-pair">
        {(["A", "B"] as const).map((side, i) => {
          const saved = item.funding?.[side] || 0,
            target = resolution.contributions[i];
          return (
            <div key={side}>
              <span>{pair[i]}</span>
              <strong>
                {money(saved)}
                <small> of {money(target)}</small>
              </strong>
              <progress
                max={target || 1}
                value={target ? Math.min(saved, target) : 1}
              />
            </div>
          );
        })}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await act("fundDecision", {
              id: item.id,
              revision: item.revision,
              amount: inputCents(amount),
            });
          } catch (error) {
            onError((error as Error).message);
          }
        }}
      >
        <MoneyInput
          label="My total saved so far"
          value={amount}
          onChange={setAmount}
          hint="Enter your running total, not just today’s addition. You can correct it later."
        />
        <button className="button secondary" disabled={busy}>
          Update my progress
          <Check size={16} />
        </button>
      </form>
      <p className="fine-print">
        Increases you report are counted in this month’s plan. Previously saved,
        undated progress is treated as money already set aside. Progress is
        self-reported; First Month does not hold, transfer, or verify these
        funds.
      </p>
    </section>
  );
}
