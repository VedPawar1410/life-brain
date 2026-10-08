"use client";

import { useRef, useState, useSyncExternalStore } from "react";

// Minimal typings for the Web Speech API (not fully in TypeScript's DOM lib, and
// Safari/Chrome still expose it as `webkitSpeechRecognition`).
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

// Support never changes after load, so "subscribe" is a no-op. The server snapshot is false,
// which keeps server and first client render identical (no hydration mismatch).
const noop = () => () => {};
const useSpeechSupported = () =>
  useSyncExternalStore(noop, () => Boolean(getRecognition()) && window.isSecureContext, () => false);

type Props = {
  value: string;
  onChange: (text: string) => void;
  className?: string;
};

/** Tap to talk: spoken words are appended to `value` live. Hidden where unsupported. */
export default function MicButton({ value, onChange, className = "" }: Props) {
  const supported = useSpeechSupported();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);

  if (!supported) return null;

  function toggle() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Ctor = getRecognition()!;
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = true; // show words as they're recognised, not only at the end

    // Speech is appended to whatever was already typed when the mic was turned on.
    const base = value.trim() ? value.trimEnd() + " " : "";
    rec.onresult = (e) => {
      const spoken = Array.from(e.results, (r) => r[0].transcript).join("");
      onChange(base + spoken.trimStart());
    };
    rec.onerror = (e) => setError(e.error === "not-allowed" ? "Microphone permission denied" : e.error);
    rec.onend = () => setListening(false);

    setError(null);
    recognition.current = rec;
    rec.start();
    setListening(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={listening ? "Stop dictation" : "Dictate with your voice"}
        aria-pressed={listening}
        className={`btn-secondary shrink-0 ${listening ? "animate-pulse border-red-500 text-red-500" : ""} ${className}`}
      >
        {listening ? "■ Stop" : "🎙️"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </>
  );
}
