import fallbackData from "@/data/fx_fallback.json";
import { kst } from "@/lib/format";

// 환율 레이더 — 서버에서만 환율을 받는다(키 없음). 60초 동안 같은 응답을 다시 쓰고, 못 받으면 저장본을 보인다.
export const revalidate = 60;

const ENDPOINT = "https://api.frankfurter.dev/v2/rates?base=USD&quotes=KRW,EUR,JPY,CNY";
const PROVIDER = "api.frankfurter.dev";
const QUOTES = ["KRW", "EUR", "JPY", "CNY"] as const;

type Quote = (typeof QUOTES)[number];
type Rates = Record<Quote, number>;
type Row = { date?: unknown; base?: unknown; quote?: unknown; rate?: unknown };

/** API 응답 원문([{ date, base, quote, rate }, …]) → { date, rates }. 네 통화가 모두 있고 rate > 0이어야 한다. 아니면 null. */
function parseRows(rows: unknown): { date: string; rates: Rates } | null {
  if (!Array.isArray(rows)) return null;
  const rates: Partial<Rates> = {};
  let date: string | null = null;
  for (const r of rows as Row[]) {
    if (r?.base !== "USD" || typeof r.quote !== "string") continue;
    if (!(QUOTES as readonly string[]).includes(r.quote)) continue;
    if (typeof r.rate !== "number" || !Number.isFinite(r.rate) || r.rate <= 0) return null;
    rates[r.quote as Quote] = r.rate;
    if (typeof r.date === "string") date = r.date;
  }
  if (!date || !QUOTES.every((q) => typeof rates[q] === "number")) return null;
  return { date, rates: rates as Rates };
}

async function fetchLive() {
  try {
    const res = await fetch(ENDPOINT, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return parseRows(await res.json());
  } catch {
    return null;
  }
}

export async function GET() {
  const now = new Date();
  const stamp = { fetchedAt: now.toISOString(), fetchedAtKst: kst(now, true) };

  const live = process.env.FX_FORCE_FALLBACK === "1" ? null : await fetchLive();
  if (live) {
    return Response.json({ date: live.date, base: "USD", rates: live.rates, ...stamp, provider: PROVIDER, fallback: false });
  }

  // 저장본(data/fx_fallback.json)의 최신 블록 — 이것마저 깨졌으면 500.
  const saved = parseRows(fallbackData.latest);
  if (!saved) return Response.json({ error: "환율 저장본을 읽지 못했습니다" }, { status: 500 });
  return Response.json({
    date: saved.date,
    base: "USD",
    rates: saved.rates,
    ...stamp,
    provider: fallbackData.provider,
    fallback: true,
    savedAt: fallbackData.savedAt,
    savedAtKst: kst(fallbackData.savedAt, true),
  });
}
