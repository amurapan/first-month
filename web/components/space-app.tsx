"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Copy,
  House,
  LifeBuoy,
  LockKeyhole,
  Plus,
  RefreshCw,
  Settings,
  ShoppingBag,
  Wallet,
  X,
} from "lucide-react";
import { Brand } from "./brand";
import type { SpaceState, SpaceAction } from "@/lib/life-types";
import Overview from "./space/overview";
import Decisions from "./space/decisions";
import Reviews from "./space/reviews";
import SpaceSettings from "./space/settings";
import { inputCents } from "@/lib/domain/preview.js";
import { readDraft, writeDraft } from "@/lib/browser-draft";
import {
  DraftStatus,
  MoneyInput,
  names,
  ShareNote,
  useSavedDraft,
} from "./space/shared";

type Tab = "home" | "decisions" | "reviews" | "settings";
export default function SpaceApp({ id }: { id: string }) {
  const [key, setKey] = useState(""),
    [invitation, setInvitation] = useState(""),
    [ready, setReady] = useState(false),
    [state, setState] = useState<SpaceState | null>(null),
    [tab, setTab] = useState<Tab>("home"),
    [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [copyLink, setCopyLink] = useState("");
  const requestNumber = useRef(0),
    working = useRef(false);
  useEffect(() => {
    const url = new URL(location.href),
      hash = new URLSearchParams(url.hash.slice(1));
    let access = hash.get("key") || "";
    if (!access)
      try {
        access = sessionStorage.getItem("fm:key:" + id) || "";
      } catch {}
    setKey(access);
    setInvitation(hash.get("invite") || "");
    const t = url.searchParams.get("tab");
    if (t && ["home", "decisions", "reviews", "settings"].includes(t))
      setTab(t as Tab);
    setSelected(url.searchParams.get("decision"));
    setReady(true);
    if (access)
      try {
        sessionStorage.setItem("fm:key:" + id, access);
        localStorage.setItem("fm:recent", "/space/" + id + "#key=" + access);
      } catch {}
  }, [id]);
  const refresh = useCallback(async () => {
    if (!key) return null;
    const n = ++requestNumber.current;
    const r = await fetch("/api/rooms/" + id + "/workspace", {
      headers: { Authorization: "Bearer " + key },
    });
    const data = (await r.json()) as SpaceState & {
      error?: string;
      token: string;
      invite: string;
    };
    if (!r.ok) throw new Error(data.error || "Your space could not be loaded.");
    if (n === requestNumber.current) setState(data);
    return data as SpaceState;
  }, [id, key]);
  useEffect(() => {
    if (!key) return;
    refresh().catch((e) => setError(e.message));
    const timer = setInterval(() => {
      if (!document.hidden && !working.current) refresh().catch(() => {});
    }, 6000);
    return () => clearInterval(timer);
  }, [refresh, key]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  function navigate(next: Tab, decision: string | null = null) {
    setTab(next);
    setSelected(decision);
    setError("");
    const url = new URL(location.href);
    url.searchParams.set("tab", next);
    decision
      ? url.searchParams.set("decision", decision)
      : url.searchParams.delete("decision");
    history.replaceState({}, "", url);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function request(path: string, payload: Record<string, unknown>) {
    working.current = true;
    setBusy(true);
    setError("");
    requestNumber.current++;
    try {
      const r = await fetch("/api/rooms/" + id + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + key,
        },
        body: JSON.stringify(payload),
      });
      const data = (await r.json()) as SpaceState & {
        error?: string;
        token: string;
        invite: string;
      };
      if (!r.ok) {
        if (r.status === 409) await refresh();
        throw new Error(data.error || "Your changes could not be saved.");
      }
      const latest = data.householdDecisions ? data : await refresh();
      if (latest) setState(latest);
      setToast("Saved to your shared space");
      return latest as SpaceState;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  const act: SpaceAction = (action, payload = {}) =>
    request("/workspace", {
      action,
      roomRevision: state?.revision,
      ...payload,
    });
  const guide = (
    kind: "decision" | "review",
    item: { id: string; revision: number },
  ) =>
    request("/conversation", {
      kind,
      id: item.id,
      revision: item.revision,
      roomRevision: state?.revision,
    });
  function planLink(step?: number) {
    if (state && step !== undefined)
      writeDraft("fm:step:" + id + ":" + state.role, step);
    return "/plan/" + id + "#key=" + key;
  }
  async function join() {
    working.current = true;
    setBusy(true);
    try {
      const r = await fetch("/api/rooms/" + id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", invite: invitation }),
      });
      const data = (await r.json()) as SpaceState & {
        error?: string;
        token: string;
        invite: string;
      };
      if (!r.ok) throw new Error(data.error);
      history.replaceState({}, "", "/space/" + id + "#key=" + data.token);
      location.reload();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      working.current = false;
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setToast("Link copied");
    } catch {
      setCopyLink(value);
    }
  }
  async function invite() {
    if (!state) return;
    let token = "";
    try {
      token = localStorage.getItem("fm:invite:" + id) || "";
    } catch {}
    if (!token) {
      working.current = true;
      setBusy(true);
      try {
        const r = await fetch("/api/rooms/" + id, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + key,
          },
          body: JSON.stringify({ action: "invite", revision: state.revision }),
        });
        const data = (await r.json()) as SpaceState & {
          error?: string;
          token: string;
          invite: string;
        };
        if (!r.ok) throw new Error(data.error);
        token = data.invite;
        try {
          localStorage.setItem("fm:invite:" + id, token);
        } catch {}
        await refresh();
      } catch (e) {
        setError((e as Error).message);
        return;
      } finally {
        working.current = false;
        setBusy(false);
      }
    }
    await copy(location.origin + "/space/" + id + "#invite=" + token);
  }
  function switchDemo() {
    const other = state?.role === "A" ? "B" : "A";
    let token = "";
    try {
      token =
        JSON.parse(localStorage.getItem("fm:demo:" + id) || "{}")[other] || "";
    } catch {}
    if (!token) {
      setError("Open a new sample to try both roles.");
      return;
    }
    const next = new URL(location.href);
    next.hash = "key=" + token;
    history.replaceState({}, "", next);
    location.reload();
  }
  if (!ready || (!state && key && !error))
    return (
      <div className="space-loading">
        <Brand />
        <p>Opening your shared home…</p>
      </div>
    );
  if (!state)
    return (
      <div className="space-loading">
        <Brand />
        <div className="surface entry-card">
          <LockKeyhole size={30} />
          <h1>
            {invitation ? "A space for both of you." : "Find your way home."}
          </h1>
          <p>
            {invitation
              ? "Join your partner, add your side, and make money decisions together. You choose what to share."
              : "Open your saved personal link to return to your household. You can also restore access using a personal link you saved."}
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {invitation ? (
            <button className="button primary" disabled={busy} onClick={join}>
              {busy ? "Joining…" : "Join our space"}
              <ArrowRight size={17} />
            </button>
          ) : (
            <>
              <a className="button primary" href="/spaces">
                Find my spaces
                <ArrowRight size={17} />
              </a>
              <a className="text-button" href="/start">
                Start a new space
              </a>
            </>
          )}
        </div>
      </div>
    );
  const pair = names(state),
    nav = [
      { id: "home", label: "Our home", icon: House },
      { id: "decisions", label: "Decisions", icon: ShoppingBag },
      { id: "reviews", label: "Weekly check-in", icon: CalendarDays },
      { id: "settings", label: "Our space", icon: Settings },
    ] as const;
  return (
    <div className="life-shell">
      <aside className="life-sidebar">
        <Brand />
        <div className="life-household">
          <span className="avatar-stack">
            <i>{pair[0][0]}</i>
            <i>{pair[1][0]}</i>
          </span>
          <strong>{pair.join(" & ")}</strong>
          <small>
            {state.demo
              ? "Fictional sample household"
              : "Your shared home for money"}
          </small>
        </div>
        <nav aria-label="Household navigation">
          {nav.map(({ id: next, label, icon: Icon }) => (
            <button
              key={next}
              className={tab === next ? "active" : ""}
              aria-current={tab === next ? "page" : undefined}
              onClick={() => navigate(next)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {next === "decisions" &&
                state.householdDecisions.some((d) => d.status === "open") && (
                  <i className="nav-dot" />
                )}
            </button>
          ))}
          <a href={planLink()}>
            <Wallet size={19} />
            Monthly plan
            <ArrowRight size={14} />
          </a>
        </nav>
        <div className="life-sidebar-bottom">
          <p>
            Little conversations.
            <br />A life you build together.
          </p>
          <a href="mailto:kudomiya@proton.me">
            <LifeBuoy size={16} />
            Get help
          </a>
        </div>
      </aside>
      <div className="life-content">
        <header className="life-topbar">
          <span className="life-mobile-brand">
            <Brand />
          </span>
          <p>
            {tab === "home"
              ? "A little clarity for your everyday."
              : nav.find((n) => n.id === tab)?.label}
          </p>
          <div>
            <span className="life-save-indicator">
              <i />
              {busy ? "Saving…" : "Saved to your space"}
            </span>
            <button
              className="icon-button"
              aria-label="Copy my personal link"
              onClick={() =>
                copy(location.origin + "/space/" + id + "#key=" + key)
              }
            >
              <Copy size={18} />
            </button>
            <span className="avatar">{state.self.name[0]}</span>
          </div>
        </header>
        <nav
          className="life-mobile-nav"
          aria-label="Mobile household navigation"
        >
          {nav.map(({ id: next, label, icon: Icon }) => (
            <button
              key={next}
              aria-current={tab === next ? "page" : undefined}
              onClick={() => navigate(next)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
          <a href={planLink()}>
            <Wallet size={18} />
            <span>Plan</span>
          </a>
        </nav>
        {state.demo && (
          <div className="demo-banner">
            <span>Sample household · every number and answer is fictional</span>
            <button onClick={switchDemo}>
              Switch to {state.partner.name}
              <ArrowRight size={15} />
            </button>
          </div>
        )}
        <main className="life-main">
          {error && (
            <div className="alert error" role="alert">
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {copyLink && (
            <div className="alert">
              <label>
                Copy this private link
                <input
                  readOnly
                  value={copyLink}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <button
                className="icon-button"
                aria-label="Close link"
                onClick={() => setCopyLink("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {!state.self.submitted ? (
            <Welcome
              state={state}
              busy={busy}
              onSave={(profile) =>
                request("", {
                  action: "profile",
                  revision: state.revision,
                  profile,
                })
              }
              onError={setError}
            />
          ) : (
            <>
              {tab === "home" && (
                <Overview
                  state={state}
                  busy={busy}
                  onNavigate={navigate}
                  planLink={planLink}
                  onInvite={invite}
                  onShare={() =>
                    request("", {
                      action: "profile",
                      revision: state.revision,
                      profile: { ...state.self, shared: true },
                    })
                  }
                />
              )}{" "}
              {tab === "decisions" && (
                <Decisions
                  state={state}
                  busy={busy}
                  selected={selected}
                  onSelect={(id) => navigate("decisions", id)}
                  act={act}
                  onGuide={(item) => guide("decision", item)}
                  onError={setError}
                  planLink={planLink}
                />
              )}{" "}
              {tab === "reviews" && (
                <Reviews
                  state={state}
                  busy={busy}
                  act={act}
                  onGuide={(item) => guide("review", item)}
                  onError={setError}
                  planLink={planLink}
                />
              )}{" "}
              {tab === "settings" && (
                <SpaceSettings
                  state={state}
                  accessKey={key}
                  busy={busy}
                  onInvite={invite}
                  onError={setError}
                  onRefresh={refresh}
                  onCopy={copy}
                  planLink={planLink}
                />
              )}
            </>
          )}
        </main>
        <footer className="life-footer">
          <span>First Month · Make room for both of you.</span>
          <div>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => refresh().catch((e) => setError(e.message))}
            >
              <RefreshCw size={13} />
              Refresh
            </button>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </div>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
function Welcome({
  state,
  busy,
  onSave,
  onError,
}: {
  state: SpaceState;
  busy: boolean;
  onSave: (profile: unknown) => Promise<unknown>;
  onError: (s: string) => void;
}) {
  const draft = useSavedDraft("fm:welcome:" + state.id + ":" + state.role, {
    name: "",
    income: "",
  });
  return (
    <section className="life-welcome">
      <p className="eyebrow">WELCOME TO YOUR SHARED HOME</p>
      <h1>Start with your side.</h1>
      <p>
        {state.partner.name} invited you. Add your own income; their estimate
        never becomes your answer.
      </p>
      <form
        className="surface"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const shared =
              (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
                "value",
              ) !== "private";
            const result = await onSave({
              ...state.self,
              name: draft.value.name.trim() || state.self.name,
              income: inputCents(draft.value.income),
              personal: 0,
              reserve: 0,
              refined: false,
              priority: "",
              concern: "",
              shared,
            });
            if (result) draft.reset();
          } catch (error) {
            onError((error as Error).message);
          }
        }}
      >
        <MoneyInput
          label="Your monthly take-home income"
          value={draft.value.income}
          onChange={(income) => draft.change({ income })}
          hint="After tax. Add personal bills and savings later in your monthly plan."
        />
        <label>
          Your name <span className="optional">Optional</span>
          <input
            value={draft.value.name}
            onChange={(e) => draft.change({ name: e.target.value })}
            maxLength={60}
          />
        </label>
        <ShareNote />
        <div className="form-actions">
          <button className="button primary" disabled={busy} value="share">
            Share & continue
            <ArrowRight size={17} />
          </button>
          <button className="text-button" disabled={busy} value="private">
            Save privately
          </button>
        </div>
        <DraftStatus {...draft} onReset={() => draft.reset()} />
      </form>
    </section>
  );
}
