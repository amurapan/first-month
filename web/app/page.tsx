"use client";
import { useState, useEffect } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  LockKeyhole,
  Sparkles,
  House,
  ChevronRight,
} from "lucide-react";

export function Brand() {
  return (
    <a className="brand" href="/">
      <span className="brand-mark">
        <i />
        <i />
      </span>
      <span>
        first month<span className="brand-dot">.</span>
      </span>
    </a>
  );
}
export default function Home() {
  const [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [recent, setRecent] = useState("");
  useEffect(() => {
    setRecent(localStorage.getItem("fm:recent") || "");
  }, []);
  async function start(event?: React.FormEvent<HTMLFormElement>, demo = false) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    const fields = event ? new FormData(event.currentTarget) : null;
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: demo ? "Alex" : fields?.get("name"),
          partnerName: demo ? "Jordan" : fields?.get("partnerName"),
          moveDate: demo
            ? new Date().toISOString().slice(0, 10)
            : fields?.get("moveDate"),
          demo,
        }),
      });
      const data = (await response.json()) as {
        id: string;
        token: string;
        invite: string;
        demoPartnerToken?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error);
      localStorage.setItem("fm:invite:" + data.id, data.invite);
      if (data.demoPartnerToken)
        localStorage.setItem(
          "fm:demo:" + data.id,
          JSON.stringify({ A: data.token, B: data.demoPartnerToken }),
        );
      const link = "/plan/" + data.id + "#key=" + data.token;
      localStorage.setItem("fm:recent", link);
      location.assign(link);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please try again.");
      setBusy(false);
    }
  }
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <nav>
          <a href="#how">How it works</a>
          {recent && <a href={recent}>Your saved plan</a>}
          <button className="text-button" onClick={() => setCreating(true)}>
            Make your plan <ArrowUpRight size={17} />
          </button>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="tiny-star">✳</span> A NEW CHAPTER, ON THE SAME
              PAGE
            </div>
            <h1>
              One home.
              <br />A plan for <em>two.</em>
            </h1>
            <p className="hero-description">
              Moving in together? Decide who pays what, what stays yours, and
              when to check in. Leave with a monthly plan you both agree to.
            </p>
            <div className="hero-actions">
              <button
                className="button primary large"
                onClick={() => setCreating(true)}
              >
                Plan our first month <ArrowRight size={19} />
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => start(undefined, true)}
              >
                Try an example <ArrowUpRight size={17} />
              </button>
            </div>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="hero-assurances">
              <span>
                <Check size={15} /> No bank connection
              </span>
              <span>
                <Check size={15} /> No account needed
              </span>
              <span>
                <Check size={15} /> Free to try
              </span>
            </div>
            <div className="hero-outcome">
              <span className="avatar-stack">
                <i>A</i>
                <i>J</i>
              </span>
              <p>
                Your own answers. A side-by-side comparison.
                <br />
                <strong>One plan you can both say yes to.</strong>
              </p>
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="Illustrative shared spending plan"
          >
            <span className="art-caption">
              A little clarity. A lot more us.
            </span>
            <div className="paper-back" />
            <div className="plan-paper">
              <div className="paper-top">
                <span className="paper-symbol">
                  <House size={22} />
                </span>
                <span className="pill small">A SAMPLE PLAN</span>
              </div>
              <p className="overline">OUR FIRST MONTH</p>
              <h2>Alex & Jordan</h2>
              <p className="muted small-text">
                Different incomes. A shared starting point.
              </p>
              <div className="sample-total">
                <span>Our shared expenses</span>
                <strong>
                  $3,400<span>/mo</span>
                </strong>
              </div>
              <div className="sample-bar">
                <span />
                <span />
              </div>
              <div className="sample-split">
                <span>
                  <i className="dot green" />
                  Alex <strong>$2,267</strong>
                </span>
                <span>
                  <i className="dot terracotta" />
                  Jordan <strong>$1,133</strong>
                </span>
              </div>
              <div className="paper-rule">
                <Check size={17} />
                <span>Groceries are shared. Personal treats are yours.</span>
              </div>
              <div className="paper-rule">
                <Check size={17} />
                <span>A quick check-in after our first month.</span>
              </div>
              <div className="paper-bottom">
                <span className="avatar-stack">
                  <i>A</i>
                  <i>J</i>
                </span>
                <span>A plan we can both say yes to.</span>
              </div>
            </div>
            <div className="art-note">
              <span>✦</span>
              <p>
                Fair feels different
                <br />
                for every couple.
              </p>
            </div>
            <div className="leaf leaf-one" />
            <div className="leaf leaf-two" />
          </div>
        </section>
        <section className="chapter-strip">
          <span>Talk about it before the first bill.</span>
          <p>Rent. Groceries. Personal space in a shared budget.</p>
          <span className="strip-star">✳</span>
        </section>
        <section className="how-section" id="how">
          <div className="section-heading">
            <p className="eyebrow">LESS GUESSING. MORE UNDERSTANDING.</p>
            <h2>
              A money conversation
              <br />
              with somewhere to start.
            </h2>
          </div>
          <div className="how-steps">
            <article>
              <span>01 / ON YOUR OWN</span>
              <h3>Start with your side.</h3>
              <p>
                What comes in, what’s already committed, and what you want to
                keep for yourself. Take a moment before you share.
              </p>
            </article>
            <article>
              <span>02 / SIDE BY SIDE</span>
              <h3>Find your balance.</h3>
              <p>
                Compare equal shares, income-based contributions, or a split you
                choose. See what each option means for both of you.
              </p>
            </article>
            <article>
              <span>03 / IN IT TOGETHER</span>
              <h3>Make it your plan.</h3>
              <p>
                Decide who pays, when to transfer, and when to check in. Both of
                you get a say before anything is agreed.
              </p>
            </article>
          </div>
        </section>
        <section className="quiet-promise">
          <LockKeyhole size={25} />
          <div>
            <h3>Your numbers. Your choice.</h3>
            <p>
              Each of you chooses when to share. No bank passwords, no score for
              your relationship, and no single “right” way to split.
            </p>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <span>A little more clarity for life together.</span>
        <span>Made for your next chapter.</span>
      </footer>
      {creating && (
        <div
          className="modal-backdrop"
          onClick={() => !busy && setCreating(false)}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="start-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close-button"
              onClick={() => setCreating(false)}
              aria-label="Close"
            >
              ×
            </button>
            <span className="section-icon">
              <House size={24} />
            </span>
            <p className="eyebrow">LET’S START SOMETHING GOOD</p>
            <h2 id="start-title">
              Your first month,
              <br />
              together.
            </h2>
            <p className="muted">
              Start with a few details. You’ll invite your partner next.
            </p>
            <form onSubmit={(event) => start(event)}>
              <div className="form-grid">
                <label>
                  Your first name
                  <input
                    autoFocus
                    name="name"
                    maxLength={60}
                    placeholder="e.g. Alex"
                    required
                  />
                </label>
                <label>
                  Your partner’s first name
                  <input
                    name="partnerName"
                    maxLength={60}
                    placeholder="e.g. Jordan"
                    required
                  />
                </label>
              </div>
              <label>
                When are you moving in?
                <input
                  type="date"
                  name="moveDate"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </label>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary full" disabled={busy}>
                {busy ? "Making room…" : "Create our space"}
                <ArrowRight size={18} />
              </button>
            </form>
            <p className="fine-print">
              <LockKeyhole size={12} /> Your personal link is your access. Keep
              it somewhere safe.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
