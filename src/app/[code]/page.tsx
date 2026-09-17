"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import {
  IconCopy,
  IconEdit,
  IconEye,
  IconPin,
  IconTrash,
} from "@/components/icons";
import { useTextSession } from "@/hooks/useTextSession";
import { isValidPin, normalizePin } from "@/lib/pin";
import { IDLE_EXPIRE_MS } from "@/lib/session-state";
import {
  isValidSessionCode,
  normalizeSessionCode,
} from "@/lib/session-code";

type ViewMode = "edit" | "preview";

function formatExpiry(expiresAt: number | null): string | null {
  if (expiresAt == null) return null;
  const sec = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  if (sec <= 0) return "expiring…";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function SessionPage() {
  const params = useParams();
  const code = normalizeSessionCode(String(params.code ?? ""));
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [pinDraft, setPinDraft] = useState("");
  const [unlockPin, setUnlockPin] = useState("");
  const [showPinForm, setShowPinForm] = useState(false);
  const [expiryLabel, setExpiryLabel] = useState<string | null>(null);
  const undoSnapshotRef = useRef<string | null>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const unlockInputRef = useRef<HTMLInputElement>(null);

  const {
    state,
    peerCount,
    connected,
    locked,
    status,
    errorMessage,
    setText,
    clearText,
    unlock,
    pinSession,
    unpinSession,
    clearError,
  } = useTextSession({ room: code });

  const sessionUrl = useMemo(() => {
    if (typeof window === "undefined") return `/${code}`;
    return `${window.location.origin}/${code}`;
  }, [code]);

  useEffect(() => {
    if (state.pinned || state.expiresAt == null) {
      setExpiryLabel(null);
      return;
    }
    const tick = () => setExpiryLabel(formatExpiry(state.expiresAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state.pinned, state.expiresAt]);

  const copyText = useCallback(async () => {
    if (!state.text) return;
    try {
      await navigator.clipboard.writeText(state.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [state.text]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sessionUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [sessionUrl]);

  const onDeleteText = useCallback(() => {
    if (!state.text) return;
    undoSnapshotRef.current = state.text;
    clearText();
  }, [clearText, state.text]);

  const undoDelete = useCallback(() => {
    const snapshot = undoSnapshotRef.current;
    if (snapshot === null) return;
    undoSnapshotRef.current = null;
    setText(snapshot);
  }, [setText]);

  const onTextChange = useCallback(
    (text: string) => {
      undoSnapshotRef.current = null;
      setText(text);
    },
    [setText],
  );

  useEffect(() => {
    undoSnapshotRef.current = null;
  }, [code]);

  useEffect(() => {
    if (showPinForm && !locked) {
      pinInputRef.current?.focus();
    }
  }, [showPinForm, locked]);

  useEffect(() => {
    if (locked) {
      unlockInputRef.current?.focus();
    }
  }, [locked]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (locked) return;
      if (!(e.metaKey || e.ctrlKey) || e.key !== "z" || e.shiftKey) return;
      if (undoSnapshotRef.current === null) return;
      e.preventDefault();
      undoDelete();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [locked, undoDelete]);

  const onUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    unlock(unlockPin);
  };

  const onPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const pin = normalizePin(pinDraft);
    if (!isValidPin(pin)) return;
    if (state.pinned) {
      unpinSession(pin);
    } else {
      pinSession(pin);
    }
    setShowPinForm(false);
    setPinDraft("");
  };

  if (!isValidSessionCode(code)) {
    return (
      <main className="invalid">
        <div>
          <p>That code is not a page.</p>
          <Link href="/" className="mt-4 inline-block">
            Home
          </Link>
        </div>
      </main>
    );
  }

  const peerClass =
    connected ? "peers is-live" : status === "error" ? "peers is-err" : "peers";
  const peerLabel = connected
    ? `${peerCount} at this page`
    : status === "loading"
      ? "Loading…"
      : status === "error"
        ? "Offline"
        : "Connecting…";

  return (
    <main className="flex h-dvh max-h-dvh flex-col overflow-hidden overscroll-none">
      <header className="masthead">
        <Link href="/" className="wordmark">
          Vecchio
        </Link>
        <span className="code-mark">{code}</span>
        {state.pinned && <span className="kept">Kept</span>}
        {expiryLabel && (
          <span
            className="expiry"
            title={`Clears after ${IDLE_EXPIRE_MS / 60000}m with nobody connected`}
          >
            Clears in {expiryLabel}
          </span>
        )}

        <button type="button" onClick={copyLink} className="text-btn">
          {linkCopied ? "Link copied" : "Copy link"}
        </button>

        <button
          type="button"
          title={state.pinned ? "Unpin (keeps on home, no auto-clear)" : "Pin to home"}
          aria-label={state.pinned ? "Unpin session" : "Pin session"}
          aria-expanded={showPinForm}
          onClick={() => setShowPinForm((v) => !v)}
          className={`icon-btn ${state.pinned ? "is-on" : ""}`}
        >
          <IconPin className="h-4 w-4" />
        </button>

        {showPinForm && !locked && (
          <form
            onSubmit={onPinSubmit}
            className="flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={pinInputRef}
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinDraft}
              onChange={(e) => setPinDraft(normalizePin(e.target.value))}
              placeholder={state.pinned ? "PIN" : "4-digit PIN"}
              className="pin-field"
            />
            <button
              type="submit"
              disabled={!isValidPin(normalizePin(pinDraft))}
              className="text-btn"
            >
              {state.pinned ? "Unpin" : "Keep"}
            </button>
          </form>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Edit"
            aria-label="Edit"
            aria-pressed={viewMode === "edit"}
            onClick={() => setViewMode("edit")}
            className={`icon-btn ${viewMode === "edit" ? "is-on" : ""}`}
          >
            <IconEdit className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Preview markdown"
            aria-label="Preview markdown"
            aria-pressed={viewMode === "preview"}
            onClick={() => setViewMode("preview")}
            className={`icon-btn ${viewMode === "preview" ? "is-on" : ""}`}
          >
            <IconEye className="h-4 w-4" />
          </button>
        </div>

        <span className={peerClass}>{peerLabel}</span>
      </header>

      {errorMessage && <p className="banner-err">{errorMessage}</p>}

      {locked ? (
        <div className="unlock">
          <div className="unlock-card">
            <p className="kicker">Kept page</p>
            <p className="join-lead">
              Enter the 4-digit PIN to continue. Anyone with the code still needs
              the PIN once a page is kept.
            </p>
            <form onSubmit={onUnlockSubmit} className="mt-4 flex flex-col gap-3">
              <input
                ref={unlockInputRef}
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                value={unlockPin}
                onChange={(e) => setUnlockPin(normalizePin(e.target.value))}
                placeholder="••••"
                className="field pin-input"
              />
              <button type="submit" className="btn-ink w-full py-2.5">
                Unlock
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="sheet">
            <div className="sheet-actions">
              <button
                type="button"
                title={copied ? "Copied" : "Copy text"}
                aria-label={copied ? "Copied" : "Copy text"}
                disabled={!state.text}
                onClick={copyText}
                className="icon-btn"
              >
                <IconCopy className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Clear text (⌘Z / Ctrl+Z to undo)"
                aria-label="Clear text"
                disabled={!state.text}
                onClick={onDeleteText}
                className="icon-btn"
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </div>

            {viewMode === "edit" ? (
              <textarea
                value={state.text}
                onChange={(e) => onTextChange(e.target.value)}
                placeholder="Paste a Cursor answer, prompt, or markdown…"
                spellCheck={false}
              />
            ) : (
              <div className="session-scroll">
                <MarkdownPreview content={state.text} />
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
