"use client";
import { AnimatedMoney } from "./motion";
import { money } from "@/lib/money";

type Person = {
  name: string;
  income: number;
  personal: number;
  reserve: number;
  refined?: boolean;
};

/** The same two outcomes in the example and the shared budget. */
export default function SplitResult({
  people,
  contributions,
  remaining,
  role,
}: {
  people: Person[];
  contributions: number[];
  remaining: number[];
  role?: "A" | "B";
}) {
  return (
    <div className="split-results" aria-live="polite" aria-atomic="true">
      {people.map((person, i) => {
        const gap = person.reserve - remaining[i];
        return (
          <article className={"split-person split-person-" + i} key={i}>
            <div className="split-person-name">
              <span className={"avatar " + (i ? "peach" : "")}>
                {person.name[0]}
              </span>
              <strong>{person.name}</strong>
              {role === (i ? "B" : "A") && <small>You</small>}
            </div>
            <p className="split-contribution-label">Contributes each month</p>
            <strong className="split-contribution">
              <AnimatedMoney value={contributions[i]} enter />
            </strong>
            <div
              className={
                "split-remaining " + (remaining[i] < 0 ? "is-short" : "")
              }
            >
              <span>
                Left after{" "}
                {person.refined === false ? "shared costs" : "included bills"}
              </span>
              <strong>
                <AnimatedMoney value={remaining[i]} enter />
              </strong>
            </div>
            {remaining[i] < 0 ? (
              <p className="split-warning">
                {money(-remaining[i])} short after the costs included here.
              </p>
            ) : person.refined !== false && gap > 0 ? (
              <p className="split-warning">
                {money(gap)} below the {money(person.reserve)}{" "}
                {role === (i ? "B" : "A") ? "you want" : "they want"} to keep.
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
