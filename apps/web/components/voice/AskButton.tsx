"use client";

import { STATE_LABEL, useVoiceAssistant, type VoiceState } from "./context";
import { VoiceMeter } from "./VoiceMeter";

/** The state label, keyed so each change settles in rather than swapping in place. */
function StateText({ state, text }: { state: VoiceState; text: string }) {
  return (
    <span key={state} className="voice-label">
      {text}
    </span>
  );
}

/** Bottom-right, always on screen. Shows what the assistant is doing, and ends the session on tap. */
export function FloatingAskButton() {
  const { state, error, toggle } = useVoiceAssistant();
  const active = state !== "idle";
  return (
    <div className="fixed right-5 bottom-5 z-40 flex flex-col items-end gap-2 sm:right-8 sm:bottom-8">
      {error && (
        <p role="alert" className="panel max-w-64 rounded-md px-3 py-2 text-xs text-muted">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => toggle()}
        aria-label={active ? "End voice assistant" : "Ask GridFlex with your voice"}
        data-state={state}
        className="voice-button voice-fab flex h-12 min-w-44 items-center gap-3 rounded-lg border px-4 text-left shadow-lg shadow-black/30 [--voice-base:var(--surface)]"
      >
        <VoiceMeter state={state} />
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-medium text-foreground" aria-live="polite">
            <StateText state={state} text={STATE_LABEL[state]} />
          </span>
          {active && <span className="text-[11px] text-muted-2">Tap to end</span>}
        </span>
      </button>
    </div>
  );
}

/**
 * An in-page button that opens the same assistant. Pass `prompt` to open with a question,
 * so it's a one-tap "ask about this".
 */
export function AskGridFlexButton({
  prompt,
  label = "Ask GridFlex",
  className = "",
}: {
  prompt?: string;
  label?: string;
  className?: string;
}) {
  const { state, toggle } = useVoiceAssistant();
  const active = state !== "idle";
  return (
    <button
      type="button"
      onClick={() => toggle(prompt)}
      aria-label={active ? "End voice assistant" : `${label} with your voice`}
      data-state={state}
      className={`voice-button inline-flex items-center justify-center gap-2.5 rounded-md border px-4 py-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <VoiceMeter state={state} size="sm" />
      <span className="min-w-[4.75rem] text-left" aria-live="polite">
        <StateText state={state} text={active ? STATE_LABEL[state] : label} />
      </span>
    </button>
  );
}
