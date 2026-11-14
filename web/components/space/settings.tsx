"use client";
import { useState } from "react";
import {
  ArrowRight,
  Copy,
  Download,
  LifeBuoy,
  Link as LinkIcon,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import type { SpaceState } from "@/lib/life-types";
import { downloadFile, fullDate, money, names } from "./shared";
export default function SpaceSettings({
  state,
  accessKey,
  busy,
  onInvite,
  onError,
  onRefresh,
  onCopy,
  planLink,
}: {
  state: SpaceState;
  accessKey: string;
  busy: boolean;
  onInvite: () => Promise<void>;
  onError: (s: string) => void;
  onRefresh: () => Promise<unknown>;
  onCopy: (s: string) => Promise<void>;
  planLink: (step?: number) => string;
}) {
  const [working, setWorking] = useState(false),
    [confirm, setConfirm] = useState(""),
    [rotating, setRotating] = useState(false),
    [deleting, setDeleting] = useState(false);
  const link = () =>
    location.origin + "/space/" + state.id + "#key=" + accessKey;
  async function request(
    action: string,
    payload: Record<string, unknown> = {},
  ) {
    setWorking(true);
    onError("");
    try {
      const r = await fetch("/api/rooms/" + state.id + "/access", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + accessKey,
          },
          body: JSON.stringify({
            action,
            revision: state.revision,
            ...payload,
          }),
        }),
        data = (await r.json()) as Record<string, unknown> & {
          error?: string;
          token: string;
          deleted: boolean;
        };
      if (!r.ok) {
        if (r.status === 409) await onRefresh();
        throw new Error(data.error);
      }
      return data;
    } catch (e) {
      onError((e as Error).message);
      return null;
    } finally {
      setWorking(false);
    }
  }
  return (
    <>
      <div className="life-heading">
        <p className="eyebrow">A LITTLE HOUSEKEEPING</p>
        <h1>Your space, your choices.</h1>
        <p>
          Keep your access safe, take your data with you, and decide what to
          share.
        </p>
      </div>
      <div className="settings-grid">
        <section className="surface settings-card">
          <span className="section-icon">
            <LinkIcon size={22} />
          </span>
          <h2>Keep your way back.</h2>
          <p>
            Your personal link is your access. Anyone with it can act as you.
            Save it somewhere private; your partner has a separate link.
          </p>
          <div className="settings-actions">
            <button className="button secondary" onClick={() => onCopy(link())}>
              <Copy size={16} />
              Copy my link
            </button>
            <button
              className="text-button"
              onClick={() =>
                downloadFile(
                  "first-month-personal-access.txt",
                  "Your private First Month access link\n\n" +
                    link() +
                    "\n\nKeep this file private. Anyone with the link can act as you.\n",
                  "text/plain",
                )
              }
            >
              <Download size={16} />
              Download access backup
            </button>
          </div>
          <details>
            <summary>Replace a link that may have been shared</summary>
            <p>
              Your current personal link and other tabs using it will stop
              working. Your partner’s link stays unchanged.
            </p>
            {rotating ? (
              <button
                className="button secondary"
                disabled={working || busy}
                onClick={async () => {
                  const data = await request("rotate");
                  if (data) {
                    try {
                      sessionStorage.setItem("fm:key:" + state.id, data.token);
                      localStorage.setItem(
                        "fm:recent",
                        "/space/" + state.id + "#key=" + data.token,
                      );
                      if (state.demo) {
                        const demo = JSON.parse(
                          localStorage.getItem("fm:demo:" + state.id) || "{}",
                        );
                        demo[state.role] = data.token;
                        localStorage.setItem(
                          "fm:demo:" + state.id,
                          JSON.stringify(demo),
                        );
                      }
                    } catch {}
                    history.replaceState(
                      {},
                      "",
                      "/space/" + state.id + "?tab=settings#key=" + data.token,
                    );
                    location.reload();
                  }
                }}
              >
                Replace my personal link
              </button>
            ) : (
              <button className="text-button" onClick={() => setRotating(true)}>
                <RefreshCw size={15} />I need a new link
              </button>
            )}
          </details>
          <p className="fine-print">
            If you lose every copy of your personal link, we cannot verify that
            a space belongs to you. Save a backup before clearing browser
            storage.
          </p>
        </section>
        <section className="surface settings-card">
          <span className="section-icon peach-bg">
            <Users size={22} />
          </span>
          <h2>Both people, separate voices.</h2>
          <p>
            Your income is {state.self.shared ? "ready to share" : "private"}.
            Your partner’s details appear only when both of you share. Each
            decision and weekly check-in has its own sharing choice.
          </p>
          <a href={planLink(0)} className="button secondary">
            Manage my financial answers
            <ArrowRight size={16} />
          </a>
          {!state.joined && (
            <button className="text-button" disabled={busy} onClick={onInvite}>
              Copy partner invitation
              <Copy size={15} />
            </button>
          )}
          <p className="fine-print">
            Sharing an answer does not approve a proposal. Each person confirms
            decisions separately.
          </p>
        </section>
        <section className="surface settings-card">
          <span className="section-icon">
            <Download size={22} />
          </span>
          <h2>Your data goes with you.</h2>
          <p>
            Export your own answers, mutually shared answers, decisions, weekly
            check-ins, available plan history, and shared monthly expense and
            reimbursement records. Your partner’s private answers are excluded.
          </p>
          <button
            className="button secondary"
            disabled={working || busy}
            onClick={async () => {
              const data = await request("export");
              if (data)
                downloadFile(
                  "first-month-data.json",
                  JSON.stringify(data, null, 2),
                );
            }}
          >
            <Download size={16} />
            Export my data
          </button>
          <p className="fine-print">
            The export does not contain your access token. Download an access
            backup separately if you need one.
          </p>
        </section>
        <section className="surface settings-card">
          <span className="section-icon">
            <LifeBuoy size={22} />
          </span>
          <h2>A person you can reach.</h2>
          <p>
            Questions, a problem with your space, or feedback about something
            that could work better?
          </p>
          <a href="mailto:kudomiya@proton.me" className="button secondary">
            Contact support
            <ArrowRight size={16} />
          </a>
          <span className="support-address">kudomiya@proton.me</span>
          <p className="fine-print">
            Describe the issue without including your private access link or
            financial details.
          </p>
        </section>
      </div>
      <section className="surface plan-history-settings">
        <div className="section-heading">
          <div>
            <p className="overline">THE PLANS YOU BOTH CONFIRMED</p>
            <h2>Your agreement history.</h2>
          </div>
        </div>
        {state.planHistory.length ? (
          state.planHistory.map((item) => (
            <details key={item.planVersion}>
              <summary>
                <span>
                  Version {item.planVersion} · {fullDate(item.createdAt)}
                </span>
                <strong>{money(item.total)} / month</strong>
              </summary>
              <div className="history-contributions">
                {item.names.map((name, i) => (
                  <p key={i}>
                    {name}: <strong>{money(item.contributions[i])}</strong>
                  </p>
                ))}
              </div>
              {item.expenses.map((expense, i) => (
                <p key={i}>
                  {expense.label}: {money(expense.amount)}
                </p>
              ))}
              <p>
                Transfer day: {item.plan.payday} · Next review:{" "}
                {fullDate(item.plan.reviewDate)}
              </p>
              {item.plan.notes && <p>{item.plan.notes}</p>}
            </details>
          ))
        ) : (
          <p className="muted">
            A version is saved here when both of you confirm your monthly
            agreement. Both must still be sharing to view the history.
          </p>
        )}
      </section>
      <section className="settings-danger">
        <div>
          <h3>Delete this shared space</h3>
          <p>
            This permanently removes the space, both people’s answers,
            decisions, and history. Both personal links stop working. Export
            anything you need first.
          </p>
        </div>
        {deleting ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = await request("delete", { confirmation: confirm });
              if (data?.deleted) {
                try {
                  for (const k of Object.keys(localStorage))
                    if (k.includes(state.id)) localStorage.removeItem(k);
                  if (localStorage.getItem("fm:recent")?.includes(state.id))
                    localStorage.removeItem("fm:recent");
                  sessionStorage.removeItem("fm:key:" + state.id);
                } catch {}
                location.assign("/");
              }
            }}
          >
            <label>
              Type DELETE to remove this space for both people
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                required
              />
            </label>
            <button
              className="button danger"
              disabled={working || busy || confirm !== "DELETE"}
            >
              <Trash2 size={16} />
              Permanently delete space
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setDeleting(false);
                setConfirm("");
              }}
            >
              Keep our space
            </button>
          </form>
        ) : (
          <button
            className="text-button danger-text"
            onClick={() => setDeleting(true)}
          >
            Delete our space
          </button>
        )}
      </section>
    </>
  );
}
