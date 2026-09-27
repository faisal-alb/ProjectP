"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useVoiceAssistant } from "./context";
import { useRun } from "../dashboard/RunProvider";

/** Optional text conversation beside the persistent voice launcher. */
export function RunAssistant() {
  const {
    textOpen,
    setTextOpen,
    askText,
    messages,
    state,
    toggle,
    error,
    zone,
  } = useVoiceAssistant();
  const { run } = useRun();
  const [question, setQuestion] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const transcript = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (!textOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    input.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setTextOpen(false);
      }
    };
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("keydown", close);
      previous?.focus();
    };
  }, [textOpen, setTextOpen]);
  useEffect(() => {
    if (transcript.current)
      transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [messages, textOpen]);
  if (!textOpen) return null;
  const decision = run?.decisions.filter((d) => d.zone === zone).at(-1);
  return (
    <section
      id="grid-assistant"
      aria-label="Ask GridFlex conversation"
      className="fixed bottom-20 right-5 z-40 flex max-h-[calc(100dvh-7rem)] w-96 max-w-[calc(100vw-2.5rem)] flex-col rounded-xl border border-border-strong bg-background-raised p-5 sm:bottom-24 sm:right-8"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Ask GridFlex</h2>
        <button
          type="button"
          aria-label="Close conversation panel"
          onClick={() => setTextOpen(false)}
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-md hover:bg-surface"
        >
          <X size={18} />
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">
        Ask about this energy day or explore a what-if.
      </p>
      {messages.length > 0 && (
        <ol
          ref={transcript}
          aria-live="polite"
          aria-label="Conversation transcript"
          className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto break-words text-sm"
        >
          {messages.map((m, i) => (
            <li key={i}>
              <span className="font-medium">
                {m.source === "user" ? "You" : "GridFlex"}:{" "}
              </span>
              {m.text}
            </li>
          ))}
        </ol>
      )}
      <form
        className="mt-4 flex shrink-0 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!question.trim() || state === "connecting") return;
          askText(question.trim());
          setQuestion("");
        }}
      >
        <label className="sr-only" htmlFor="assistant-question">
          Question for GridFlex
        </label>
        <input
          id="assistant-question"
          ref={input}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question…"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-base"
        />
        <button
          disabled={state === "connecting" || !question.trim()}
          className="rounded-md border border-border-strong px-4 py-2 text-sm disabled:opacity-50"
        >
          Ask
        </button>
      </form>
      {error && (
        <p role="status" className="mt-3 text-sm text-watch">
          {error}
        </p>
      )}
      <details className="mt-4 shrink-0 text-sm text-muted">
        <summary className="cursor-pointer">
          Latest decision explanation
        </summary>
        <p className="mt-2 max-h-24 overflow-y-auto">
          {decision?.reasons.join(". ") ?? "No decision has been recorded yet."}
        </p>
      </details>
      {state !== "idle" && (
        <button
          type="button"
          className="mt-4 self-start text-sm text-muted underline underline-offset-4"
          onClick={() => toggle()}
        >
          End conversation
        </button>
      )}
    </section>
  );
}
