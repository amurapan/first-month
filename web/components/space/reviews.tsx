"use client";
import {
  currentMonth,
  monthTotals,
  monthOutstanding,
} from "@/lib/domain/month.js";
import { ledgerFor } from "@/lib/planning";
import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  Clock,
  LockKeyhole,
} from "lucide-react";
import type {
  ReviewAnswer,
  ReviewView,
  SpaceAction,
  SpaceState,
} from "@/lib/life-types";
import { ConversationSteps, WaitingForPartner } from "./conversation-flow";
import {
  afterDays,
  Approval,
  downloadFile,
  DraftStatus,
  fullDate,
  GuideCard,
  names,
  money,
  ShareNote,
  sideName,
  useSavedDraft,
} from "./shared";
const feeling = {
  comfortable: "Comfortable",
  mixed: "A little mixed",
  stretched: "Feeling stretched",
};

type Topic = { label: string; text: string };
function topicsFor(state: SpaceState): Topic[] {
  const month = state.months.find((x) => x.period === currentMonth());
  const actual = month ? monthTotals(month) : null;
  const over = actual?.categories.find((x) => x.difference > 0);
  const lastExpense = month?.entries
    .filter((x) => x.kind === "expense")
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    )[0];
  const previous = state.householdReviews.find(
    (x) => x.week !== state.currentWeek && x.action && !x.action.completed,
  );
  const decision = state.householdDecisions.find(
    (x) => x.status !== "archived",
  );
  const topics: Topic[] = [];
  if (previous?.action)
    topics.push({
      label: "An unfinished step",
      text: `Follow up: ${previous.action.text}`.slice(0, 240),
    });
  if (over)
    topics.push({
      label: `${over.label} spending`,
      text: `${over.label}: ${money(over.actual)} recorded, ${money(over.planned)} planned this month.`,
    });
  else if (lastExpense)
    topics.push({
      label: "A recent expense",
      text: `${lastExpense.title || "Shared expense"}: ${money(lastExpense.amount)} recorded on ${fullDate(lastExpense.date)}.`,
    });
  if (decision)
    topics.push({
      label: "A purchase or plan",
      text: `${decision.title} — ${decision.status === "completed" ? "completed decision" : decision.status === "agreed" ? "agreed plan" : "still to decide"}.`,
    });
  topics.push({
    label: "Our everyday spending",
    text: "How our everyday spending is working for each of us.",
  });
  return topics;
}

export default function Reviews({
  state,
  busy,
  act,
  onGuide,
  onError,
  planLink,
  onMonth,
  onInvite,
  onDecision,
}: {
  onMonth: () => void;
  onInvite: () => void;
  onDecision: (id: string | null) => void;
  state: SpaceState;
  busy: boolean;
  act: SpaceAction;
  onGuide: (item: ReviewView) => Promise<unknown>;
  onError: (s: string) => void;
  planLink: (step?: number) => string;
}) {
  const current = state.householdReviews.find(
    (x) => x.week === state.currentWeek,
  );
  const pair = names(state);
  const own = current?.answers[state.role] as ReviewAnswer | undefined;
  const [editing, setEditing] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const answering = !own || editing;
  const agreed = current?.action?.approvals.A && current.action.approvals.B;
  const step =
    answering || !current?.bothAnswered
      ? 0
      : agreed
        ? 3
        : current.action || choosing
          ? 2
          : 1;
  const older = state.householdReviews.filter(
    (x) => x.week !== state.currentWeek,
  );
  function calendar() {
    downloadFile(
      "our-weekly-money-check-in.ics",
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//First Month//Weekly check-in//EN",
        "BEGIN:VEVENT",
        "UID:" + state.id + "-weekly@firstmonth",
        "DTSTAMP:" +
          new Date()
            .toISOString()
            .replace(/[-:]/g, "")
            .replace(/\.\d{3}/, ""),
        "DTSTART;VALUE=DATE:" + afterDays(7).replaceAll("-", ""),
        "RRULE:FREQ=WEEKLY",
        "SUMMARY:Our weekly money check-in",
        "DESCRIPTION:What worked? What changed? Choose one action together. Open your saved First Month link.",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
      ].join("\r\n"),
      "text/calendar",
    );
  }
  return (
    <>
      <div className="life-heading heading-with-action">
        <div>
          <p className="eyebrow">
            WEEK OF {fullDate(state.currentWeek).toUpperCase()}
          </p>
          <h1>One conversation. One next step.</h1>
          <p>
            Pick something from your week, hear each other out, and choose one
            thing to do next.
          </p>
        </div>
        <button className="text-button" onClick={calendar}>
          <CalendarDays size={17} /> Add weekly reminder
        </button>
      </div>
      <ConversationSteps
        steps={[
          "Your check-in",
          "Hear both sides",
          "Choose a step",
          "Follow through",
        ]}
        current={step}
      />
      {answering ? (
        <ReviewForm
          key={state.currentWeek + ":" + state.role}
          state={state}
          current={current}
          busy={busy}
          act={act}
          onDone={() => {
            setEditing(false);
            setChoosing(false);
          }}
          onError={onError}
        />
      ) : (
        <>
          {!current?.bothAnswered &&
            !(
              own.shared &&
              current?.answers[state.role === "A" ? "B" : "A"]?.shared
            ) && (
              <WaitingForPartner
                name={state.partner.name}
                privateAnswer={!own.shared}
                busy={busy}
                onShare={() =>
                  void act("answerReview", {
                    revision: current?.revision || 0,
                    answer: { ...own, shared: true },
                  })
                }
                onInvite={onInvite}
              />
            )}
          {!state.bothShared && (
            <div className="notice">
              <LockKeyhole size={18} />
              <p>
                Both people also need to share their income to open the joint
                conversation.
              </p>
              <a className="text-button" href={planLink(0)}>
                Review my sharing <ArrowRight size={15} />
              </a>
            </div>
          )}
          <details
            className="decision-perspectives review-perspectives"
            open={!!current?.bothAnswered && !current.action && !choosing}
          >
            <summary>
              Your two check-ins{" "}
              <span>
                {current?.bothAnswered ? "Both shared" : "Your saved answer"}
              </span>
            </summary>
            <section className="surface perspectives">
              <div className="section-heading">
                <h2>What matters this week.</h2>
                <button
                  className="text-button"
                  onClick={() => setEditing(true)}
                >
                  Edit my check-in
                </button>
              </div>
              <div className="perspective-grid">
                {(["A", "B"] as const).map((side, i) => {
                  const answer = current?.answers[side];
                  return (
                    <article key={side}>
                      <span className={"avatar " + (i ? "peach" : "")}>
                        {pair[i][0]}
                      </span>
                      <h3>{pair[i]}</h3>
                      {answer && "feeling" in answer ? (
                        <>
                          <span
                            className={
                              "status-tag " +
                              (answer.feeling === "comfortable" ? "green" : "")
                            }
                          >
                            {feeling[answer.feeling]}
                          </span>
                          {answer.topic && (
                            <p className="review-topic-saved">
                              <strong>About</strong> {answer.topic}
                            </p>
                          )}
                          {answer.worked && (
                            <>
                              <h4>What worked</h4>
                              <p>{answer.worked}</p>
                            </>
                          )}
                          <h4>What would help</h4>
                          <p>
                            {answer.change || "Nothing to change right now."}
                          </p>
                          {!answer.shared && (
                            <small>
                              <LockKeyhole size={12} /> Only you can see this
                              answer
                            </small>
                          )}
                        </>
                      ) : (
                        <p>
                          {answer
                            ? "Their check-in is saved. You’ll see it after both people share."
                            : "Their side is still to come."}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          </details>
        </>
      )}
      {current?.bothAnswered && !answering && (
        <>
          {!current.action && !choosing ? (
            <section className="surface checkin-next">
              <p className="overline">FROM TALKING TO DOING</p>
              <h2>What is one thing you can do?</h2>
              <p>
                Read both check-ins, then choose a small action with a person
                and a date. You each confirm it separately.
              </p>
              <button
                className="button primary"
                onClick={() => setChoosing(true)}
              >
                Choose our next step <ArrowRight size={17} />
              </button>
            </section>
          ) : (
            <WeeklyAction
              key={current.id}
              state={state}
              item={current}
              busy={busy}
              act={act}
              onError={onError}
            />
          )}
          <details className="conversation-help">
            <summary>
              Find the words for your check-in<span>Optional</span>
            </summary>
            <GuideCard
              text={current.guide}
              busy={busy}
              onGenerate={() => onGuide(current)}
              label="Prepare our weekly conversation"
            />
          </details>
          {agreed && (
            <div
              className="checkin-destinations"
              aria-label="Put your next step into practice"
            >
              <span>Ready to act?</span>
              <button className="text-button" onClick={onMonth}>
                Review recorded spending <ArrowRight size={15} />
              </button>
              <button className="text-button" onClick={() => onDecision(null)}>
                Open our decisions <ArrowRight size={15} />
              </button>
              <a className="text-button" href={planLink(2)}>
                Adjust our budget <ArrowRight size={15} />
              </a>
            </div>
          )}
        </>
      )}
      {older.length > 0 && (
        <section className="weekly-history">
          <div className="section-heading">
            <div>
              <p className="overline">EARLIER CHECK-INS</p>
              <h2>Keep your next steps in reach.</h2>
            </div>
          </div>
          {older.map((item) => (
            <details key={item.id} className="surface">
              <summary>
                <span>Week of {fullDate(item.week)}</span>
                <span className="status-tag">
                  {item.action?.completed
                    ? "Action completed"
                    : item.action
                      ? "Next step unfinished"
                      : item.bothAnswered
                        ? "Both checked in"
                        : "Check-in started"}
                </span>
              </summary>
              {item.bothAnswered ? (
                <>
                  {(["A", "B"] as const).map((side, i) => {
                    const a = item.answers[side] as ReviewAnswer;
                    return (
                      <p key={side}>
                        <strong>
                          {pair[i]} · {feeling[a.feeling]}
                        </strong>
                        <br />
                        {a.topic && (
                          <>
                            {a.topic}
                            <br />
                          </>
                        )}
                        {a.worked}
                        <br />
                        {a.change}
                      </p>
                    );
                  })}
                  {item.action && (
                    <WeeklyAction
                      state={state}
                      item={item}
                      busy={busy}
                      act={act}
                      onError={onError}
                    />
                  )}
                </>
              ) : (
                <p>Private answers remain private.</p>
              )}
            </details>
          ))}
        </section>
      )}
      <p className="fine-print">
        Check-ins open weekly, Monday–Sunday in UTC. Calendar reminders live in
        your calendar; First Month does not send reminder emails.
      </p>
    </>
  );
}
function ReviewForm({
  state,
  current,
  busy,
  act,
  onDone,
  onError,
}: {
  state: SpaceState;
  current?: ReviewView;
  busy: boolean;
  act: SpaceAction;
  onDone: () => void;
  onError: (s: string) => void;
}) {
  const own = current?.answers[state.role] as ReviewAnswer | undefined;
  const draft = useSavedDraft(
    "fm:review:" + state.id + ":" + state.currentWeek + ":" + state.role,
    {
      feeling: own?.feeling || "mixed",
      worked: own?.worked || "",
      change: own?.change || "",
    },
  );
  const topicDraft = useSavedDraft(
    "fm:review-topic:" + state.id + ":" + state.currentWeek + ":" + state.role,
    { topic: own?.topic || "" },
  );
  const topics = topicsFor(state);
  return (
    <form
      className="surface review-form"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const shared =
            (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") !==
            "private";
          const result = await act("answerReview", {
            revision: current?.revision || 0,
            answer: { ...draft.value, ...topicDraft.value, shared },
          });
          if (result) {
            draft.reset(draft.value);
            topicDraft.reset(topicDraft.value);
            onDone();
          }
        } catch (error) {
          onError((error as Error).message);
        }
      }}
    >
      <p className="overline">YOUR SIDE OF THIS WEEK</p>
      <h2>Start with something real.</h2>
      <fieldset className="checkin-topics">
        <legend>
          Pick a topic, or add your own.{" "}
          <span className="optional">Optional</span>
        </legend>
        <div>
          {topics.map((topic) => (
            <button
              type="button"
              key={topic.label}
              aria-pressed={topicDraft.value.topic === topic.text}
              onClick={() => topicDraft.change({ topic: topic.text })}
            >
              {topic.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label>
        What are we talking about?
        <input
          maxLength={240}
          value={topicDraft.value.topic}
          onChange={(e) => topicDraft.change({ topic: e.target.value })}
          placeholder="That grocery bill, a new sofa, or last week's agreement"
        />
      </label>
      <h3>How has money felt?</h3>
      <div
        className="feeling-options"
        role="group"
        aria-label="How money has felt"
      >
        {Object.entries(feeling).map(([value, label], i) => (
          <button
            type="button"
            key={value}
            aria-pressed={draft.value.feeling === value}
            onClick={() =>
              draft.change({ feeling: value as ReviewAnswer["feeling"] })
            }
          >
            <span>{["☀", "◒", "☁"][i]}</span>
            {label}
          </button>
        ))}
      </div>
      <label>
        What would help this week? <span className="optional">Optional</span>
        <textarea
          rows={2}
          maxLength={1200}
          value={draft.value.change}
          onChange={(e) => draft.change({ change: e.target.value })}
          placeholder="One thing you’d like to discuss or change. It is okay if things are working well."
        />
      </label>
      <details className="checkin-positive" open={!!own?.worked}>
        <summary>
          Add something that worked well <span>Optional</span>
        </summary>
        <label>
          What worked well?
          <textarea
            rows={2}
            maxLength={1200}
            value={draft.value.worked}
            onChange={(e) => draft.change({ worked: e.target.value })}
            placeholder="A small thing counts. Maybe paying bills felt easier."
          />
        </label>
      </details>
      <ShareNote />
      <div className="form-actions">
        <button
          className="button primary"
          value="share"
          disabled={busy || draft.conflict || topicDraft.conflict}
        >
          Share my check-in
          <ArrowRight size={17} />
        </button>
        <button
          className="text-button"
          value="private"
          disabled={busy || draft.conflict || topicDraft.conflict}
        >
          Save privately
        </button>
      </div>
      <DraftStatus
        saved={draft.saved && topicDraft.saved}
        conflict={draft.conflict || topicDraft.conflict}
        onReset={() => {
          draft.reset();
          topicDraft.reset();
        }}
      />
    </form>
  );
}
function WeeklyAction({
  state,
  item,
  busy,
  act,
  onError,
}: {
  state: SpaceState;
  item: ReviewView;
  busy: boolean;
  act: SpaceAction;
  onError: (s: string) => void;
}) {
  const [editing, setEditing] = useState(false),
    a = item.action;
  const draft = useSavedDraft(
    "fm:weekly-action:" + item.id + ":" + state.role,
    {
      text: a?.text || "",
      owner: a?.owner || "both",
      due: a?.due || afterDays(7),
    },
  );
  const ledger = ledgerFor(state),
    overdue = ledger.rows.find((x) => x.overdue),
    pending = state.householdDecisions.find((x) => x.status === "open"),
    saving = state.householdDecisions.find(
      (x) => x.status === "agreed" && x.kind === "purchase",
    );
  const currentRecord = state.months.find((x) => x.period === currentMonth()),
    currentActual = currentRecord ? monthTotals(currentRecord) : null,
    over = currentActual?.categories.find((x) => x.difference > 0);
  const suggestion =
    currentRecord?.status === "agreed" && monthOutstanding(currentRecord) !== 0
      ? "Check the outstanding reimbursement from our confirmed month."
      : over
        ? `Review our ${over.label.toLowerCase()} spending against the monthly plan and decide whether to adjust it.`
        : overdue
          ? `Review the missed savings date for “${overdue.title}” and agree on a new timeline.`
          : pending
            ? `Compare the options for “${pending.title}” and choose our next step.`
            : saving
              ? `Check what we have each set aside for “${saving.title}” and update our progress.`
              : "";
  if (editing || !a)
    return (
      <form
        className="surface weekly-action"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const result = await act("reviewAction", {
              id: item.id,
              revision: item.revision,
              nextAction: draft.value,
            });
            if (result) {
              draft.reset(draft.value);
              setEditing(false);
            }
          } catch (error) {
            onError((error as Error).message);
          }
        }}
      >
        <p className="overline">ONE SMALL THING TO CARRY FORWARD</p>
        <h2>What will you do before next week?</h2>
        {suggestion && (
          <div className="weekly-suggestion">
            <span className="overline">FROM YOUR CURRENT PLANS</span>
            <p>{suggestion}</p>
            <button
              type="button"
              className="text-button"
              disabled={draft.conflict}
              onClick={() => draft.change({ text: suggestion, owner: "both" })}
            >
              Use as a starting point
              <ArrowRight size={15} />
            </button>
          </div>
        )}
        <label>
          Your next step
          <input
            required
            maxLength={500}
            value={draft.value.text}
            onChange={(e) => draft.change({ text: e.target.value })}
            placeholder="Compare two cheaper sofa options together"
          />
        </label>
        <div className="form-grid">
          <label>
            Who will take it on?
            <select
              value={draft.value.owner}
              onChange={(e) =>
                draft.change({ owner: e.target.value as "A" | "B" | "both" })
              }
            >
              <option value="both">Both of us</option>
              {(["A", "B"] as const).map((side) => (
                <option key={side} value={side}>
                  {sideName(state, side)}
                </option>
              ))}
            </select>
          </label>
          <label>
            By when?
            <input
              type="date"
              required
              value={draft.value.due}
              onChange={(e) => draft.change({ due: e.target.value })}
            />
          </label>
        </div>
        <button className="button primary" disabled={busy || draft.conflict}>
          Propose our next step
          <ArrowRight size={17} />
        </button>
        {a && (
          <button
            type="button"
            className="text-button"
            onClick={() => setEditing(false)}
          >
            Keep the saved step
          </button>
        )}
        <DraftStatus {...draft} onReset={() => draft.reset()} />
      </form>
    );
  if (!a) return null;
  return (
    <section className="surface weekly-action">
      <p className="overline">
        {a.completed ? "FOLLOWED THROUGH, TOGETHER" : "YOUR NEXT SMALL STEP"}
      </p>
      <span
        className={
          "status-tag " + (a.approvals.A && a.approvals.B ? "green" : "")
        }
      >
        {a.completed
          ? "Completed"
          : a.approvals.A && a.approvals.B
            ? "Agreed together"
            : "Waiting for both confirmations"}
      </span>
      <h2>{a.text}</h2>
      <p>
        {sideName(state, a.owner)} · By {fullDate(a.due)}
      </p>
      <Approval state={state} approvals={a.approvals} />
      {a.completed ? (
        <p className="accepted-message">
          <CheckCheck size={18} />
          Marked complete. Keep the conversation going next week.
        </p>
      ) : (
        <div className="form-actions">
          {!a.approvals[state.role] ? (
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                act("approveReview", { id: item.id, revision: item.revision })
              }
            >
              <Check size={17} />
              This works for me
            </button>
          ) : a.approvals.A && a.approvals.B ? (
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                act("completeReview", { id: item.id, revision: item.revision })
              }
            >
              <CheckCheck size={17} />
              We did this
            </button>
          ) : (
            <span className="small-text muted">
              Waiting for your partner to confirm.
            </span>
          )}
          <button className="text-button" onClick={() => setEditing(true)}>
            Change the next step
          </button>
        </div>
      )}
    </section>
  );
}
