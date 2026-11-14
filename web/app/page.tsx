"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  CalendarDays,
  ChevronDown,
  House,
  LockKeyhole,
  MessageCircle,
  Scale,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { money } from "@/components/quick-comparison";
import { previewBudget } from "@/lib/domain/preview.js";
import { readDraft } from "@/lib/browser-draft";

export default function Home() {
  const [method, setMethod] = useState<"equal" | "proportional">("equal");
  const [recent, setRecent] = useState(""),
    [hasDraft, setHasDraft] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    try {
      setRecent(localStorage.getItem("fm:recent") || "");
    } catch {
      /* Start works without browser storage. */
    }
    const draft = readDraft<{ income?: string }>("fm:quick-draft:v1");
    setHasDraft(!!draft?.income);
  }, []);
  const example = previewBudget({
    incomeCents: 600000,
    partnerIncomeCents: 300000,
    sharedCents: 340000,
    method,
  });
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
      } catch {
        /* The first role still works. */
      }
      location.assign("/space/" + data.id + "#key=" + data.token);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="landing refreshed-landing">
      <header className="landing-nav">
        <Brand />
        <nav>
          <a href="#how">How it works</a>
          <a href="#questions">Questions</a>
          <a href={recent || "/spaces"}>
            {recent ? "Our home" : "Open our space"}
          </a>
          <a className="button secondary" href="/start">
            Find our split <ArrowUpRight size={16} />
          </a>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="tiny-star">✳</span> MOVING IN? LET’S TALK MONEY.
            </p>
            <h1>
              One home.
              <br />A plan for <em>two.</em>
            </h1>
            <p className="hero-description">
              Different incomes. Shared bills. A little uncertainty.
              <br />
              Find your starting split in two short steps. Then keep making the
              everyday money decisions together.
            </p>
            <div className="hero-actions">
              <a href="/start" className="button primary large">
                {hasDraft
                  ? "Continue our comparison"
                  : "Find our starting split"}
                <ArrowRight size={19} />
              </a>
              <button className="text-button" disabled={busy} onClick={demo}>
                {busy ? "Opening sample…" : "Take a look inside"}
                <ArrowUpRight size={16} />
              </button>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="hero-assurances">
              <span>
                <Check size={15} /> No account
              </span>
              <span>
                <Check size={15} /> No bank connection
              </span>
              <span>
                <Check size={15} /> Start on your own
              </span>
            </div>
            {recent && (
              <a className="return-link" href={recent}>
                Already started? Open your shared home <ArrowRight size={14} />
              </a>
            )}
          </div>
          <div className="live-example" id="example">
            <div className="example-top">
              <span>
                <House size={18} /> ONE HOME, TWO PAYCHECKS
              </span>
              <span className="pill">FICTIONAL EXAMPLE</span>
            </div>
            <h2>
              Same bills.
              <br />
              Different ways to share.
            </h2>
            <div className="example-incomes">
              <span>
                <i className="dot green" />
                Alex earns <strong>$6,000</strong>
              </span>
              <span>
                <i className="dot terracotta" />
                Jordan earns <strong>$3,000</strong>
              </span>
            </div>
            <p className="example-budget">
              Monthly shared costs <strong>$3,400</strong>
            </p>
            <div
              className="sample-toggle"
              role="group"
              aria-label="Try an example split"
            >
              <button
                aria-pressed={method === "equal"}
                onClick={() => setMethod("equal")}
              >
                50 / 50
              </button>
              <button
                aria-pressed={method === "proportional"}
                onClick={() => setMethod("proportional")}
              >
                By income
              </button>
            </div>
            <div className="example-chart" aria-hidden="true">
              <span
                style={{
                  width: (example.contributionsCents[0] / 340000) * 100 + "%",
                }}
              />
              <span
                style={{
                  width: (example.contributionsCents[1] / 340000) * 100 + "%",
                }}
              />
            </div>
            <div className="example-contributions" aria-live="polite">
              {["Alex", "Jordan"].map((name, i) => (
                <div key={name}>
                  <span>{name} contributes</span>
                  <strong>{money(example.contributionsCents[i])}</strong>
                  <small>
                    {money(example.remainingAfterSharedCents[i]!)} after this
                    contribution
                  </small>
                </div>
              ))}
            </div>
            <div className="example-insight">
              <Scale size={19} />
              <p>
                {method === "equal"
                  ? "The same dollar amount can take up very different shares of two incomes."
                  : "Here, Alex contributes twice as much because Alex earns twice as much."}
              </p>
            </div>
            <p className="example-note">
              Personal bills and savings aren’t deducted in this example.
            </p>
            <a href="/start" className="text-button">
              Now try your numbers <ArrowRight size={16} />
            </a>
          </div>
        </section>
        <section className="chapter-strip">
          <span>Talk about it before the first bill.</span>
          <p>Rent. Groceries. Independence. Room to change.</p>
          <span className="strip-star">✳</span>
        </section>
        <section className="home-conversations">
          <div className="section-heading">
            <p className="eyebrow">THE SMALL THINGS THAT BECOME BIG THINGS</p>
            <h2>
              You’re sharing a home.
              <br />
              You’re still two people.
            </h2>
          </div>
          <div className="conversation-scenarios">
            <article>
              <span className="scenario-symbol">
                <Wallet size={24} />
              </span>
              <span className="overline">DIFFERENT PAYCHECKS</span>
              <h3>
                “Can we split the rent without one of us feeling stretched?”
              </h3>
              <p>
                Compare equal and income-based contributions. See what each
                person would have left after their shared costs.
              </p>
            </article>
            <article>
              <span className="scenario-symbol peach-symbol">
                <House size={24} />
              </span>
              <span className="overline">SHARED, OR PERSONAL?</span>
              <h3>
                “Groceries are ours. What about takeout and subscriptions?”
              </h3>
              <p>
                Start with a total, then decide together what belongs in your
                shared budget and what stays personal.
              </p>
            </article>
            <article>
              <span className="scenario-symbol">
                <MessageCircle size={24} />
              </span>
              <span className="overline">A LITTLE HELP SAYING IT</span>
              <h3>
                “I want us to feel like a team. I also want room for myself.”
              </h3>
              <p>
                Add what matters to each of you. Get conversation questions
                grounded in the priorities you choose to share.
              </p>
            </article>
          </div>
        </section>
        <section className="how-section" id="how">
          <div className="section-heading">
            <p className="eyebrow">
              FROM “HOW DO WE DO THIS?” TO A STARTING PLAN
            </p>
            <h2>
              A little clarity first.
              <br />
              The details, together.
            </h2>
          </div>
          <div className="how-steps">
            <article>
              <span>01 / START ON YOUR OWN</span>
              <h3>Three numbers. Your options.</h3>
              <p>
                Your income, an estimate of your partner’s, and your shared
                costs. Compare the possibilities before you invite anyone.
              </p>
            </article>
            <article>
              <span>02 / BRING YOUR PARTNER IN</span>
              <h3>Make room for their side.</h3>
              <p>
                Send a private invitation. Your partner supplies their own
                answers. You both choose what to share.
              </p>
            </article>
            <article>
              <span>03 / MAKE IT PRACTICAL</span>
              <h3>Agree on the everyday.</h3>
              <p>
                Decide who pays, when to transfer, and when to check in. Save a
                plan you’ve both reviewed.
              </p>
            </article>
          </div>
        </section>
        <section className="life-after-plan">
          <div className="section-heading">
            <p className="eyebrow">THE PLAN IS JUST THE BEGINNING</p>
            <h2>
              Life keeps happening.
              <br />
              Keep figuring it out together.
            </h2>
            <p>
              A new sofa. A new subscription. A week that felt tighter than
              expected. Give each conversation a place to go, and a next step
              you both chose.
            </p>
          </div>
          <div className="life-feature-grid">
            <article className="life-feature decision-feature">
              <div className="life-feature-label">
                <ShoppingBag size={19} /> THE NEXT BIG PURCHASE
              </div>
              <h3>“Now, or save for it?”</h3>
              <p>
                Share your comfort limits separately. Compare the cost for each
                person, choose a timeline, and both say yes to the same option.
              </p>
              <div className="life-example-card">
                <span className="overline">ILLUSTRATIVE EXAMPLE</span>
                <h4>
                  A sofa for our living room <span>$900</span>
                </h4>
                <div className="life-example-voices">
                  <span>“I’d like it soon.”</span>
                  <span>“Could we save first?”</span>
                </div>
                <div className="life-example-result">
                  <CheckCheck size={19} />
                  <span>
                    <strong>Save over 3 months</strong>Track what each of you
                    sets aside.
                  </span>
                </div>
              </div>
            </article>
            <article className="life-feature checkin-feature">
              <div className="life-feature-label">
                <CalendarDays size={19} /> A SMALL WEEKLY RITUAL
              </div>
              <h3>“How did this week feel?”</h3>
              <p>
                Say what worked and what needs to change. Read each other’s
                answers after you both share, then agree on one small next step.
              </p>
              <div className="life-example-card">
                <span className="overline">ILLUSTRATIVE EXAMPLE</span>
                <h4>One thing we’ll do this week</h4>
                <p>Plan three dinners before buying groceries.</p>
                <div className="life-example-result">
                  <CheckCheck size={19} />
                  <span>
                    <strong>Both on board</strong>A shared action, with an owner
                    and a date.
                  </span>
                </div>
              </div>
            </article>
          </div>
          <button
            className="button secondary large"
            disabled={busy}
            onClick={demo}
          >
            {busy ? "Opening sample…" : "Explore a sample household"}
            <ArrowUpRight size={17} />
          </button>
          <p className="life-demo-note">
            Try both roles with fictional data. No setup needed.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
        <section className="plan-outcome">
          <div>
            <p className="eyebrow">MORE THAN A SPLIT</p>
            <h2>
              Leave with something
              <br />
              you can actually use.
            </h2>
            <p>
              Your monthly agreement, purchase decisions, savings progress, and
              check-ins — in one shared home. Earlier agreements stay in your
              history as life changes.
            </p>
            <a className="button primary large" href="/start">
              Start our plan <ArrowRight size={18} />
            </a>
          </div>
          <div className="outcome-paper">
            <div>
              <span className="paper-symbol">
                <House size={24} />
              </span>
              <span className="overline">YOUR FIRST MONTH</span>
            </div>
            <h3>A plan we both understand.</h3>
            <ul>
              <li>
                <Check size={17} />
                <span>
                  <strong>Who contributes what</strong>Monthly amounts and the
                  costs they cover.
                </span>
              </li>
              <li>
                <Check size={17} />
                <span>
                  <strong>How the money moves</strong>The bill payer and your
                  transfer day.
                </span>
              </li>
              <li>
                <Check size={17} />
                <span>
                  <strong>What we’ll talk about first</strong>A threshold for
                  unplanned shared purchases.
                </span>
              </li>
              <li>
                <Check size={17} />
                <span>
                  <strong>When we’ll check in</strong>A date to see what’s
                  working and what needs to change.
                </span>
              </li>
            </ul>
            <div className="outcome-approval">
              <CheckCheck size={21} />
              <span>Both people review the same version.</span>
            </div>
          </div>
        </section>
        <section className="home-faq" id="questions">
          <div className="section-heading">
            <p className="eyebrow">A FEW THINGS YOU MIGHT BE WONDERING</p>
            <h2>
              Your numbers.
              <br />
              Your pace.
            </h2>
          </div>
          <div>
            <details>
              <summary>
                Is it free to use?
                <PlusIcon />
              </summary>
              <p>
                Yes, this release is free. No card is required and there are no
                automatic charges. Conversation generation has usage limits;
                your calculations, shared decisions, and saved progress remain
                available.
              </p>
            </details>
            <details>
              <summary>
                Can I start without my partner?
                <PlusIcon />
              </summary>
              <p>
                Yes. Your first comparison uses your own inputs and, if you know
                it, an estimate of your partner’s income. It stays a preliminary
                calculation. Your partner supplies their own answers before the
                two of you confirm an agreement.
              </p>
            </details>
            <details>
              <summary>
                What if I don’t know the exact numbers?
                <PlusIcon />
              </summary>
              <p>
                Rounded estimates are fine to start. If your partner’s income is
                unknown, explore an equal split first. Add their income later to
                compare an income-based contribution.
              </p>
            </details>
            <details>
              <summary>
                Who can see my answers?
                <PlusIcon />
              </summary>
              <p>
                The initial wizard draft stays in this browser. When you keep a
                plan, it is saved behind personal access links. Your partner
                sees your income and optional personal answers only once you
                both choose to share. Shared expenses and agreement details
                belong to the shared space.
              </p>
            </details>
            <details>
              <summary>
                Can we change our minds later?
                <PlusIcon />
              </summary>
              <p>
                Yes. Update your numbers or routine and both of you review the
                new version. Your next check-in is a chance to revisit the
                arrangement, not a commitment to keep it forever.
              </p>
            </details>
          </div>
        </section>
        <section className="home-final">
          <span className="little-flower">✳</span>
          <h2>Make room for the conversation.</h2>
          <p>Start with your numbers. Build the rest together.</p>
          <a className="button primary large" href="/start">
            Find our starting split <ArrowRight size={18} />
          </a>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <span>A little more clarity for life together.</span>
        <nav aria-label="Information">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="mailto:kudomiya@proton.me">Support</a>
        </nav>
      </footer>
    </div>
  );
}
function PlusIcon() {
  return <span aria-hidden="true">+</span>;
}
