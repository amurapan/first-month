"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  LockKeyhole,
  Plus,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { HomeScene } from "@/components/home-scene";
import { money } from "@/components/quick-comparison";
import { calculateBudget } from "@/lib/domain/budget.js";
import { decisionOptions } from "@/lib/domain/planning.js";
import type { HouseholdDecision } from "@/lib/life-types";

const illustrationBudget = calculateBudget({
  sharedCents: 340000,
  incomeCents: [600000, 300000],
  personalCommitmentsCents: [90000, 30000],
  minimumRemainingCents: [200000, 120000],
  method: "proportional",
  customContributionsCents: undefined,
});
const fixture: HouseholdDecision = {
  id: "illustration",
  title: "A sofa for our living room",
  context: "",
  kind: "purchase",
  amount: 90000,
  creator: "A",
  status: "open",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  answers: {
    A: { limit: 60000, timing: "now", note: "", shared: true, updatedAt: "" },
    B: { limit: 25000, timing: "save", note: "", shared: true, updatedAt: "" },
  },
  proposal: null,
  resolutions: [],
};
export default function Home() {
  const [ready, setReady] = useState(false);
  const [recent, setRecent] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [price, setPrice] = useState(900),
    [choice, setChoice] = useState("save");
  useEffect(() => {
    setReady(true);
    try {
      setRecent(localStorage.getItem("fm:recent") || "");
    } catch {}
  }, []);
  const compared = useMemo(
    () =>
      decisionOptions({
        item: { ...fixture, amount: price * 100 },
        incomes: [600000, 300000],
        baseRemaining: illustrationBudget.remainingCents,
        refined: [true, true],
        reserves: [200000, 120000],
        limits: [60000, 25000],
        decisions: [],
        expenseIds: [],
      }),
    [price],
  );
  const selected =
    compared.options.find((x) => x.id === choice) || compared.options[0];
  async function demo() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Alex",
          partnerName: "Jordan",
          moveDate: new Date().toISOString().slice(0, 10),
          demo: true,
        }),
      });
      const data = (await r.json()) as {
        id: string;
        token: string;
        demoPartnerToken: string;
        error?: string;
      };
      if (!r.ok) throw new Error(data.error || "Please try again.");
      try {
        localStorage.setItem(
          "fm:demo:" + data.id,
          JSON.stringify({ A: data.token, B: data.demoPartnerToken }),
        );
      } catch {}
      const w = await fetch("/api/rooms/" + data.id + "/workspace", {
        headers: { Authorization: "Bearer " + data.token },
      });
      const space = (await w.json()) as {
        householdDecisions?: { id: string; status: string }[];
      };
      const decision = space.householdDecisions?.find(
        (x) => x.status === "open",
      );
      location.assign(
        "/space/" +
          data.id +
          (decision ? "?tab=decisions&decision=" + decision.id : "") +
          "#key=" +
          data.token,
      );
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="new-landing">
      <header className="new-nav">
        <Brand />
        <nav>
          <a href="#how">The idea</a>
          <a href={recent || "/spaces"}>
            {recent ? "Our home" : "Open our space"}
          </a>
          <a className="button primary" href="/start">
            Get started
            <ArrowUpRight size={17} />
          </a>
        </nav>
      </header>
      <main>
        <section className="new-hero">
          <div className="new-hero-copy">
            <p className="eyebrow">
              <i />
              LIFE TOGETHER. MONEY INCLUDED.
            </p>
            <h1>
              Big plans.
              <br />
              <span>Same team.</span>
            </h1>
            <p className="new-intro">
              A sofa. A shared bill. A trip you keep putting off. <br />
              Turn both points of view into a plan you can actually agree on.
            </p>
            <div className="new-hero-actions">
              <a className="button primary large" href="/start">
                Start with your numbers
                <ArrowUpRight size={20} />
              </a>
              <button
                className="text-button"
                disabled={busy || !ready}
                onClick={demo}
              >
                {busy ? "Opening your example…" : "Take a look inside"}
                <ArrowRight size={18} />
              </button>
            </div>
            <div className="new-assurances">
              <span>
                <Check size={13} />
                Free to use
              </span>
              <span>
                <Check size={13} />
                No bank connection
              </span>
              <span>
                <Check size={13} />
                Start on your own
              </span>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="hero-scenario">
            <div className="scenario-topline">
              <span>
                <i /> A LITTLE LOOK AT WHAT’S POSSIBLE
              </span>
              <span>Interactive example</span>
            </div>
            <div className="scenario-scene">
              <HomeScene
                phase={
                  selected.id === "now" ? 0 : selected.id === "save" ? 1 : 2
                }
              />
              <div className="scene-note note-a">
                <span className="person-orb">A</span>
                <div>
                  <strong>Alex</strong>
                  <span>“I’d love to get it soon.”</span>
                </div>
              </div>
              <div className="scene-note note-b">
                <span className="person-orb">J</span>
                <div>
                  <strong>Jordan</strong>
                  <span>“Can we save for it first?”</span>
                </div>
              </div>
              <span className="scene-price">
                The sofa <strong>{money(price * 100)}</strong>
              </span>
            </div>
            <div className="scenario-console">
              <div className="scenario-price-control">
                <label htmlFor="sample-price">Change the price</label>
                <input
                  disabled={!ready}
                  id="sample-price"
                  type="range"
                  min="600"
                  max="1800"
                  step="50"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                />
                <output htmlFor="sample-price">{money(price * 100)}</output>
              </div>
              <div
                className="scenario-tabs"
                role="group"
                aria-label="Explore the example"
              >
                {compared.options.map((o) => (
                  <button
                    disabled={!ready}
                    key={o.id}
                    aria-pressed={selected.id === o.id}
                    onClick={() => setChoice(o.id)}
                  >
                    {o.id === "now"
                      ? "This month"
                      : o.id === "save"
                        ? "Save first"
                        : o.id === "lower"
                          ? "Lower budget"
                          : "Another split"}
                  </button>
                ))}
              </div>
              <div className="scenario-outcome" aria-live="polite">
                <div>
                  <span className={"scenario-state " + selected.status}>
                    {selected.status === "fits" ? (
                      <CheckCheck size={15} />
                    ) : (
                      <Plus size={15} />
                    )}{" "}
                    {selected.status === "fits"
                      ? "Within both comfort amounts"
                      : "A trade-off to discuss"}
                  </span>
                  <strong>
                    {selected.id === "save"
                      ? selected.months + " months to make room"
                      : selected.id === "lower"
                        ? money(selected.amount) + " price ceiling"
                        : selected.title}
                  </strong>
                </div>
                <div className="scenario-numbers">
                  <span>
                    <i className="person-0" />
                    Alex<strong>{money(selected.firstMonth[0])}</strong>
                  </span>
                  <span>
                    <i className="person-1" />
                    Jordan<strong>{money(selected.firstMonth[1])}</strong>
                  </span>
                </div>
              </div>
              <p className="scenario-caption">
                Fictional household · Income-based split · Amounts per person
                this month
              </p>
              <details className="example-assumptions">
                <summary>See the numbers behind this example</summary>
                <p>
                  Alex earns $6,000 and has $2,833.33 after included costs;
                  Jordan earns $3,000 and has $1,566.67. They want to keep
                  $2,000 and $1,200 respectively. Their monthly comfort amounts
                  for this purchase are $600 and $250. No other commitments are
                  included in this illustration. In your space, agreed plans are
                  included automatically.
                </p>
              </details>
            </div>
          </div>
        </section>
        <div className="new-divider">
          <span>YOUR SIDE.</span>
          <span>THEIR SIDE.</span>
          <span>A WAY FORWARD.</span>
          <ArrowRight size={25} />
        </div>
        <section className="new-story" id="how">
          <div className="story-heading">
            <p className="eyebrow">GOOD CONVERSATIONS NEED A STARTING POINT</p>
            <h2>
              You can want the same thing <br />
              and need <em>different plans.</em>
            </h2>
          </div>
          <div className="story-steps">
            <article>
              <span className="step-number">
                01<span>YOU</span>
              </span>
              <h3>A little space for your side.</h3>
              <p>
                Add what you’re considering and what feels comfortable. Save
                your answer privately until you’re ready.
              </p>
              <div className="story-detail">
                <LockKeyhole size={17} />
                <span>Your perspective stays yours.</span>
              </div>
            </article>
            <article>
              <span className="step-number">
                02<span>YOUR PARTNER</span>
              </span>
              <h3>Make room for their reality.</h3>
              <p>
                Send a private invitation. They answer separately, then both
                perspectives appear when you each choose to share.
              </p>
              <div className="story-two-voices">
                <span>A</span>
                <i>+</i>
                <span>J</span>
                <small>Two voices. Both included.</small>
              </div>
            </article>
            <article>
              <span className="step-number">
                03<span>TOGETHER</span>
              </span>
              <h3>Choose with the whole picture.</h3>
              <p>
                Compare a different timeline, price, or split. See the effect on
                both people and the plans you already agreed to.
              </p>
              <div className="story-detail">
                <CheckCheck size={20} />
                <span>One plan. Two separate yeses.</span>
              </div>
            </article>
          </div>
        </section>
        <section className="new-continuity">
          <div className="continuity-copy">
            <p className="eyebrow">THE DECISION ISN’T THE END</p>
            <h2>
              Every yes
              <br />
              has a <span>place.</span>
            </h2>
            <p>
              The trip you’re saving for still counts when you compare a new
              purchase. Your next check-in picks up from the decisions you made.
            </p>
            <button
              className="button light large"
              disabled={busy || !ready}
              onClick={demo}
            >
              Explore a sample household
              <ArrowUpRight size={19} />
            </button>
            <small>Fictional data. Switch between both partners.</small>
          </div>
          <div className="continuity-path">
            <div className="path-row">
              <span className="path-dot">
                <Check size={18} />
              </span>
              <div>
                <span>YOUR FOUNDATION</span>
                <h3>A monthly plan you both understand.</h3>
                <p>
                  Shared bills, personal room, and a contribution from each of
                  you.
                </p>
              </div>
            </div>
            <div className="path-row">
              <span className="path-dot">
                <CheckCheck size={18} />
              </span>
              <div>
                <span>YOUR NEXT DECISION</span>
                <h3>A purchase with a way forward.</h3>
                <p>
                  Clear trade-offs. Both confirmations. A savings schedule you
                  can follow.
                </p>
                <div className="path-illustration">
                  <span className="person-0" />
                  <span className="person-1" />
                  <span className="path-progress" />
                  <small>Your shared progress</small>
                </div>
              </div>
            </div>
            <div className="path-row">
              <span className="path-dot">↗</span>
              <div>
                <span>YOUR WEEKLY MOMENT</span>
                <h3>Keep what works. Change what doesn’t.</h3>
                <p>
                  Two short answers and one next step. Your agreements stay in
                  your history.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="new-faq">
          <div>
            <p className="eyebrow">A FEW THINGS TO KNOW</p>
            <h2>
              Keep your independence.
              <br />
              <span>Build something together.</span>
            </h2>
          </div>
          <div className="new-faq-list">
            {[
              [
                "Can I start on my own?",
                "Yes. Start with a short comparison using your income, a partner-income estimate if you know it, and your shared costs. Your partner adds their own answers before you agree on anything together.",
              ],
              [
                "Does the app choose what is fair?",
                "You choose together. First Month calculates the consequences of different amounts, splits, and timelines. A suggestion that fits the numbers is still a proposal, and both people confirm separately.",
              ],
              [
                "How private is our space?",
                "Each person has a private access link. Financial profiles and conversation answers appear to your partner after both people share. Save your link somewhere private; there is no account recovery without it. You can export your data, replace your link, or delete the space.",
              ],
              [
                "Is this a bank or a spending tracker?",
                "No bank connection, money transfers, or verified account balances. The comparisons use the monthly plan and savings you enter, including other agreed commitments. Update your inputs when life changes.",
              ],
              [
                "What does it cost?",
                "This release is free, with no card required or automatic charges. Optional generated conversation support has usage limits. Your calculations and saved decisions keep working without it.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <Plus size={18} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="new-final">
          <div className="final-duo">
            <span>A little more you.</span>
            <span>A little more us.</span>
          </div>
          <h2>
            Make your
            <br />
            <span>next move.</span>
          </h2>
          <a href="/start" className="button primary large">
            Find our starting point
            <ArrowUpRight size={21} />
          </a>
          <p>Three numbers to begin. The rest, together.</p>
        </section>
      </main>
      <footer className="new-footer">
        <Brand />
        <span>For the life you’re figuring out together.</span>
        <nav>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="mailto:kudomiya@proton.me">
            Get in touch
            <ArrowUpRight size={13} />
          </a>
        </nav>
      </footer>
    </div>
  );
}
