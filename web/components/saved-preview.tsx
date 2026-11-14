"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  LockKeyhole,
  Pencil,
  Users,
} from "lucide-react";
import QuickComparison, {
  money,
  type QuickMethod,
} from "@/components/quick-comparison";
import { inputCents } from "@/lib/domain/preview.js";

type Props = {
  income: number;
  total: number;
  names: [string, string];
  estimate: { partnerIncome: number | null; method: QuickMethod };
  busy: boolean;
  joined: boolean;
  shared: boolean;
  onSave: (estimate: {
    partnerIncome: number | null;
    method: QuickMethod;
  }) => Promise<unknown>;
  onInvite: () => Promise<void>;
  onProfile: () => void;
  onExpenses: () => void;
  onError: (message: string) => void;
};
export default function SavedPreview({
  income,
  total,
  names,
  estimate,
  busy,
  joined,
  shared,
  onSave,
  onInvite,
  onProfile,
  onExpenses,
  onError,
}: Props) {
  const [partner, setPartner] = useState(
      estimate.partnerIncome === null
        ? ""
        : String(estimate.partnerIncome / 100),
    ),
    [unknown, setUnknown] = useState(estimate.partnerIncome === null);
  let partnerIncome = estimate.partnerIncome;
  try {
    partnerIncome = unknown ? null : inputCents(partner);
  } catch {
    /* Keep the saved comparison while the input is incomplete. */
  }
  async function save(method: QuickMethod) {
    if (busy) return;
    try {
      const value = unknown ? null : inputCents(partner);
      await onSave({
        partnerIncome: value,
        method:
          method === "proportional" && (value === null || income + value === 0)
            ? "equal"
            : method,
      });
    } catch (e) {
      onError((e as Error).message);
    }
  }
  return (
    <section className="saved-preview">
      <div className="estimate-banner">
        <LockKeyhole size={18} />
        <div>
          <strong>Your preliminary comparison</strong>
          <p>
            Your partner’s income here is your estimate. It will be replaced
            only when you both share your own answers.
          </p>
        </div>
      </div>
      <div className="wizard-result-summary">
        <span>
          Shared monthly costs<strong>{money(total)}</strong>
        </span>
        <button className="text-button" onClick={onExpenses}>
          <Pencil size={14} /> Edit costs
        </button>
      </div>
      <QuickComparison
        busy={busy}
        income={income}
        partnerIncome={partnerIncome}
        total={total}
        method={estimate.method}
        onMethod={(method) => {
          void save(method);
        }}
        names={names}
      />
      <details className="estimate-edit">
        <summary>Edit your income assumptions</summary>
        <div className="estimate-edit-grid">
          <div>
            <span>Your saved income</span>
            <strong>{money(income)}</strong>
            <button className="text-button" onClick={onProfile}>
              <Pencil size={14} /> Edit your side
            </button>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save(estimate.method);
            }}
          >
            <label>
              Estimated partner income
              <span className="money-input">
                <span>$</span>
                <input
                  aria-label="Estimated partner income"
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.01"
                  inputMode="decimal"
                  disabled={unknown}
                  value={partner}
                  onChange={(e) => setPartner(e.target.value)}
                  required={!unknown}
                />
              </span>
            </label>
            <label className="unknown-income">
              <input
                type="checkbox"
                checked={unknown}
                onChange={(e) => setUnknown(e.target.checked)}
              />{" "}
              I don’t know yet
            </label>
            <button className="button secondary" disabled={busy}>
              <Check size={15} /> Save estimate
            </button>
          </form>
        </div>
      </details>
      <div className="invite-after-result">
        <span className="section-icon">
          <Users size={24} />
        </span>
        <div>
          <p className="overline">THE NEXT STEP IS TOGETHER</p>
          <h2>
            {joined
              ? "Give your partner room to add their side."
              : "Bring your partner into the conversation."}
          </h2>
          <p>
            {joined
              ? "Your partner has joined. Once you both share, this estimate becomes a comparison of your actual answers."
              : "They’ll enter their own income and any details they want to include. Neither of you has agreed to a split yet."}
          </p>
          {!joined ? (
            <button
              className="button primary"
              disabled={busy}
              onClick={onInvite}
            >
              <Copy size={17} />
              {shared
                ? "Copy partner invitation"
                : "Share my side & copy invitation"}
            </button>
          ) : !shared ? (
            <button className="button primary" onClick={onProfile}>
              Choose what to share <ArrowRight size={17} />
            </button>
          ) : (
            <span className="invitation-status">
              <Check size={17} /> Your side is ready to share
            </span>
          )}
          <small>
            Your saved income and optional answers become visible only when both
            people choose to share.
          </small>
        </div>
      </div>
    </section>
  );
}
