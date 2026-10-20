// 독촉 계산 — 순수 함수만(파일 · DB를 읽지 않는다). 단계 · 말투 · 금액 글자는 모두 여기서 코드가 정한다.
// 초안 로봇(scripts/draft-dunning.ts)과 승인 화면이 같이 쓴다.

export const STAGES = ["D+7", "D+15", "D+30"] as const;
export type Stage = (typeof STAGES)[number];
export type Tone = "T1" | "T2" | "T3";
export type ToneMatrix = Record<Stage, Record<string, Tone>>;

/**
 * 단계 — oldestOpenDays(가장 오래 밀린 인보이스가 기일을 넘긴 날 수):
 * 30 이상 D+30 · 15–29 D+15 · 7–14 D+7 · 1–6 대기(초안 없음) · 0 이하 '확인 필요'.
 */
export function stageFor(oldestOpenDays: number): Stage | "대기" | "확인 필요" {
  if (!Number.isFinite(oldestOpenDays) || oldestOpenDays <= 0) return "확인 필요";
  if (oldestOpenDays >= 30) return "D+30";
  if (oldestOpenDays >= 15) return "D+15";
  if (oldestOpenDays >= 7) return "D+7";
  return "대기";
}

const isTone = (v: string): v is Tone => v === "T1" || v === "T2" || v === "T3";

/** data/tone_matrix.csv의 글(열 stage,S,A,B,C) → { 단계: { 등급: 말투 } }. 모양이 어긋나면 오류. */
export function parseToneMatrix(csv: string): ToneMatrix {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const head = lines[0]?.split(",").map((s) => s.trim()) ?? [];
  if (head[0] !== "stage" || head.length < 2) throw new Error("tone_matrix.csv의 첫 줄이 stage,S,A,B,C 모양이 아닙니다");
  const grades = head.slice(1);
  const out: Partial<ToneMatrix> = {};
  for (const line of lines.slice(1)) {
    const [stage, ...cells] = line.split(",").map((s) => s.trim());
    if (!(STAGES as readonly string[]).includes(stage)) continue;
    const row: Record<string, Tone> = {};
    grades.forEach((g, i) => {
      const t = cells[i] ?? "";
      if (!isTone(t)) throw new Error(`tone_matrix.csv ${stage} · ${g} 칸이 T1 · T2 · T3가 아닙니다: "${t}"`);
      row[g] = t;
    });
    out[stage as Stage] = row;
  }
  for (const s of STAGES) if (!out[s]) throw new Error(`tone_matrix.csv에 ${s} 줄이 없습니다`);
  return out as ToneMatrix;
}

/** 단계 × 등급(grade 칸 그대로) → 말투. 표에 없는 등급이면 null. */
export function toneFor(matrix: ToneMatrix, stage: Stage, grade: string): Tone | null {
  return matrix[stage][grade] ?? null;
}

const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 연체 금액 글자: 12345 → "USD 12,345.00" */
export function amountText(usd: number): string {
  return `USD ${money.format(usd)}`;
}

type HasId = { id: string };

/** 독촉 순서 — 연체 금액 큰 순, 같으면 번호 순. */
export function byOverdueDesc<T extends HasId & { overdueUsd: number }>(a: T, b: T): number {
  return b.overdueUsd - a.overdueUsd || a.id.localeCompare(b.id);
}

/** 대기 목록 순서 — 밀린 날 적은 순, 같으면 번호 순. */
export function byDaysAsc<T extends HasId & { oldestOpenDays: number }>(a: T, b: T): number {
  return a.oldestOpenDays - b.oldestOpenDays || a.id.localeCompare(b.id);
}
