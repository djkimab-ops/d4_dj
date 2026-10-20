import { db } from "@/lib/db";

// 바이어 데이터 읽기 — 서버 전용. DB(Supabase)의 Buyer 표를 읽는다(4일차의 JSON과 같은 16칸).
export type Grade = "S" | "A" | "B" | "C";

export type Buyer = {
  id: string;
  name: string;
  countryCode: string;
  countryKo: string;
  region: string;
  industry: string;
  paymentMethod: string;
  termsDays: number;
  openArUsd: number;
  overdueUsd: number;
  pctAr31p: number | null; // 0–1
  oldestOpenDays: number;
  avgDaysLate12m: number | null;
  pd30d: number; // 0–1
  grade: Grade;
  signals: string[];
};

// DB의 grade 칸은 string — 넣은 값이 S · A · B · C뿐이라 Grade로 맞춘다.
export async function getBuyers(): Promise<Buyer[]> {
  const rows = await db().buyer.findMany({ orderBy: { id: "asc" } });
  return rows as Buyer[];
}

/** id는 대문자로 맞춰 찾는다(b048 → B048). 없으면 null. */
export async function getBuyer(id: string): Promise<Buyer | null> {
  const row = await db().buyer.findUnique({ where: { id: id.trim().toUpperCase() } });
  return row as Buyer | null;
}
