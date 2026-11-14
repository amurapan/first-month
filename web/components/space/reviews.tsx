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
  Heart,
  LockKeyhole,
  Plus,
} from "lucide-react";
import type {
  ReviewAnswer,
  ReviewView,
  SpaceAction,
  SpaceState,
} from "@/lib/life-types";
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
export default function Reviews({
  state,
  busy,
  act,
  onGuide,
  onError,
  planLink,
  onMonth,
}: {
  onMonth: () => void;
  state: SpaceState;
  busy: boolean;
  act: SpaceAction;
  onGuide: (item: ReviewView) => Promise<unknown>;
  onError: (s: string) => void;
  planLink: (step?: number) => string;
}) {
  const current = state.householdReviews.find(
      (x) => x.week === state.currentWeek,
    ),
    pair = names(state),
    own = current?.answers[state.role] as ReviewAnswer | undefined;
  const month = state.months.find((x) => x.period === currentMonth()),
    actual = month ? monthTotals(month) : null,
    overCategory = actual?.categories.find((x) => x.difference > 0);
  const [editing, setEditing] = useState(!own);
  function calendar() {
    const start = afterDays(7).replaceAll("-", "");
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
        "DTSTART;VALUE=DATE:" + start,
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
          <h1>A little time for how things feel.</h1>
          <p>
            Two short answers each. A conversation that fits your week. One next
            step you both choose.
          </p>
        </div>
        <button className="button secondary" onClick={calendar}>
          <CalendarDays size={17} />
          Add weekly reminder
        </button>
      </div>
      {actual && actual.expenseCount > 0 && (
        <section className="month-review-context">
          <p className="eyebrow">SOMETHING REAL TO TALK ABOUT</p>
          <h3>
            {overCategory
              ? overCategory.label + " went above the plan."
              : "Your month is taking shape."}
          </h3>
          <p>
            {overCategory
              ? money(overCategory.actual) +
                " recorded against " +
                money(overCategory.planned) +
                " planned. Does the plan need to change, or was this an unusual week?"
              : money(actual.total) +
                " in shared costs recorded so far. Check whether anything is missing before choosing your next step."}
          </p>
          <button className="text-button" onClick={onMonth}>
            Look at this month
            <ArrowRight size={15} />
          </button>
        </section>
      )}
      {!own || editing ? (
        <ReviewForm
          key={state.currentWeek + ":" + state.role}
          state={state}
          current={current}
          busy={busy}
          act={act}
          onDone={() => setEditing(false)}
          onError={onError}
        />
      ) : (
        <section className="surface perspectives">
          <div className="section-heading">
            <div>
              <p className="overline">A MOMENT TO LISTEN</p>
              <h2>Here’s where you both are.</h2>
            </div>
            <button className="text-button" onClick={() => setEditing(true)}>
              Edit my check-in
            </button>
          </div>
          <div className="perspective-grid">
            {(["A", "B"] as const).map((side, i) => {
              const answer = current?.answers[side],
                visible = answer && "feeling" in answer;
              return (
                <article key={side}>
                  <span className={"avatar " + (i ? "peach" : "")}>
                    {pair[i][0]}
                  </span>
                  <h3>{pair[i]}</h3>
                  {visible ? (
                    <>
                      <span
                        className={
                          "status-tag " +
                          (answer.feeling === "comfortable" ? "green" : "")
                        }
                      >
                        {feeling[answer.feeling]}
                      </span>
                      <h4>What worked</h4>
                      <p>{answer.worked || "Nothing added yet."}</p>
                      <h4>What they’d change</h4>
                      <p>{answer.change || "Nothing added yet."}</p>
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
                        ? "Their check-in is saved. You’ll see it after both people share."
                        : "Their side is still to come."}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
          {!current?.bothAnswered && (
            <p className="waiting-note">
              <Clock size={16} />
              The conversation opens after both people share this check-in and
              their income.
            </p>
          )}
        </section>
      )}
      {current?.bothAnswered && (
        <>
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
          <WeeklyAction
            key={current.id}
            state={state}
            item={current}
            busy={busy}
            act={act}
            onError={onError}
          />
          <div className="review-links">
            <div>
              <h3>Something changed in your numbers?</h3>
              <p>Update your plan, then review the new version together.</p>
            </div>
            <a href={planLink(2)} className="button secondary">
              Revisit our plan
              <ArrowRight size={17} />
            </a>
          </div>
        </>
      )}
      {state.householdReviews.some((x) => x.week !== state.currentWeek) && (
        <section className="weekly-history">
          <div className="section-heading">
            <div>
              <p className="overline">YOUR WEEKS, TOGETHER</p>
              <h2>The small things you followed through on.</h2>
            </div>
          </div>
          {state.householdReviews
            .filter((x) => x.week !== state.currentWeek)
            .map((item) => (
              <details key={item.id} className="surface">
                <summary>
                  <span>Week of {fullDate(item.week)}</span>
                  <span className="status-tag">
                    {item.action?.completed
                      ? "Action completed"
                      : item.bothAnswered
                        ? "Both checked in"
                        : "A check-in started"}
                  </span>
                </summary>
                {item.bothAnswered ? (
                  (["A", "B"] as const).map((side, i) => {
                    const a = item.answers[side] as ReviewAnswer;
                    return (
                      <p key={side}>
                        <strong>
                          {pair[i]} · {feeling[a.feeling]}
                        </strong>
                        <br />
                        {a.worked}
                        <br />
                        {a.change}
                      </p>
                    );
                  })
                ) : (
                  <p>Private answers remain private.</p>
                )}
                {item.action && (
                  <p>
                    <strong>Your next step:</strong> {item.action.text} ·{" "}
                    {sideName(state, item.action.owner)} ·{" "}
                    {fullDate(item.action.due)}
                  </p>
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
            answer: { ...draft.value, shared },
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
      <p className="overline">YOUR SIDE OF THIS WEEK</p>
      <h2>How has money felt?</h2>
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
        What worked well?
        <textarea
          rows={2}
          maxLength={1200}
          value={draft.value.worked}
          onChange={(e) => draft.change({ worked: e.target.value })}
          placeholder="A small thing counts. Maybe paying bills felt easier, or you talked before a purchase."
        />
      </label>
      <label>
        What would you like to change?
        <textarea
          rows={2}
          maxLength={1200}
          value={draft.value.change}
          onChange={(e) => draft.change({ change: e.target.value })}
          placeholder="Something that surprised you, felt difficult, or needs a fresh conversation."
        />
      </label>
      <ShareNote />
      <div className="form-actions">
        <button
          className="button primary"
          value="share"
          disabled={busy || draft.conflict}
        >
          Share my check-in
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
  const [editing, setEditing] = useState(!item.action),
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
  if (editing)
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
        <DraftStatus {...draft} onReset={() => draft.reset()} />
      </form>
    );
  if (!a) return null;
  return (
    <section className="surface weekly-action">
      <p className="overline">
        {a.completed ? "FOLLOWED THROUGH, TOGETHER" : "YOUR NEXT SMALL STEP"}
      </p>
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
