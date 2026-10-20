"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Notice from "@/components/Notice";

// 감시 모드: 켜 두면 1시간마다 /api/reviews/latest에 최신 기록 번호를 묻고, 번호가 늘면 알람을 울린다.
// 소리는 브라우저 내장 Web Audio로 만든다(파일 없음). 브라우저가 소리를 막으므로 사람이 단추를 눌러야 시작한다.
type Latest = { id: number; buyerId: string; buyerName: string; status: string; at: string };

const POLL_MS = 60 * 60 * 1000; // 1시간

type AudioCtor = typeof AudioContext;

function getAudioCtor(): AudioCtor | null {
  const w = window as typeof window & { webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** 삐-삐-삐: 880Hz 짧은 소리 세 번. */
function beep(ctx: AudioContext) {
  const start = ctx.currentTime + 0.05;
  for (let i = 0; i < 3; i++) {
    const t = start + i * 0.25;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}

export default function ReviewAlarm({ initialLatestId }: { initialLatestId: number | null }) {
  const router = useRouter();
  const [supported, setSupported] = useState(true);
  const [on, setOn] = useState(false);
  const [news, setNews] = useState<Latest | null>(null);
  const [failed, setFailed] = useState(false);
  const [flash, setFlash] = useState(0); // 새 기록마다 1씩 — key로 써서 반짝임을 처음부터 다시 튼다
  const flashing = flash > 0;
  const lastId = useRef<number>(initialLatestId ?? 0);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!getAudioCtor()) setSupported(false);
  }, []);

  // 쪽이 새로 그려져 더 큰 번호가 오면 기준을 따라 올린다.
  useEffect(() => {
    if (initialLatestId !== null && initialLatestId > lastId.current) lastId.current = initialLatestId;
  }, [initialLatestId]);

  useEffect(() => {
    if (!on) return;
    let stopped = false;

    async function check() {
      try {
        const res = await fetch("/api/reviews/latest", { cache: "no-store" });
        const body = (await res.json()) as { ok: boolean; latest: Latest | null };
        if (stopped) return;
        if (!body.ok) {
          setFailed(true);
          return;
        }
        setFailed(false);
        const latest = body.latest;
        if (latest && latest.id > lastId.current) {
          lastId.current = latest.id;
          setNews(latest);
          setFlash((n) => n + 1);
          if (ctxRef.current) beep(ctxRef.current);
          if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
          router.refresh();
        }
      } catch {
        if (!stopped) setFailed(true);
      }
    }

    const timer = window.setInterval(check, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [on, router]);

  useEffect(() => () => void ctxRef.current?.close(), []);

  function toggle() {
    if (on) {
      setOn(false);
      return;
    }
    const Ctor = getAudioCtor();
    if (!Ctor) return;
    if (!ctxRef.current) ctxRef.current = new Ctor();
    void ctxRef.current.resume();
    beep(ctxRef.current); // 켜자마자 한 번 울려 소리가 나는지 보여 준다.
    setOn(true);
  }

  if (!supported) {
    return <p className="text-sm text-muted">이 브라우저는 알람 소리를 지원하지 않습니다 — Chrome · Edge에서 열어 주세요.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          key={`bell-${flash}`}
          type="button"
          onClick={toggle}
          aria-pressed={on}
          className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm font-semibold ${
            on ? "border-accent bg-accent text-white" : "border-accent bg-bg text-accent hover:bg-surface"
          } ${flashing ? "alarm-flash" : ""}`}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" strokeLinejoin="round" />
            <path d="M10 20a2 2 0 0 0 4 0" strokeLinecap="round" />
          </svg>
          {on ? "알람 끄기" : "알람 켜기"}
        </button>
        <p className="text-sm text-muted" aria-live="polite">
          {on ? "감시 중 · 1시간마다 확인" : "꺼짐 · 켜면 새 기록이 올 때 소리가 납니다"}
        </p>
      </div>
      {failed && on ? <Notice tone="warn" title="최신 기록을 확인하지 못했습니다 — 1시간 뒤 다시 확인합니다" /> : null}
      {news ? (
        <div key={`news-${flash}`} className="alarm-flash">
          <Notice tone="ok" title="새 기록">
            <span className="num">{news.buyerId}</span> · {news.buyerName} · {news.status} ·{" "}
            <span className="num">{news.at}</span>
          </Notice>
        </div>
      ) : null}
    </div>
  );
}
