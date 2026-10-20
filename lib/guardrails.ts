// 가드레일 G1–G7 — 초안 메일을 코드가 채점한다(순수 함수). 하나라도 걸리면 그 초안은 blocked.
// 초안 로봇과 승인 화면이 같이 쓴다. 글자는 NFC로 맞춰 견준다.

export const SIGNATURE_EMAIL = "credit@hanbitprecision.example";
export const DISREGARD_LINE = "If you have already paid, please disregard this message.";
export const MAX_WORDS = 180;

export const CHECK_LABELS = {
  G1: "금액 정확",
  G2: "바이어 이름",
  G3: "계좌 없음",
  G4: "법적 표현 없음",
  G5: "이미 냈다면 무시",
  G6: "180단어 이하",
  G7: "링크 · 다른 메일 주소 없음",
} as const;

export type CheckId = keyof typeof CHECK_LABELS;
export type Check = { id: CheckId; label: string; ok: boolean; note: string };

const nfc = (s: string) => s.normalize("NFC");
const lower = (s: string) => nfc(s).toLowerCase();
const uniq = (list: string[]) => [...new Set(list)];

function check(id: CheckId, hits: string[]): Check {
  return { id, label: CHECK_LABELS[id], ok: hits.length === 0, note: uniq(hits).join(" · ") };
}

const AMOUNT_RE = /(?:US\$|USD|\$)\s*\d[\d,]*(?:\.\d+)?/gi;
const ACCOUNT_RE = /\b(?:account number|bank account|bank details|new account|routing number|swift code)\b|\baccount no\.|계좌/gi;
const ACCOUNT_UPPER_RE = /\b(?:IBAN|SWIFT|BIC)\b/g; // 대문자 그대로만(swift payment는 통과)
const LEGAL_RE = /\b(?:lawsuit|legal action|court|police|attorney|criminal)\b/gi;
const LINK_RE = /https?:\/\/|www\./gi;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

const matches = (re: RegExp, text: string) => [...text.matchAll(re)].map((m) => m[0]);
const squash = (s: string) => s.replace(/\s+/g, " ").replace(/,+$/, "").trim().toUpperCase();

/** 초안 하나를 G1–G7로 채점한다. amount = 코드가 만든 금액 글자(예: "USD 12,345.00"). */
export function runGuardrails(draft: { subject: string; body: string }, buyer: { name: string; amount: string }): Check[] {
  const subject = nfc(draft.subject);
  const body = nfc(draft.body);
  const all = `${subject}\n${body}`;
  const amount = squash(nfc(buyer.amount));

  // G1 — 그 금액 글자가 있고, 다른 금액 표기가 없다(같은 금액이 여러 번은 괜찮다).
  const g1: string[] = [];
  if (!lower(body).includes(lower(buyer.amount))) g1.push(`본문에 ${buyer.amount} 없음`);
  for (const m of matches(AMOUNT_RE, body)) if (squash(m) !== amount) g1.push(m);

  // G2 — 바이어 이름 글자 그대로.
  const g2 = lower(body).includes(lower(buyer.name)) ? [] : [`본문에 ${buyer.name} 없음`];

  // G3 — 계좌 · 은행 정보 낱말.
  const g3 = [...matches(ACCOUNT_RE, all), ...matches(ACCOUNT_UPPER_RE, all)];

  // G4 — 법적 표현(낱말 경계 — courtesy는 통과).
  const g4 = matches(LEGAL_RE, all);

  // G5 — 고정 문장.
  const g5 = lower(body).includes(lower(DISREGARD_LINE)) ? [] : ["고정 문장 없음"];

  // G6 — 낱말 수.
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  const g6 = words <= MAX_WORDS ? [] : [`${words}단어`];

  // G7 — 링크 없음 · 메일 주소는 서명 주소 하나뿐.
  const g7 = [...matches(LINK_RE, all), ...matches(EMAIL_RE, all).filter((e) => e.toLowerCase() !== SIGNATURE_EMAIL)];

  return [check("G1", g1), check("G2", g2), check("G3", g3), check("G4", g4), check("G5", g5), check("G6", g6), check("G7", g7)];
}

/** 걸린 검사 번호들(예: ["G1", "G5"]). */
export function failedIds(checks: Check[]): CheckId[] {
  return checks.filter((c) => !c.ok).map((c) => c.id);
}
