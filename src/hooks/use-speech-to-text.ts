"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type SpeechResultList = {
  length: number;
  item: (index: number) => { isFinal: boolean; 0: { transcript: string } };
  [index: number]: { isFinal: boolean; 0: { transcript: string } };
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function subscribeSupport(onChange: () => void) {
  window.addEventListener("load", onChange);
  return () => window.removeEventListener("load", onChange);
}

export function normalizeVoiceQuery(text: string) {
  return text
    .replace(/[。．.！!？?，,]/g, " ")
    .replace(/^(請)?(幫我)?(導航|帶我|我想)?(去|到)/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function useSpeechToText(
  onTranscript: (text: string, isFinal: boolean) => void,
) {
  const supported = useSyncExternalStore(
    subscribeSupport,
    () => Boolean(getSpeechRecognitionCtor()),
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* 已停止 */
    }
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("此瀏覽器不支援語音輸入，請改用 Chrome 或 Edge。");
      return;
    }
    try {
      recognitionRef.current?.abort();
    } catch {
      /* 沒有進行中的辨識 */
    }
    const recognition = new Ctor();
    recognition.lang = "zh-TW";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let transcript = "";
      let isFinal = false;
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        transcript += result[0]?.transcript ?? "";
        if (result.isFinal) isFinal = true;
      }
      const text = normalizeVoiceQuery(transcript);
      if (text) onTranscriptRef.current(text, isFinal);
    };
    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") {
        setError(event.error === "no-speech" ? "沒聽到聲音，請再試一次。" : null);
      } else if (event.error === "not-allowed") {
        setError("請允許麥克風權限後再語音搜尋。");
      } else {
        setError("語音辨識失敗，請再試一次。");
      }
      setListening(false);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
      setError(null);
    } catch {
      setError("無法啟動麥克風。");
      setListening(false);
    }
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => () => {
    try {
      recognitionRef.current?.abort();
    } catch {
      /* 卸載時忽略 */
    }
  }, []);

  return { supported, listening, error, toggle, stop };
}
