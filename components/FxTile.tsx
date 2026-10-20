"use client";

import { useEffect, useState } from "react";
import { fx, krw, usd } from "@/lib/format";

// 환율 타일: 서버가 계산해 넘긴 달러 합(props)에 /api/fx의 환율을 곱해 원화를 보인다.
// 데이터 파일 · DB는 읽지 않는다. 받은 시각은 서버가 만든 fetchedAtKst를 그대로 쓴다.
type FxResponse = {
  date: string;
  base: "USD";
  rates: { KRW: number; EUR: number; JPY: number; CNY: number };
  fetchedAt: string;
  fetchedAtKst: string;
  provider: string;
  fallback: boolean;
  savedAt?: string;
  savedAtKst?: string;
};

const POLL_MS = 60_000;

/** 원화 차이에 부호: +1,234원 · -1,234원 · 0원 */
function signedKrw(v: number): string {
  return v > 0 ? `+${krw(v)}` : krw(v);
}

export default function FxTile({
  cArUsd,
  overdueUsd,
  overdueCount,
  base,
}: {
  cArUsd: number;
  overdueUsd: number;
  overdueCount: number;
  base: { date: string; krw: number };
}) {
  const [data, setData] = useState<FxResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const res = await fetch("/api/fx");
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as FxResponse;
        if (!stopped) {
          setData(body);
          setFailed(false);
        }
      } catch {
        if (!stopped) setFailed(true);
      }
    }
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  const baseKrw = Math.round(cArUsd * base.krw);
  const [, mm, dd] = base.date.split("-");
  const baseLabel = `${Number(mm)}/${Number(dd)}`; // 2026-09-30 → 9/30

  return (
    <section aria-labelledby="fx-tile" className="space-y-2 rounded-lg border border-line bg-surface p-4">
      <h2 id="fx-tile" className="text-sm text-muted">
        지금 환율로 본 원화
      </h2>

      {data ? (
        (() => {
          const rate = data.rates.KRW;
          const todayKrw = Math.round(cArUsd * rate);
          const hms = data.fetchedAtKst.split(" ")[1] ?? data.fetchedAtKst;
          return (
            <>
              <div>
                <p className="num text-2xl font-bold text-ink">{krw(todayKrw)}</p>
                <p className="text-sm text-muted">
                  C등급 <span className="num">{usd(cArUsd)}</span> × 오늘 환율
                </p>
              </div>
              <p className="text-sm text-ink">
                <span className="num">1 USD = {fx(rate)}</span> · <span className="num">{data.date}</span> ·{" "}
                {data.provider} · 받은 시각 <span className="num">{hms}</span>
              </p>
              <p className="text-sm text-ink">
                <span className="num">{baseLabel}</span> 기준 <span className="num">{fx(base.krw)}</span> → C등급{" "}
                <span className="num">{usd(cArUsd)}</span> = <span className="num">{krw(baseKrw)}</span> · 오늘 −{" "}
                <span className="num">{baseLabel}</span> <span className="num">{signedKrw(todayKrw - baseKrw)}</span>
              </p>
              <p className="text-sm text-ink">
                연체 <span className="num">{overdueCount}곳</span> <span className="num">{usd(overdueUsd)}</span> ={" "}
                <span className="num">{krw(Math.round(overdueUsd * rate))}</span>(오늘 환율)
              </p>
              {data.fallback ? (
                <p>
                  <span className="inline-flex items-center rounded border border-warn px-1.5 text-sm font-semibold text-warn">
                    대체 값 · 저장 시각 <span className="num ml-1">{data.savedAtKst ?? "확인 필요"}</span>
                  </span>
                </p>
              ) : null}
            </>
          );
        })()
      ) : failed ? (
        <p className="text-sm text-warn">환율을 받지 못했습니다 — 60초 뒤 다시 받습니다</p>
      ) : (
        <p className="text-sm text-muted">환율 받는 중…</p>
      )}

      <p className="text-xs text-muted">환율은 참고값입니다 — 결제 · 회계 기준이 아닙니다</p>
    </section>
  );
}
