"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, MessageCircle, Trash2, X } from "lucide-react";
import type { FeedbackItem } from "@/lib/feedback";
import { useSavedDraft } from "./space/shared";
const categories = {
  confusing: "Something is confusing",
  missing: "Something is missing",
  bug: "Something broke",
  helpful: "This helped us",
};
export default function Feedback({
  id,
  accessKey,
  role,
  screen,
}: {
  id: string;
  accessKey: string;
  role: string;
  screen: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    titleId = useId(),
    [opened, setOpened] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false),
    [items, setItems] = useState<FeedbackItem[]>([]),
    [loading, setLoading] = useState(false);
  const draft = useSavedDraft("fm:feedback:" + id + ":" + role, {
    kind: "confusing",
    message: "",
    id: "",
    screen: "",
  });
  const value = draft.value;
  function open() {
    setError("");
    setSuccess(false);
    dialog.current?.showModal();
    setOpened(true);
  }
  function close() {
    dialog.current?.close();
  }
  const endpoint = "/api/rooms/" + id + "/feedback";
  useEffect(() => {
    if (!opened) return;
    const controller = new AbortController();
    setLoading(true);
    fetch(endpoint, {
      headers: { Authorization: "Bearer " + accessKey },
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = (await r.json()) as {
          error?: string;
          feedback: FeedbackItem[];
        };
        if (!r.ok)
          throw new Error(data.error || "Your feedback could not be loaded.");
        setItems(data.feedback);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [opened, endpoint, accessKey]);
  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + accessKey,
          },
          body: JSON.stringify(payload),
        }),
        data = (await r.json()) as { error?: string; feedback: FeedbackItem[] };
      if (!r.ok)
        throw new Error(
          data.error ||
            "Feedback could not be saved. Your draft is still here.",
        );
      setItems(data.feedback);
      if (payload.action === "create") {
        draft.reset({ kind: "confusing", message: "", id: "", screen: "" });
        setSuccess(true);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const reference = value.id || crypto.randomUUID(),
      context = value.screen || screen;
    draft.change({ id: reference, screen: context });
    void send({
      action: "create",
      id: reference,
      kind: value.kind,
      screen: context,
      message: value.message,
    });
  }
  return (
    <>
      <button className="text-button" onClick={open}>
        <MessageCircle size={14} />
        Give feedback
      </button>
      <dialog
        ref={dialog}
        className="feedback-dialog"
        aria-labelledby={titleId}
        onClose={() => setOpened(false)}
        onClick={(e) => {
          if (e.target === dialog.current) {
            const rect = dialog.current!.getBoundingClientRect();
            if (
              e.clientX < rect.left ||
              e.clientX > rect.right ||
              e.clientY < rect.top ||
              e.clientY > rect.bottom
            )
              close();
          }
        }}
      >
        <div className="feedback-heading">
          <div>
            <p className="eyebrow">A LITTLE BETTER, TOGETHER</p>
            <h2 id={titleId}>How’s First Month feeling?</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close feedback"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {success ? (
          <div className="feedback-success" role="status">
            <Check size={26} />
            <h3>Feedback saved.</h3>
            <p>Thank you. Your message is saved for product review.</p>
            <button
              className="button secondary"
              onClick={() => setSuccess(false)}
            >
              Write another note
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label>
              What would you like to tell us?
              <select
                value={value.kind}
                disabled={busy}
                onChange={(e) =>
                  draft.change({ kind: e.target.value, id: "", screen: "" })
                }
              >
                {Object.entries(categories).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Your note
              <textarea
                autoFocus
                rows={4}
                required
                minLength={5}
                maxLength={2000}
                value={value.message}
                disabled={busy}
                placeholder="What happened, or what would make this easier?"
                onChange={(e) =>
                  draft.change({ message: e.target.value, id: "", screen: "" })
                }
              />
            </label>
            <p className="feedback-privacy">
              Visible to you and the First Month team, never your partner. We
              attach only the screen name, your household reference and role; no
              financial values or access link. Please leave sensitive details
              out of your note.
            </p>
            {!draft.saved && (
              <p className="attention">
                This browser couldn’t save a local draft. Keep this page open
                until your note is saved.
              </p>
            )}
            <div className="feedback-actions">
              <small>{value.message.length} / 2,000</small>
              <button
                className="button primary"
                disabled={busy || loading || value.message.trim().length < 5}
              >
                {busy ? "Saving…" : "Save feedback"}
              </button>
            </div>
          </form>
        )}
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        <details className="feedback-history">
          <summary>Your saved feedback ({items.length})</summary>
          {loading ? (
            <p role="status">Loading your notes…</p>
          ) : !items.length ? (
            <p>No saved notes yet.</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>
                      {categories[item.kind as keyof typeof categories]}
                    </strong>
                    <small>
                      {new Date(item.createdAt).toLocaleDateString("en-US")} ·{" "}
                      {item.screen}
                    </small>
                  </div>
                  <p>{item.message}</p>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() => send({ action: "remove", id: item.id })}
                  >
                    <Trash2 size={13} />
                    Delete this note
                  </button>
                </li>
              ))}
            </ul>
          )}
        </details>
        <p className="feedback-support">
          Need a reply? <a href="mailto:kudomiya@proton.me">Email support</a>.
          This form does not send email notifications.
        </p>
      </dialog>
    </>
  );
}
