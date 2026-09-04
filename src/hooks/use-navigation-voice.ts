"use client";

import { useEffect, useRef } from "react";
import {
  isTurnManeuver,
  takeManeuverVoiceCue,
  type ManeuverVoiceFlags,
} from "@/lib/maneuver-guidance";
import { spokenInstruction, type VoicePhase } from "@/lib/nav-voice";
import type { RouteStep } from "@/types/domain";

async function speakWithChatGpt(text: string, signal: AbortSignal) {
  const response = await fetch("/api/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });
  if (response.status === 204 || !response.ok) {
    throw new Error("chatgpt-voice-unavailable");
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error("chatgpt-voice-empty");
  const url = URL.createObjectURL(blob);
  await new Promise<void>((resolve, reject) => {
    const audio = new Audio(url);
    const onAbort = () => {
      audio.pause();
      URL.revokeObjectURL(url);
      resolve();
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    audio.onended = () => {
      signal.removeEventListener("abort", onAbort);
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onerror = () => {
      signal.removeEventListener("abort", onAbort);
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
  routeGeneration,
}: {
  enabled: boolean;
  navigating: boolean;
  step: RouteStep | null;
  distanceMeters: number;
  offRoute: boolean;
  destinationLabel: string;
  routeGeneration?: number;
}) {
  const flagsRef = useRef<ManeuverVoiceFlags | null>(null);
  const speakingRef = useRef(false);
  const startedRef = useRef(false);
  const arrivePlayedRef = useRef(false);
  const offRoutePlayedRef = useRef(false);
  const pendingRef = useRef<{ phase: VoicePhase; text: string } | null>(null);
  const generationRef = useRef(routeGeneration ?? 0);
  const abortRef = useRef<AbortController | null>(null);
  const playRef = useRef<(item: { phase: VoicePhase; text: string }) => void>(
    () => undefined,
  );

  useEffect(() => {
    const play = (item: { phase: VoicePhase; text: string }) => {
      if (!item.text) return;
      if (speakingRef.current) {
        if (item.phase !== "start") pendingRef.current = item;
        return;
      }
      speakingRef.current = true;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      void (async () => {
        try {
          await speakWithChatGpt(item.text, controller.signal);
        } catch {
          if (!controller.signal.aborted) await speakWithSystem(item.text);
        } finally {
          if (abortRef.current === controller) {
            speakingRef.current = false;
            const pending = pendingRef.current;
            pendingRef.current = null;
            if (pending?.text) play(pending);
          }
        }
      })();
    };
    playRef.current = play;
    return () => {
      abortRef.current?.abort();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if ((routeGeneration ?? 0) !== generationRef.current) {
      generationRef.current = routeGeneration ?? 0;
      flagsRef.current = null;
      startedRef.current = false;
      arrivePlayedRef.current = false;
      offRoutePlayedRef.current = false;
      pendingRef.current = null;
    }

    if (!enabled || !navigating) {
      startedRef.current = false;
      flagsRef.current = null;
      arrivePlayedRef.current = false;
      offRoutePlayedRef.current = false;
      pendingRef.current = null;
      abortRef.current?.abort();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      return;
    }

    if (!startedRef.current) {
      startedRef.current = true;
      playRef.current({
        phase: "start",
        text: spokenInstruction(step, destinationLabel, "start"),
      });
    }

    if (offRoute) {
      if (!offRoutePlayedRef.current) {
        offRoutePlayedRef.current = true;
        playRef.current({
          phase: "offroute",
          text: spokenInstruction(step, destinationLabel, "offroute"),
        });
      }
      return;
    }

    offRoutePlayedRef.current = false;
    if (step?.type === "arrive" && distanceMeters <= 40 && !arrivePlayedRef.current) {
      arrivePlayedRef.current = true;
      playRef.current({
        phase: "arrive",
        text: spokenInstruction(step, destinationLabel, "arrive"),
      });
      return;
    }

    const taken = takeManeuverVoiceCue(
      flagsRef.current,
      step?.id ?? "",
      distanceMeters,
      isTurnManeuver(step),
    );
    flagsRef.current = taken.flags;
    if (taken.cue) {
      playRef.current({
        phase: taken.cue,
        text: spokenInstruction(step, destinationLabel, taken.cue),
      });
    }
  }, [
    destinationLabel,
    distanceMeters,
    enabled,
    navigating,
    offRoute,
    routeGeneration,
    step,
  ]);
}
