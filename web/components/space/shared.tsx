"use client";
import { PlanAssembly } from "@/components/motion";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, LockKeyhole, Sparkles } from "lucide-react";
import { readDraft, writeDraft, clearDraft } from "@/lib/browser-draft";
import type { Role } from "@/lib/room";
import type { SpaceState } from "@/lib/life-types";
export { money } from "@/components/quick-comparison";
export const fullDate = (value: string) =>
  new Date(value.slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export const today = () => new Date().toISOString().slice(0, 10);
export const afterDays = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
export const names = (state: SpaceState): [string, string] =>
  state.role === "A"
    ? [state.self.name, state.partner.name]
    : [state.partner.name, state.self.name];
export const sideName = (state: SpaceState, side: Role | "both") =>
  side === "both" ? "Both of you" : names(state)[side === "A" ? 0 : 1];
export function downloadFile(
  filename: string,
  text: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function useSavedDraft<T extends Record<string, unknown>>(
  key: string,
  initial: T,
) {
  const initialText = JSON.stringify(initial);
  const stored = useRef(readDraft<{ base: string; value: T }>(key)).current;
  const valid =
    stored &&
    typeof stored.base === "string" &&
    stored.value &&
    Object.keys(initial).every(
      (k) => typeof stored.value[k] === typeof initial[k],
    );
  const base = useRef(valid ? stored.base : initialText);
  const [value, setValue] = useState<T>(valid ? stored.value : initial);
  // Keep an unfinished local answer even when the server changed while the
  // tab was closed. Ask before replacing it with the latest saved answer.
  const [conflict, setConflict] = useState(
      !!valid &&
        stored.base !== initialText &&
        JSON.stringify(stored.value) !== initialText,
    ),
    [saved, setSaved] = useState(true);
  useEffect(() => {
    if (initialText !== base.current) {
      if (
        JSON.stringify(value) === base.current ||
        JSON.stringify(value) === initialText
      ) {
        base.current = initialText;
        setValue(initial);
        setConflict(false);
      } else setConflict(true);
    }
  }, [initialText]);
  useEffect(() => {
    setSaved(writeDraft(key, { base: base.current, value }));
  }, [key, value]);
  function reset(next: T = initial) {
    base.current = JSON.stringify(next);
    setValue(next);
    setConflict(false);
    clearDraft(key);
  }
  return {
    value,
    change: (patch: Partial<T>) => setValue((v) => ({ ...v, ...patch })),
    reset,
    conflict,
    saved,
  };
}
export function DraftStatus({
  saved,
  conflict,
  onReset,
}: {
  saved: boolean;
  conflict: boolean;
  onReset: () => void;
}) {
  return conflict ? (
    <div className="notice warning">
      Your saved answer changed on another device.{" "}
      <button className="text-button" onClick={onReset} type="button">
        Load the latest answer
      </button>
    </div>
  ) : (
    <p className="draft-status">
      <LockKeyhole size={13} />
      {saved
        ? "Your unfinished answer is saved in this browser."
        : "Browser storage is unavailable. Keep this page open until you save."}
    </p>
  );
}
export function MoneyInput({
  label,
  value,
  onChange,
  optional = false,
  disabled = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label>
      {label}
      {optional && <span className="optional"> Optional</span>}
      <span className="money-input">
        <span>$</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          max="1000000"
          step="0.01"
          required={!optional && !disabled}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
      </span>
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function ShareNote() {
  return (
    <p className="consent-note">
      <LockKeyhole size={15} /> Your partner can read this answer after you both
      share. You can save privately first.
    </p>
  );
}
export function GuideCard({
  text,
  busy,
  onGenerate,
  disabled = false,
  label = "Prepare our conversation",
}: {
  text: string | null;
  busy: boolean;
  onGenerate: () => Promise<unknown>;
  disabled?: boolean;
  label?: string;
}) {
  const [generating, setGenerating] = useState(false);
  return (
    <section className="space-guide">
      <div>
        <span className="overline">
          <Sparkles size={15} /> A LITTLE HELP FINDING THE WORDS
        </span>
        <h3>Make room for both sides.</h3>
        <p>
          Turn the answers you both shared into three specific questions and a
          starting sentence. Sent to Groq only when you choose this.
        </p>
      </div>
      {text ? (
        <div className="space-guide-output">
          {text.split(/\n\s*\n/).map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
          <small>
            Generated conversation support. Keep what fits; change what doesn’t.
          </small>
        </div>
      ) : (
        <button
          className="button secondary"
          disabled={busy || disabled}
          onClick={async () => {
            setGenerating(true);
            try {
              await onGenerate();
            } finally {
              setGenerating(false);
            }
          }}
        >
          {busy ? "Preparing your conversation…" : label}
          <ArrowRight size={16} />
        </button>
      )}
      {generating && <PlanAssembly compact kind="guide" />}
    </section>
  );
}
export function Approval({
  state,
  approvals,
}: {
  state: SpaceState;
  approvals: Record<Role, string | boolean>;
}) {
  return (
    <div className="approval-pair">
      {(["A", "B"] as const).map((side, i) => (
        <div key={side}>
          <span className={"avatar " + (i ? "peach" : "")}>
            {sideName(state, side)[0]}
          </span>
          <div>
            <strong>{sideName(state, side)}</strong>
            <small>
              {approvals[side] === true || approvals[side] === "accepted" ? (
                <>
                  <Check size={13} /> Confirmed
                </>
              ) : approvals[side] === "changes" ? (
                "Wants a change"
              ) : (
                "Hasn’t confirmed yet"
              )}
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}
