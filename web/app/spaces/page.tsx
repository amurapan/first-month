"use client";
import { useEffect, useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Brand } from "@/components/brand";
export default function Spaces() {
  const [recent, setRecent] = useState(""),
    [value, setValue] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    try {
      setRecent(localStorage.getItem("fm:recent") || "");
    } catch {}
  }, []);
  return (
    <div className="space-loading">
      <Brand />
      <section className="surface entry-card">
        <LockKeyhole size={30} />
        <h1>Find your way home.</h1>
        <p>
          Your saved personal link opens your space on any device. Look for the
          access backup you downloaded, or paste your link below.
        </p>
        {recent && (
          <a className="button primary" href={recent}>
            Open my saved space
            <ArrowRight size={17} />
          </a>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const url = new URL(value, location.origin),
                match = url.pathname.match(/^\/(space|plan)\/([a-f0-9-]{36})$/),
                key = new URLSearchParams(url.hash.slice(1)).get("key");
              if (!match || !key || !/^[a-f0-9]{64}$/.test(key))
                throw new Error();
              location.assign("/space/" + match[2] + "#key=" + key);
            } catch {
              setError(
                "Paste the complete personal link, including the part after #key=.",
              );
            }
          }}
        >
          <label>
            Your personal link
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              required
              placeholder="https://…/space/…#key=…"
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="button secondary">
            Open this space
            <ArrowRight size={17} />
          </button>
        </form>
        <a href="/start" className="text-button">
          Start a new space
        </a>
        <p className="fine-print">
          Your partner’s link represents their side. They cannot recover or
          recreate your personal link.
        </p>
      </section>
    </div>
  );
}
