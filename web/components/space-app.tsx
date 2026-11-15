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
  ReceiptText,
  Settings,
  ShoppingBag,
  Wallet,
  X,
} from "lucide-react";
import PlanApp from "./plan-app";
import { budgetLink, readNavigation, type SpaceTab } from "@/lib/navigation";
import type { Plan } from "@/lib/room";
import InvitationEntry from "./invitation-entry";
import Feedback from "./feedback";
import { Brand } from "./brand";
import type { SpaceState, SpaceAction } from "@/lib/life-types";
import MonthBook from "./space/month-book";
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

type Tab = SpaceTab;
export default function SpaceApp({ id }: { id: string }) {
  const [key, setKey] = useState(""),
    [invitation, setInvitation] = useState(""),
    [ready, setReady] = useState(false),
    [state, setState] = useState<SpaceState | null>(null),
    [tab, setTab] = useState<Tab>("home"),
    [budgetSection, setBudgetSection] = useState<number | null>(null),
    [routeKey, setRouteKey] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [copyLink, setCopyLink] = useState("");
  const requestNumber = useRef(0),
    working = useRef(false);
  // A new fragment can change the private role or open an invitation in this same tab.
  useEffect(() => {
    const changeAccess = () => location.reload();
    window.addEventListener("hashchange", changeAccess);
    return () => window.removeEventListener("hashchange", changeAccess);
  }, []);
  useEffect(() => {
    const url = new URL(location.href),
      hash = new URLSearchParams(url.hash.slice(1));
    let access = hash.get("key") || "";
    if (!access && !hash.get("invite"))
      try {
        access = sessionStorage.getItem("fm:key:" + id) || "";
      } catch {}
    setKey(access);
    setInvitation(hash.get("invite") || "");
    const route = readNavigation(url);
    setTab(route.tab);
    setBudgetSection(route.section);
    setSelected(route.decision);
    setRouteKey(url.search);
    if (url.pathname.startsWith("/plan/")) {
      url.pathname = "/space/" + id;
      url.searchParams.set("tab", "budget");
      history.replaceState({}, "", url);
    }
    setReady(true);
    if (access)
      try {
        sessionStorage.setItem("fm:key:" + id, access);
        localStorage.setItem("fm:recent", "/space/" + id + "#key=" + access);
      } catch {}
  }, [id]);
  useEffect(() => {
    const restore = () => {
      const url = new URL(location.href),
        route = readNavigation(url);
      setTab(route.tab);
      setBudgetSection(route.section);
      setSelected(route.decision);
      setRouteKey(url.search);
      setError("");
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
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
  useEffect(() => {
    if (error)
      requestAnimationFrame(() =>
        document.querySelector('[role="alert"]')?.scrollIntoView({
          block: "start",
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        }),
      );
  }, [error]);
  function navigate(
    next: Tab,
    decision: string | null = null,
    period?: string,
    entry?: "expense",
  ) {
    setTab(next);
    setBudgetSection(null);
    setSelected(decision);
    setError("");
    const url = new URL(location.href);
    url.searchParams.set("tab", next);
    url.searchParams.delete("section");
    url.searchParams.delete("monthView");
    for (const p of ["entry", "entryId", "category", "original"])
      url.searchParams.delete(p);
    if (next === "months")
      url.searchParams.set(
        "month",
        period || new Date().toISOString().slice(0, 7),
      );
    if (entry && next === "months") url.searchParams.set("entry", entry);
    decision
      ? url.searchParams.set("decision", decision)
      : url.searchParams.delete("decision");
    if (url.href !== location.href) history.pushState({}, "", url);
    setRouteKey(url.search);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function request(path: string, payload: Record<string, unknown>) {
    working.current = true;
    setBusy(true);
    setError("");
    requestNumber.current++;
    try {
      const send = (data: Record<string, unknown>) =>
        fetch("/api/rooms/" + id + path, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + key,
          },
          body: JSON.stringify(data),
        });
      let r = await send(payload);
      let data = (await r.json()) as SpaceState & {
        error?: string;
        token: string;
        invite: string;
      };
      let refreshed = false;
      if (r.status === 409 && path === "" && state) {
        const current = await refresh();
        refreshed = true;
        const independentChange =
          current &&
          ((payload.action === "profile" &&
            JSON.stringify(current.self) === JSON.stringify(state.self)) ||
            (payload.action === "expenses" &&
              JSON.stringify(current.expenses) ===
                JSON.stringify(state.expenses)) ||
            (["plan", "decision"].includes(String(payload.action)) &&
              current.planVersion === state.planVersion) ||
            (payload.action === "estimate" &&
              JSON.stringify(current.estimate) ===
                JSON.stringify(state.estimate)));
        if (independentChange && current) {
          r = await send({ ...payload, revision: current.revision });
          data = (await r.json()) as typeof data;
        }
      }
      if (!r.ok) {
        if (r.status === 409 && !refreshed) await refresh();
        throw new Error(data.error || "Your changes could not be saved.");
      }
      const latest = data.householdDecisions ? data : await refresh();
      if (latest) setState(latest);
      if (!(
        path === "/months" && ["add", "edit"].includes(String(payload.action))
      ))
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
    return budgetLink(id, key, step);
  }
  function openBudget(section: number | null = null) {
    setTab("budget");
    setBudgetSection(section);
    setSelected(null);
    setError("");
    const target = new URL(
      budgetLink(id, key, section ?? undefined),
      location.origin,
    );
    if (target.href !== location.href) history.pushState({}, "", target);
    setRouteKey(target.search);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const shareProfile = () =>
    request("", {
      action: "profile",
      revision: state?.revision,
      profile: { ...state?.self, shared: true },
    });
  async function prepareBudgetGuide(plan: Plan) {
    let current = state;
    if (!current) return;
    if (
      plan.method !== current.plan.method ||
      (plan.method === "custom" && plan.customA !== current.plan.customA)
    ) {
      current = await request("", {
        action: "plan",
        revision: current.revision,
        plan,
      });
      if (!current) return;
    }
    return request("/guide", { revision: current.revision });
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
  if (ready && invitation && !key)
    return <InvitationEntry id={id} invitation={invitation} />;
  if (!state)
    return (
      <div className="space-loading">
        <Brand />
        <div className="surface entry-card">
          <LockKeyhole size={30} />
          <h1>Find your way home.</h1>
          <p>Open your saved personal link to return to your household.</p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <a className="button primary" href="/spaces">
            Find my spaces <ArrowRight size={17} />
          </a>
          <a className="text-button" href="/start">
            Start a new space
          </a>
        </div>
      </div>
    );
  const pair = names(state),
    nav = [
      {
        id: "home",
        label: "Overview",
        description: "Your next step",
        icon: House,
      },
      {
        id: "budget",
        label: "Our budget",
        description: "What we plan to pay",
        icon: Wallet,
      },
      {
        id: "months",
        label: "Spending",
        description: "What we actually paid",
        icon: ReceiptText,
      },
      {
        id: "decisions",
        label: "Decisions",
        description: "Purchases & goals",
        icon: ShoppingBag,
      },
      {
        id: "reviews",
        label: "Check-in",
        description: "How it’s going",
        icon: CalendarDays,
      },
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
          {nav.map(({ id: next, label, description, icon: Icon }) => (
            <button
              key={next}
              className={tab === next ? "active" : ""}
              aria-current={tab === next ? "page" : undefined}
              onClick={() => navigate(next)}
            >
              <Icon size={19} />
              <span>
                {label}
                <small>{description}</small>
              </span>
              {next === "decisions" &&
                state.householdDecisions.some((d) => d.status === "open") && (
                  <i className="nav-dot" />
                )}
            </button>
          ))}
        </nav>
        <div className="life-sidebar-bottom">
          <button
            className={
              "space-settings-link " + (tab === "settings" ? "active" : "")
            }
            aria-current={tab === "settings" ? "page" : undefined}
            onClick={() => navigate("settings")}
          >
            <Settings size={18} />
            Settings & access
          </button>
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
          <p className="space-location" aria-label="Current section">
            {tab === "settings"
              ? "Settings & access"
              : nav.find((n) => n.id === tab)?.label}
          </p>
          <div>
            <span className="life-save-indicator">
              <i />
              {busy ? "Saving…" : "Your view: " + state.self.name}
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
            <button
              className={
                "icon-button settings-shortcut " +
                (tab === "settings" ? "active" : "")
              }
              aria-label="Settings and access"
              title="Settings and access"
              onClick={() => navigate("settings")}
            >
              <Settings size={19} />
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
        <main
          className={"life-main " + (tab === "budget" ? "has-budget" : "")}
          key={
            tab + ":" + (selected || "") + (tab === "months" ? routeKey : "")
          }
          onClick={(event) => {
            const anchor = (event.target as HTMLElement).closest("a");
            if (
              !anchor ||
              event.defaultPrevented ||
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            const url = new URL(anchor.href);
            if (
              url.origin === location.origin &&
              url.pathname === "/space/" + id &&
              url.hash === "#key=" + key &&
              url.searchParams.get("tab") === "budget"
            ) {
              event.preventDefault();
              openBudget(readNavigation(url).section);
            }
          }}
        >
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
          {!state.self.submitted && (tab === "home" || tab === "budget") ? (
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
                  onShare={shareProfile}
                />
              )}{" "}
              {tab === "budget" && (
                <PlanApp
                  state={state}
                  busy={busy}
                  section={budgetSection}
                  onSection={openBudget}
                  onMutate={(action, payload = {}) =>
                    request("", {
                      action,
                      revision: state.revision,
                      ...payload,
                    })
                  }
                  onGuide={prepareBudgetGuide}
                  onInvite={invite}
                  onSpending={() => navigate("months")}
                  onError={setError}
                />
              )}
              {tab === "months" && (
                <MonthBook
                  onShare={shareProfile}
                  onInvite={invite}
                  state={state}
                  busy={busy}
                  act={(action, payload = {}) =>
                    request("/months", {
                      action,
                      roomRevision: state.revision,
                      ...payload,
                    })
                  }
                  onError={setError}
                  planLink={planLink}
                />
              )}
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
                  onMonth={() => navigate("months")}
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
            <Feedback
              id={id}
              accessKey={key}
              role={state.role}
              screen={tab === "budget" ? "plan" : tab}
            />
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
