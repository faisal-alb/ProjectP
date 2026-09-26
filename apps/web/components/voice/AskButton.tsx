"use client";

import { secondaryButton } from "@/components/onboarding/controls";
import { STATE_LABEL, useVoiceAssistant, type VoiceState } from "./context";
import { VoiceMeter } from "./VoiceMeter";

const FLOATING_BORDER: Record<VoiceState, string> = {
  idle: "border-border-strong hover:border-foreground/40",
  connecting: "border-border-strong",
  listening: "border-foreground/30",
  speaking: "border-accent/60",
};

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
        className={`voice-fab flex h-12 min-w-44 items-center gap-3 rounded-lg border bg-surface px-4 text-left shadow-lg shadow-black/30 transition-[border-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97] ${FLOATING_BORDER[state]}`}
      >
        <VoiceMeter state={state} />
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-medium text-foreground" aria-live="polite">
            {STATE_LABEL[state]}
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
      className={`${secondaryButton} !gap-2.5 !py-2 active:scale-[0.97] ${active ? "!border-border-strong" : ""} ${state === "speaking" ? "!border-accent/60" : ""} ${className}`}
    >
      <VoiceMeter state={state} size="sm" />
      <span className="min-w-[4.75rem] text-left" aria-live="polite">
        {active ? STATE_LABEL[state] : label}
      </span>
    </button>
  );
}
