"use client";

import { useEffect, useState } from "react";

// 읽어 주기 단추: 서버가 만든 글 한 줄(text)을 브라우저 내장 speechSynthesis로 읽는다.
// 사람이 눌렀을 때만 시작하고, 읽은 글은 어디에도 저장하거나 보내지 않는다.
export default function SpeakButton({ text, label = "읽어 주기" }: { text: string; label?: string }) {
  const [supported, setSupported] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      setSupported(false);
      return;
    }
    return () => window.speechSynthesis.cancel();
  }, []);

  function toggle() {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    const ko = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("ko"));
    if (ko) u.voice = ko;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  }

  if (!supported) {
    return <p className="text-sm text-muted">이 브라우저는 읽어 주기를 지원하지 않습니다 — 화면의 숫자를 확인해 주세요.</p>;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={speaking}
      className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm font-semibold ${
        speaking ? "border-accent bg-accent text-white" : "border-accent bg-bg text-accent hover:bg-surface"
      }`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        {speaking ? (
          <rect x="6" y="6" width="12" height="12" rx="1" />
        ) : (
          <>
            <path d="M4 9v6h4l5 4V5L8 9H4z" strokeLinejoin="round" />
            <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" strokeLinecap="round" />
          </>
        )}
      </svg>
      {speaking ? "멈추기" : label}
    </button>
  );
}
