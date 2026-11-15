"use client";
import { useEffect, useRef } from "react";
import { Check } from "lucide-react";

export function ConversationSteps({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  const ref = useRef<HTMLOListElement>(null);
  const previous = useRef(current);
  useEffect(() => {
    if (previous.current !== current) {
      ref.current?.focus({ preventScroll: true });
      ref.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
      previous.current = current;
    }
  }, [current]);
  return (
    <ol
      className="conversation-steps"
      aria-label="Conversation progress"
      tabIndex={-1}
      ref={ref}
    >
      {steps.map((label, index) => (
        <li
          key={label}
          aria-current={index === current ? "step" : undefined}
          data-done={index < current}
        >
          <span aria-hidden="true">
            {index < current ? <Check size={14} /> : index + 1}
          </span>
          <strong>{label}</strong>
        </li>
      ))}
    </ol>
  );
}

export function WaitingForPartner({
  name,
  privateAnswer,
  busy,
  onShare,
  onInvite,
}: {
  name: string;
  privateAnswer: boolean;
  busy: boolean;
  onShare: () => void;
  onInvite: () => void;
}) {
  return (
    <section className="conversation-wait surface" aria-label="Next step">
      <div>
        <p className="overline">
          {privateAnswer ? "SAVED ONLY FOR YOU" : "YOUR PART IS DONE"}
        </p>
        <h2>
          {privateAnswer
            ? "Ready to share your side?"
            : `Next, a little space for ${name}.`}
        </h2>
        <p>
          {privateAnswer
            ? "Your answer stays private until you choose to share. Both answers appear together."
            : "Your answer is saved. You can leave and return using your private link when your partner has shared theirs."}
        </p>
      </div>
      <button
        className="button primary"
        disabled={busy}
        onClick={privateAnswer ? onShare : onInvite}
      >
        {privateAnswer ? "Share my saved answer" : "Invite my partner"}
      </button>
    </section>
  );
}
