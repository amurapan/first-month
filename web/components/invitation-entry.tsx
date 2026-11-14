"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Check, LockKeyhole, Users } from "lucide-react";
import { Brand } from "./brand";
export default function InvitationEntry({
  id,
  invitation,
}: {
  id: string;
  invitation: string;
}) {
  const [preview, setPreview] = useState<{
      inviterName: string;
      startingPlanReady: boolean;
    } | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [saved, setSaved] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setPreview(null);
    setSaved("");
    async function inspect() {
      const keys: string[] = [];
      try {
        keys.push(sessionStorage.getItem("fm:key:" + id) || "");
      } catch {}
      try {
        const recent = new URL(
          localStorage.getItem("fm:recent") || "",
          location.origin,
        );
        if (
          recent.origin === location.origin &&
          ["/space/" + id, "/plan/" + id].includes(recent.pathname)
        )
          keys.push(new URLSearchParams(recent.hash.slice(1)).get("key") || "");
      } catch {}
      const checkSaved = async () => {
        for (const key of [...new Set(keys)].filter((x) =>
          /^[a-f0-9]{64}$/.test(x),
        )) {
          const response = await fetch("/api/rooms/" + id, {
            headers: { Authorization: "Bearer " + key },
            signal: controller.signal,
          });
          if (response.ok) {
            if (!controller.signal.aborted)
              setSaved("/space/" + id + "#key=" + key);
            return;
          }
          if (![401, 403, 404].includes(response.status))
            throw new Error(
              "Your saved access could not be checked. Please try again.",
            );
        }
      };
      const checkInvite = async () => {
        const r = await fetch("/api/rooms/" + id + "/invitation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invite: invitation }),
          signal: controller.signal,
        });
        const data = (await r.json()) as {
          error?: string;
          inviterName: string;
          startingPlanReady: boolean;
        };
        if (!r.ok)
          throw new Error(data.error || "The invitation could not be checked.");
        return data;
      };
      const results = await Promise.allSettled([checkSaved(), checkInvite()]);
      if (controller.signal.aborted) return;
      if (results[0].status === "rejected") throw results[0].reason;
      if (results[1].status === "rejected") throw results[1].reason;
      setPreview(results[1].value);
    }
    inspect()
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, invitation, retry]);
  async function join() {
    if (busy || !preview) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/rooms/" + id, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "join", invite: invitation }),
        }),
        data = (await r.json()) as { error?: string; token: string };
      if (!r.ok)
        throw new Error(data.error || "Your invitation could not be accepted.");
      const link = "/space/" + id + "#key=" + data.token;
      try {
        sessionStorage.setItem("fm:key:" + id, data.token);
        localStorage.setItem("fm:recent", link);
      } catch {}
      location.replace(link);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  const name =
    preview?.inviterName === "Partner 1"
      ? "Your partner"
      : preview?.inviterName;
  return (
    <div className="invitation-shell">
      <header>
        <Brand />
        <a href="/" className="text-button">
          About First Month <ArrowRight size={15} />
        </a>
      </header>
      <main className="invitation-card">
        <div className="invitation-pair" aria-hidden="true">
          <span>{name?.[0] || "1"}</span>
          <span>You</span>
        </div>
        <p className="eyebrow">A CONVERSATION, NOT A COMMITMENT</p>
        <h1>
          {loading ? (
            "Opening your invitation…"
          ) : preview ? (
            <>
              {name} made
              <br />
              <em>room for you.</em>
            </>
          ) : (
            "Let’s check your invitation."
          )}
        </h1>
        {loading && <p role="status">Checking this private invitation.</p>}
        {preview && (
          <>
            <p className="invitation-intro">
              {preview.startingPlanReady
                ? "There’s a starting comparison ready to revisit together."
                : "Your shared space is ready for both perspectives."}{" "}
              Your own answers come next.
            </p>
            <ol className="invitation-steps">
              <li>
                <span>01</span>
                <div>
                  <strong>Add your side</strong>
                  <p>
                    Start with your own take-home income. Their estimate never
                    becomes your answer.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Choose what to share</strong>
                  <p>
                    Save privately or share when ready. Your profile appears to
                    each other only after both people share.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Decide together</strong>
                  <p>
                    Review the costs and split. Joining does not accept a plan
                    or publish your income.
                  </p>
                </div>
              </li>
            </ol>
            {saved ? (
              <div className="invitation-existing">
                <strong>This browser already has access to this space.</strong>
                <p>
                  Use your saved personal link to return. This invitation is for
                  the other person; send it to them to open in their own
                  browser.
                </p>
                <a className="button primary" href={saved}>
                  Return to my space <ArrowRight size={17} />
                </a>
              </div>
            ) : (
              <button
                className="button primary large"
                disabled={busy}
                onClick={join}
              >
                {busy ? "Joining…" : "Join our space"}
                <ArrowRight size={18} />
              </button>
            )}
            <p className="invitation-footnote">
              <LockKeyhole size={15} />
              You’ll get your own private access link. No login or bank
              connection.
            </p>
          </>
        )}
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        {!loading && !preview && (
          <div className="invitation-recovery">
            {saved && (
              <a className="button primary" href={saved}>
                Return with my saved link <ArrowRight size={16} />
              </a>
            )}
            <button
              className="button secondary"
              onClick={() => setRetry((x) => x + 1)}
            >
              Check invitation again
            </button>
            <a className="text-button" href="/spaces">
              Find my saved spaces
            </a>
          </div>
        )}
        <div className="invitation-assurances">
          <span>
            <Check size={14} />
            No automatic sharing
          </span>
          <span>
            <Users size={14} />
            Two separate confirmations
          </span>
        </div>
      </main>
    </div>
  );
}
