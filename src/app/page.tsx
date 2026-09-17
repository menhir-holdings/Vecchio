"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { isValidPin, normalizePin, PIN_STORAGE_KEY } from "@/lib/pin";
import {
  generateSessionCode,
  isValidSessionCode,
  normalizeSessionCode,
} from "@/lib/session-code";

export default function HomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pinnedCodes, setPinnedCodes] = useState<string[]>([]);
  const [selectedPinned, setSelectedPinned] = useState<string | null>(null);
  const [pinnedPin, setPinnedPin] = useState("");
  const [pinnedLoading, setPinnedLoading] = useState(false);
  const pinnedPinInputRef = useRef<HTMLInputElement>(null);

  const loadPinned = useCallback(() => {
    void fetch("/api/pinned", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { codes?: string[] }) => setPinnedCodes(data.codes ?? []))
      .catch(() => setPinnedCodes([]));
  }, []);

  useEffect(() => {
    loadPinned();
    const onFocus = () => loadPinned();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadPinned]);

  useEffect(() => {
    if (selectedPinned) {
      pinnedPinInputRef.current?.focus();
    }
  }, [selectedPinned]);

  const createSession = () => {
    const code = generateSessionCode();
    router.push(`/${code}`);
  };

  const joinSession = () => {
    const code = normalizeSessionCode(joinCode);
    if (!isValidSessionCode(code)) {
      setError("Enter a 4-character session code (A–Z, 2–9).");
      return;
    }
    setError(null);
    router.push(`/${code}`);
  };

  const openPinned = useCallback(
    async (code: string) => {
      const pin = normalizePin(pinnedPin);
      if (!isValidPin(pin)) {
        setError("Enter the 4-digit PIN for this pinned session.");
        return;
      }
      setPinnedLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/pinned/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, pin }),
        });
        const data = (await res.json()) as { ok?: boolean };
        if (!data.ok) {
          setError("Wrong PIN for that session.");
          return;
        }
        sessionStorage.setItem(PIN_STORAGE_KEY(code), pin);
        router.push(`/${code}`);
      } catch {
        setError("Could not verify PIN.");
      } finally {
        setPinnedLoading(false);
      }
    },
    [pinnedPin, router],
  );

  return (
    <main className="desk-home">
      <aside className="atmosphere" aria-hidden>
        <div className="folio">
          <p className="kicker folio-kicker">The page is the room</p>
          <p className="folio-lines">
            {`Prompts, notes, a draft —
open the same page on the other
machine. Equal seats. No host.`}
          </p>
        </div>
      </aside>

      <section className="join">
        <div>
          <p className="kicker">Shared page</p>
          <h1 className="wordmark join-title">Vecchio</h1>
          <p className="join-lead">
            Anyone with the code can write — even without an account. Unpinned
            pages clear after five minutes empty; pinned pages stay in this
            index and never auto-clear.
          </p>
        </div>

        <button type="button" onClick={createSession} className="btn-ink w-full py-2.5 text-[0.95rem]">
          Start a page
        </button>

        <div>
          <label htmlFor="code" className="field-label">
            Access code
          </label>
          <input
            id="code"
            value={joinCode}
            onChange={(e) => setJoinCode(normalizeSessionCode(e.target.value))}
            maxLength={4}
            placeholder="ABCD"
            autoComplete="off"
            spellCheck={false}
            className="field code-input"
            onKeyDown={(e) => {
              if (e.key === "Enter") joinSession();
            }}
          />
          {error && !selectedPinned && <p className="err mt-2">{error}</p>}
          <button
            type="button"
            onClick={joinSession}
            className="btn-ghost mt-3 w-full py-2 text-sm"
          >
            Enter
          </button>
        </div>

        {pinnedCodes.length === 0 && (
          <p className="hint">
            No pinned pages yet. Pin a page from its toolbar to keep it here.
          </p>
        )}

        {pinnedCodes.length > 0 && (
          <div className="ledger">
            <p className="kicker">Pinned pages</p>
            <p className="hint">Kept pages need the PIN to open from here or the link.</p>
            <div className="ledger-row">
              {pinnedCodes.map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={selectedPinned === code}
                  onClick={() => {
                    setSelectedPinned(code);
                    setPinnedPin("");
                    setError(null);
                  }}
                  className="ledger-code"
                >
                  {code}
                </button>
              ))}
            </div>
            {selectedPinned && (
              <div className="mt-2 flex flex-col gap-2">
                <label htmlFor="pinned-pin" className="field-label">
                  PIN for {selectedPinned}
                </label>
                <input
                  id="pinned-pin"
                  ref={pinnedPinInputRef}
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinnedPin}
                  onChange={(e) => setPinnedPin(normalizePin(e.target.value))}
                  placeholder="••••"
                  className="field pin-input"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void openPinned(selectedPinned);
                  }}
                />
                {error && <p className="err">{error}</p>}
                <button
                  type="button"
                  disabled={pinnedLoading || !isValidPin(normalizePin(pinnedPin))}
                  onClick={() => void openPinned(selectedPinned)}
                  className="btn-ink w-full py-2 text-sm"
                >
                  {pinnedLoading ? "Checking…" : `Open ${selectedPinned}`}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
