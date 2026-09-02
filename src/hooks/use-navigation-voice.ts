"use client";

import { useEffect, useRef } from "react";
import {
  spokenInstruction,
  voicePhaseForDistance,
  type VoicePhase,
} from "@/lib/nav-voice";
import type { RouteStep } from "@/types/domain";

async function speakWithChatGpt(text: string) {
  const response = await fetch("/api/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (response.status === 204 || !response.ok) {
    throw new Error("chatgpt-voice-unavailable");
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error("chatgpt-voice-empty");
  const url = URL.createObjectURL(blob);
  await new Promise<void>((resolve, reject) => {
    const audio = new Audio(url);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("audio-play-failed"));
    };
    void audio.play().catch(reject);
  });
}

function speakWithSystem(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-TW";
    utterance.rate = 1.06;
    utterance.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const zh =
      voices.find((voice) => voice.lang === "zh-TW") ??
      voices.find((voice) => voice.lang.startsWith("zh"));
    if (zh) utterance.voice = zh;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export function useNavigationVoice({
  enabled,
  navigating,
  step,
  distanceMeters,
  offRoute,
  destinationLabel,
}: {
  enabled: boolean;
  navigating: boolean;
  step: RouteStep | null;
  distanceMeters: number;
  offRoute: boolean;
  destinationLabel: string;
}) {
  const lastKeyRef = useRef("");
  const speakingRef = useRef(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !navigating) {
      startedRef.current = false;
      lastKeyRef.current = "";
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      return;
    }

    const queue: { phase: VoicePhase; text: string }[] = [];
    if (!startedRef.current) {
      startedRef.current = true;
      queue.push({
        phase: "start",
        text: spokenInstruction(step, distanceMeters, destinationLabel, "start"),
      });
    }
    if (offRoute) {
      queue.push({
        phase: "offroute",
        text: spokenInstruction(step, distanceMeters, destinationLabel, "offroute"),
      });
    } else {
      const phase = voicePhaseForDistance(distanceMeters, step?.type);
      if (phase) {
        queue.push({
          phase,
          text: spokenInstruction(step, distanceMeters, destinationLabel, phase),
        });
      }
    }

    const next = queue[queue.length - 1];
    if (!next?.text || speakingRef.current) return;
    const key = `${step?.id ?? "nav"}:${next.phase}:${next.text}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    speakingRef.current = true;

    void (async () => {
      try {
        await speakWithChatGpt(next.text);
      } catch {
        await speakWithSystem(next.text);
      } finally {
        speakingRef.current = false;
      }
    })();
  }, [
    destinationLabel,
    distanceMeters,
    enabled,
    navigating,
    offRoute,
    step,
  ]);
}
