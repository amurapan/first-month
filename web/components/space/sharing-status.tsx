"use client";
import { ArrowRight, Check, Clock, LockKeyhole, Pencil } from "lucide-react";
import type { SpaceState } from "@/lib/life-types";
import { money } from "@/lib/money";
export default function SharingStatus({
  state,
  busy,
  onShare,
  onInvite,
  editLink,
  onEdit,
  context = "budget",
}: {
  state: SpaceState;
  busy: boolean;
  onShare: () => Promise<unknown>;
  onInvite: () => Promise<void>;
  editLink?: string;
  onEdit?: () => void;
  context?: "budget" | "spending";
}) {
  const waiting = state.self.shared;
  const status = (self: boolean) => {
    const p = self ? state.self : state.partner;
    return !self && !state.joined
      ? "Not joined yet"
      : !p.submitted
        ? "Income not added yet"
        : p.shared
          ? "Shared"
          : "Saved privately";
  };
  return (
    <section className="sharing-status" aria-label="Income sharing status">
      <div className="sharing-status-top">
        <span className="sharing-status-icon">
          {waiting ? <Clock size={23} /> : <LockKeyhole size={23} />}
        </span>
        <div>
          <p className="eyebrow">
            {context === "spending"
              ? "BEFORE TRACKING SHARED SPENDING"
              : "BEFORE COMPARING YOUR INCOMES"}
          </p>
          <h2>
            {!state.self.submitted
              ? "Add your income to get started."
              : !state.joined
                ? "Invite your partner to add their side."
                : waiting
                  ? `Waiting for ${state.partner.name} to share.`
                  : "Your income is saved. Choose when to share."}
          </h2>
          <p>
            {!state.self.submitted
              ? "Add your side once in Our budget. Those details carry across your space, and you decide when to share them."
              : waiting
                ? "You’ve already shared your side. There’s no form to fill in again; this page will update when your partner is ready."
                : "You don’t need to enter your numbers again. Your saved profile becomes visible to each other only after you both share."}
          </p>
        </div>
      </div>
      <div className="sharing-status-people">
        {[state.self, state.partner].map((person, i) => (
          <div key={i}>
            <span className={"person-orb person-" + i}>{person.name[0]}</span>
            <div>
              <strong>{i === 0 ? "You" : person.name}</strong>
              <small>{status(i === 0)}</small>
            </div>
            {person.shared ? <Check size={17} /> : <LockKeyhole size={15} />}
          </div>
        ))}
      </div>
      {!waiting && state.self.submitted && (
        <div className="sharing-saved">
          <div>
            <span>Your saved take-home income</span>
            <strong>
              {money(state.self.income)}
              <small> / month</small>
            </strong>
          </div>
          <p>
            Sharing also includes any personal bills, saving preference and
            notes you saved. It does not confirm a split.
          </p>
        </div>
      )}
      <div className="sharing-status-actions">
        {!state.self.submitted ? (
          onEdit ? (
            <button className="button primary" onClick={onEdit}>
              Add my details <ArrowRight size={16} />
            </button>
          ) : (
            <a className="button primary" href={editLink}>
              Add my details <ArrowRight size={16} />
            </a>
          )
        ) : !state.joined ? (
          <button className="button primary" disabled={busy} onClick={onInvite}>
            Invite my partner <ArrowRight size={16} />
          </button>
        ) : !waiting ? (
          <button className="button primary" disabled={busy} onClick={onShare}>
            {busy ? "Saving…" : "Share my saved details"}
            <ArrowRight size={16} />
          </button>
        ) : null}
        {state.self.submitted &&
          (onEdit ? (
            <button className="text-button" onClick={onEdit}>
              <Pencil size={14} />
              Edit my details
            </button>
          ) : editLink ? (
            <a className="text-button" href={editLink}>
              <Pencil size={14} />
              View my saved details
            </a>
          ) : null)}
      </div>
      {context === "spending" && (
        <p className="sharing-unlock">
          Then you can add a bill, record who paid, and see the balance between
          you.
        </p>
      )}
    </section>
  );
}
