"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  LockKeyhole,
  Plus,
  ReceiptText,
  MessageCircle,
  HeartHandshake,
} from "lucide-react";
import { AnimatedMoney } from "@/components/motion";
import { Brand } from "@/components/brand";
import { HomeScene } from "@/components/home-scene";
import SplitResult from "@/components/split-result";
import { calculateBudget } from "@/lib/domain/budget.js";

const examplePeople = [
  { name: "Alex", income: 600000, personal: 0, reserve: 0, refined: false },
  { name: "Jordan", income: 300000, personal: 0, reserve: 0, refined: false },
];

export default function Home() {
  const [ready, setReady] = useState(false);
  const [recent, setRecent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(300000);
  const [method, setMethod] = useState<"equal" | "proportional">("equal");
  const result = calculateBudget({
    sharedCents: total,
    incomeCents: examplePeople.map((p) => p.income),
    method,
    customContributionsCents: undefined,
  });
  useEffect(() => {
    setReady(true);
    try {
      setRecent(localStorage.getItem("fm:recent") || "");
    } catch {}
  }, []);
  async function demo() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Alex",
          partnerName: "Jordan",
          moveDate: new Date().toISOString().slice(0, 10),
          demo: true,
        }),
      });
      const data = (await response.json()) as {
        id: string;
        token: string;
        demoPartnerToken: string;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Please try again.");
      try {
        localStorage.setItem(
          "fm:demo:" + data.id,
          JSON.stringify({ A: data.token, B: data.demoPartnerToken }),
        );
      } catch {}
      location.assign(
        "/space/" + data.id + "?tab=budget&section=2#key=" + data.token,
      );
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="new-landing friendly-landing">
      <header className="new-nav">
        <Brand />
        <nav>
          <a href="#how">How it works</a>
          <a className="return-to-space" href={recent || "/spaces"}>
            {recent ? "Open our space" : "Find our space"}
          </a>
          <a className="button primary" href="/start">
            Compare our costs <ArrowUpRight size={17} />
          </a>
        </nav>
      </header>
      <main>
        <section className="new-hero">
          <div className="new-hero-copy">
            <p className="eyebrow">
              <i /> MOVING IN. FIGURING MONEY OUT.
            </p>
            <h1>
              Shared bills.
              <br />A plan for
              <br />
              <em>both of you.</em>
            </h1>
            <p className="new-intro">
              See what you’d each pay, what you’d each have left, and choose a
              split together.
            </p>
            <div className="new-hero-actions">
              <a className="button primary large" href="/start">
                Compare our costs <ArrowUpRight size={20} />
              </a>
              <button
                className="text-button"
                disabled={busy || !ready}
                onClick={demo}
              >
                {busy ? "Opening an example…" : "Try a sample household"}{" "}
                <ArrowRight size={17} />
              </button>
            </div>
            <p className="friendly-start-note">
              Two short steps. You can start on your own.
            </p>
            <div className="new-assurances">
              <span>
                <Check size={13} />
                Free to use
              </span>
              <span>
                <Check size={13} />
                No sign-up
              </span>
              <span>
                <Check size={13} />
                No bank connection
              </span>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>
          <section
            className="landing-budget"
            aria-label="Interactive budget example"
          >
            <div className="landing-example-label">
              <span>
                <i /> TRY THE NUMBERS
              </span>
              <span>Fictional couple · USD</span>
            </div>
            <div className="landing-budget-heading">
              <h2>One home. Two incomes.</h2>
              <p>Alex takes home $6,000. Jordan takes home $3,000.</p>
            </div>
            <div className="landing-cost-control">
              <label htmlFor="sample-costs">Their shared monthly costs</label>
              <strong>
                <AnimatedMoney value={total} />
              </strong>
              <input
                id="sample-costs"
                disabled={!ready}
                type="range"
                min="1200"
                max="6000"
                step="100"
                value={total / 100}
                onChange={(e) => setTotal(Number(e.target.value) * 100)}
                aria-valuetext={"$" + total / 100 + " per month"}
              />
              <div>
                <span>$1,200</span>
                <span>Move the slider to compare</span>
                <span>$6,000</span>
              </div>
            </div>
            <div
              className="split-methods"
              role="group"
              aria-label="Example split method"
            >
              <button
                disabled={!ready}
                aria-pressed={method === "equal"}
                onClick={() => setMethod("equal")}
              >
                <span>50 / 50</span>
                <small>The same amount each</small>
              </button>
              <button
                disabled={!ready}
                aria-pressed={method === "proportional"}
                onClick={() => setMethod("proportional")}
              >
                <span>By income</span>
                <small>The same % of income</small>
              </button>
            </div>
            <SplitResult
              people={examplePeople}
              contributions={result.contributionsCents}
              remaining={result.remainingCents}
            />
            <p className="landing-example-note">
              Personal bills and savings aren’t included. Neither option decides
              what’s right for you.
            </p>
            <a href="/start" className="landing-example-link">
              Now try your own numbers <ArrowRight size={16} />
            </a>
          </section>
        </section>
        <section className="friendly-how" id="how">
          <div className="friendly-section-heading">
            <p className="eyebrow">A SMALL START. A CLEARER CONVERSATION.</p>
            <h2>
              You don’t need to have
              <br />
              <em>all the answers.</em>
            </h2>
          </div>
          <div className="friendly-steps">
            <article>
              <span className="friendly-step-number">01</span>
              <h3>Get a starting picture.</h3>
              <p>
                Add your take-home pay and shared costs. Estimate your partner’s
                income, or leave it for them.
              </p>
              <span className="friendly-step-detail">
                See a comparison before saving anything.
              </span>
            </article>
            <article>
              <span className="friendly-step-number">02</span>
              <h3>Bring in their side.</h3>
              <p>
                Send a private invitation link. They add their own numbers; you
                each choose when to share.
              </p>
              <span className="friendly-step-detail">
                <LockKeyhole size={15} /> Your estimate never becomes their
                answer.
              </span>
            </article>
            <article>
              <span className="friendly-step-number">03</span>
              <h3>Choose, then both agree.</h3>
              <p>
                Compare contributions and money left over. Save a proposal, work
                out the details, and confirm separately.
              </p>
              <span className="friendly-step-detail">
                <CheckCheck size={16} /> A saved proposal still needs two yeses.
              </span>
            </article>
          </div>
        </section>
        <section className="friendly-together">
          <div className="friendly-together-intro">
            <p className="eyebrow">AFTER YOU’VE MADE A PLAN</p>
            <h2>
              For the month
              <br />
              you actually <em>live.</em>
            </h2>
            <p>
              The groceries change. The sofa can wait. Keep your plan close as
              life happens.
            </p>
            <div className="friendly-home-scene" aria-hidden="true">
              <HomeScene />
            </div>
          </div>
          <div className="friendly-next-list">
            <article>
              <ReceiptText size={22} />
              <div>
                <span>SPENDING</span>
                <h3>Who paid for what?</h3>
                <p>
                  Record shared expenses and see what’s left to settle. Confirm
                  reimbursements together.
                </p>
              </div>
            </article>
            <article>
              <HeartHandshake size={22} />
              <div>
                <span>DECISIONS</span>
                <h3>Can we make room for it?</h3>
                <p>
                  Compare a purchase now, a smaller budget, or saving up. Keep
                  both comfort amounts in view.
                </p>
              </div>
            </article>
            <article>
              <MessageCircle size={22} />
              <div>
                <span>CHECK-IN</span>
                <h3>Is this still working for us?</h3>
                <p>
                  Share a short weekly reflection and choose one next step.
                  Revisit the plan when things change.
                </p>
              </div>
            </article>
            <button
              className="button light"
              disabled={busy || !ready}
              onClick={demo}
            >
              {busy ? "Opening an example…" : "Explore a sample household"}{" "}
              <ArrowUpRight size={17} />
            </button>
            <small>Fictional data. Try both partners’ perspectives.</small>
            {error && <p role="alert">{error}</p>}
          </div>
        </section>
        <section className="new-faq">
          <div>
            <p className="eyebrow">BEFORE YOU START</p>
            <h2>
              Your money.
              <br />
              <em>Your choices.</em>
            </h2>
          </div>
          <div className="new-faq-list">
            {[
              [
                "Can I start without my partner?",
                "Yes. You only need your take-home pay and shared monthly costs. Add a partner-income estimate if you know it, or skip it. You can explore on your own before inviting them.",
              ],
              [
                "Does First Month pick the fairest split?",
                "You choose together. The app shows the contributions and money left over for each option. It doesn’t decide what is fair for your relationship. Saving a proposal never counts as your partner’s agreement.",
              ],
              [
                "Who can see our answers?",
                "Each person has a private access link. Financial profiles appear to your partner after both people share. Shared costs and saved proposals are visible to both. Keep your link somewhere private: it is how you return, and there is no account recovery without it. You can export your data, replace your link, or delete the space.",
              ],
              [
                "Does it connect to our bank or move money?",
                "No. You enter your numbers and record payments yourself. The app calculates reimbursements; you send any money yourselves and the recipient confirms it. The spending tracker is for costs paid from personal funds, not joint accounts or shared savings pots.",
              ],
              [
                "What does it cost?",
                "This release is free. No card, subscription, or automatic charges. Optional generated conversation guides have usage limits; your calculations and saved decisions keep working without them.",
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
        <section className="friendly-final">
          <div>
            <p className="eyebrow">YOUR FIRST STEP TOGETHER</p>
            <h2>
              Start with the numbers.
              <br />
              <em>Make room for the conversation.</em>
            </h2>
          </div>
          <div>
            <a href="/start" className="button primary large">
              Compare our costs <ArrowUpRight size={20} />
            </a>
            <p>Free to use. No account needed.</p>
          </div>
        </section>
      </main>
      <footer className="new-footer">
        <Brand />
        <span>For the life you’re figuring out together.</span>
        <nav>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="mailto:kudomiya@proton.me">
            Get in touch <ArrowUpRight size={13} />
          </a>
        </nav>
      </footer>
    </div>
  );
}
