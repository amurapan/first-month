"use client";
import { useEffect, useRef, useState } from "react";

const format = (cents: number, decimals: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(cents / 100);

/** Decorative interpolation only. Assistive technology and print always get the exact result. */
export function AnimatedMoney({
  value,
  enter = false,
}: {
  value: number;
  enter?: boolean;
}) {
  const [shown, setShown] = useState(enter ? 0 : value),
    [moving, setMoving] = useState(false),
    current = useRef(value),
    first = useRef(true),
    root = useRef<HTMLSpanElement>(null);
  const decimals = value % 100 ? 2 : 0;
  const label = format(value, decimals);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const initial = first.current;
    first.current = false;
    let frame = 0,
      observer: IntersectionObserver | undefined;
    let stopped = false;
    const finish = () => {
      stopped = true;
      cancelAnimationFrame(frame);
      current.current = value;
      setShown(value);
      setMoving(false);
    };
    const begin = () => {
      if (stopped || media.matches) return finish();
      const from = initial && enter ? 0 : current.current;
      if (from === value) return finish();
      const duration = initial ? 760 : 420,
        start = performance.now();
      setMoving(true);
      const tick = (now: number) => {
        if (stopped) return;
        const t = Math.min(1, (now - start) / duration);
        current.current = Math.round(
          from + (value - from) * (1 - (1 - t) ** 3),
        );
        setShown(current.current);
        if (t < 1) frame = requestAnimationFrame(tick);
        else finish();
      };
      frame = requestAnimationFrame(tick);
    };
    if (media.matches) finish();
    else if (initial && enter && root.current) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            observer?.disconnect();
            begin();
          }
        },
        { threshold: 0.5 },
      );
      observer.observe(root.current);
    } else begin();
    const onPreference = () => {
      if (media.matches) finish();
    };
    media.addEventListener("change", onPreference);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      media.removeEventListener("change", onPreference);
    };
  }, [value, enter]);
  return (
    <span className="animated-money" ref={root} data-moving={moving}>
      <span className="money-exact">{label}</span>
      <span className="money-visual" aria-hidden="true">
        {format(shown, decimals)}
      </span>
    </span>
  );
}

export function PlanAssembly({
  compact = false,
  kind = "plan",
  onSkip,
}: {
  compact?: boolean;
  kind?: "plan" | "guide" | "save";
  onSkip?: () => void;
}) {
  return (
    <section
      className={"plan-assembly " + (compact ? "compact" : "")}
      data-kind={kind}
      aria-label={
        kind === "guide" ? "Preparing your conversation" : "Preparing your plan"
      }
    >
      <div className="assembly-art" aria-hidden="true">
        <svg viewBox="0 0 320 210" fill="none">
          <ellipse
            className="assembly-shadow"
            cx="160"
            cy="178"
            rx="77"
            ry="8"
            fill="#292724"
            opacity=".08"
          />
          <path
            className="assembly-spark one"
            d="M58 52v12m-6-6h12"
            stroke="#bd654c"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            className="assembly-spark two"
            d="M267 117v12m-6-6h12"
            stroke="#9b8348"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <g className="assembly-side side-a">
            <rect x="77" y="60" width="68" height="88" rx="23" fill="#ee977e" />
            <path
              d="M98 89v4m24-4v4m-22 15q10 8 20 0"
              stroke="#54352c"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
          <g className="assembly-side side-b">
            <rect
              x="175"
              y="45"
              width="68"
              height="88"
              rx="23"
              fill="#eacb76"
            />
            <path
              d="M196 75v4m24-4v4m-22 15q10 8 20 0"
              stroke="#64502a"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
          <g className="assembly-sheet">
            <rect
              x="111"
              y="48"
              width="98"
              height="123"
              rx="15"
              fill="#fffdf8"
              stroke="#d9d2c7"
            />
            <path
              d="M131 75h35m-35 14h58"
              stroke="#c8c0b4"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <rect
              x="130"
              y="109"
              width="24"
              height="41"
              rx="7"
              fill="#ee977e"
            />
            <rect x="163" y="99" width="26" height="51" rx="7" fill="#eacb76" />
          </g>
          <g className="assembly-check">
            <circle cx="209" cy="56" r="18" fill="#292724" />
            <path
              d="m201 56 5 5 10-11"
              stroke="#fffaf0"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>
      <div className="assembly-copy" role="status">
        <p className="eyebrow">A LITTLE MORE TOGETHER</p>
        <h2>
          {kind === "guide"
            ? "Making room for both voices."
            : kind === "save"
              ? "A home for your plan."
              : "Your starting point, taking shape."}
        </h2>
        <p>
          {kind === "guide"
            ? "Preparing questions from the answers you both shared."
            : kind === "save"
              ? "Saving your draft and opening your private space."
              : "Your numbers. Two perspectives. A little clarity."}
        </p>
      </div>
      {onSkip && (
        <button
          type="button"
          className="text-button assembly-skip"
          onClick={onSkip}
        >
          Show my comparison <span aria-hidden="true">→</span>
        </button>
      )}
    </section>
  );
}
