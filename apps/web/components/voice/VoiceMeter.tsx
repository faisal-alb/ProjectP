"use client";

import { useEffect, useRef } from "react";
import { useConversationControls } from "@elevenlabs/react";
import type { VoiceState } from "./context";

/** Resting bar heights, and which slice of the spectrum each bar listens to (centre = lowest). */
const REST = [0.3, 0.5, 0.75, 0.5, 0.3];
const BAND = [3, 1, 0, 2, 4];

/**
 * A five-bar level meter. Listening reads the mic, speaking reads the agent's audio, both
 * live per frame. Connecting is a CSS wave; idle and reduced motion are static bars where
 * only colour says what's happening.
 */
export function VoiceMeter({ state, size = "md" }: { state: VoiceState; size?: "sm" | "md" }) {
  const { getInputByteFrequencyData, getOutputByteFrequencyData } = useConversationControls();
  const bars = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const els = bars.current;
    const set = (i: number, v: number) => {
      if (els[i]) els[i].style.transform = `scaleY(${v})`;
    };

    if (state === "connecting") {
      // Hand the transform back to the CSS wave.
      els.forEach((el) => el && (el.style.transform = ""));
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (state === "idle" || reduced) {
      REST.forEach((h, i) => set(i, state === "idle" ? h * 0.6 : h));
      return;
    }

    const speaking = state === "speaking";
    const levels = REST.map(() => 0.18);
    let raf = 0;
    const tick = () => {
      let data: Uint8Array = new Uint8Array(0);
      try {
        data = speaking ? getOutputByteFrequencyData() : getInputByteFrequencyData();
      } catch {
        // Not connected yet; keep the bars at their floor.
      }
      const width = Math.max(1, Math.floor(data.length / REST.length));
      for (let i = 0; i < REST.length; i++) {
        let sum = 0;
        for (let j = 0; j < width; j++) sum += data[BAND[i] * width + j] ?? 0;
        const target = Math.min(1, 0.18 + (sum / width / 255) * (speaking ? 1.7 : 2.6));
        // Fast attack, slow release, so peaks read and then settle.
        levels[i] += (target - levels[i]) * (target > levels[i] ? 0.5 : 0.16);
        set(i, levels[i]);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, getInputByteFrequencyData, getOutputByteFrequencyData]);

  return (
    <span className={`voice-meter ${size === "sm" ? "h-4 gap-[2px]" : "h-6 gap-[3px]"}`} data-state={state} aria-hidden="true">
      {REST.map((_, i) => (
        <span
          key={i}
          ref={(el) => {
            bars.current[i] = el;
          }}
          className="voice-bar"
          style={{ animationDelay: `${i * 90}ms` }}
        />
      ))}
    </span>
  );
}
